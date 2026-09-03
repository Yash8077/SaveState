/* SaveState PS5 Game Activity Logger.
 *
 * One-shot payload: reads completed sessions from the PS5 activity database,
 * uploads new events to SaveState, advances a local cursor, and exits.
 *
 * Diagnostics are persisted to /data/savestate-sync/activity.log because
 * Payload Manager does not capture the launched ELF's stdout/stderr.
 */
#include <errno.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include "sqlite3.h"

#define SL2_DB "/system_data/priv/system_logger2/nobackup/database/sl2_log.db"
#define APP_DB "/system_data/priv/mms/app.db"
#define STATE_DIR "/data/savestate-sync"
#define CURSOR_FILE STATE_DIR "/last_rowid.txt"
#define CONFIG_FILE STATE_DIR "/config"
#define LOG_FILE STATE_DIR "/activity.log"

#define MAX_BATCH 100
#define SCAN_LIMIT 500
#define POST_URL_MAX 512
#define TOKEN_MAX 256
#define DEVICE_ID_MAX 64

/* libSceHttp (classic HTTP/1.1) API.
 * Signatures match the libSceHttp family used by PS4/PS5 payloads. */
#define HTTP_VERSION_1_1 2
#define HTTP_HEADER_OVERWRITE 0
#define HTTP_METHOD_POST 1

extern int sceNetInit(void);
extern int sceNetPoolCreate(const char *name, int size, int flags);
extern int sceNetPoolDestroy(int pool_id);

extern int sceSslInit(size_t pool_size);
/* Test-only global verification toggle exported by libSceSsl. */
extern int sceSslDisableVerifyOption(void);
extern int sceSslTerm(int ctx_id);

extern int sceHttpInit(int net_pool_id, int ssl_ctx_id, size_t pool_size);
extern int sceHttpTerm(int http_ctx_id);
extern int sceHttpCreateTemplate(int http_ctx_id, const char *agent, int http_ver, int auto_proxy);
extern int sceHttpDeleteTemplate(int tmpl_id);
extern int sceHttpCreateConnectionWithURL(int tmpl_id, const char *url, int keep_alive);
extern int sceHttpDeleteConnection(int conn_id);
extern int sceHttpCreateRequestWithURL(int conn_id, int method, const char *url, uint64_t content_length);
extern int sceHttpDeleteRequest(int req_id);
extern int sceHttpAddRequestHeader(int req_id, const char *name,
                                   const char *value, unsigned int mode);
extern int sceHttpSetRequestContentLength(int req_id, uint64_t content_length);
extern int sceHttpSendRequest(int req_id, const void *data, uint32_t data_size);
extern int sceHttpGetStatusCode(int req_id, int *status);

struct config {
    char endpoint[POST_URL_MAX];
    char device_id[DEVICE_ID_MAX];
    char token[TOKEN_MAX];
};

static void log_msg(const char *fmt, ...) {
    char line[1024];
    va_list ap;

    va_start(ap, fmt);
    vsnprintf(line, sizeof(line), fmt, ap);
    va_end(ap);

    fprintf(stderr, "%s", line);

    FILE *f = fopen(LOG_FILE, "a");
    if (f) {
        fputs(line, f);
        fflush(f);
        fclose(f);
    }
}

static int mkdir_state_dir(void) {
    if (mkdir(STATE_DIR, 0777) < 0 && errno != EEXIST) {
        fprintf(stderr, "mkdir(%s) failed: errno=%d\n", STATE_DIR, errno);
        return -1;
    }
    return 0;
}

static long long read_cursor(void) {
    FILE *f = fopen(CURSOR_FILE, "r");
    long long n = 0;

    if (!f)
        return 0;

    if (fscanf(f, "%lld", &n) != 1)
        n = 0;

    fclose(f);
    return n < 0 ? 0 : n;
}

static int write_cursor(long long n) {
    char tmp[128];
    snprintf(tmp, sizeof(tmp), "%s.tmp", CURSOR_FILE);

    FILE *f = fopen(tmp, "w");
    if (!f)
        return -1;

    fprintf(f, "%lld\n", n);
    fflush(f);
    fclose(f);

    return rename(tmp, CURSOR_FILE);
}

static int load_config(struct config *c) {
    FILE *f;
    char line[640];

    memset(c, 0, sizeof(*c));

    f = fopen(CONFIG_FILE, "r");
    if (!f) {
        log_msg("[SaveState] couldn't open %s (errno=%d)\n", CONFIG_FILE, errno);
        return -1;
    }

    while (fgets(line, sizeof(line), f)) {
        char *eq = strchr(line, '=');
        if (!eq)
            continue;

        *eq++ = 0;

        char *nl = strpbrk(eq, "\r\n");
        if (nl)
            *nl = 0;

        if (!strcmp(line, "ENDPOINT"))
            strncpy(c->endpoint, eq, sizeof(c->endpoint) - 1);
        else if (!strcmp(line, "DEVICE_ID"))
            strncpy(c->device_id, eq, sizeof(c->device_id) - 1);
        else if (!strcmp(line, "TOKEN"))
            strncpy(c->token, eq, sizeof(c->token) - 1);
    }

    fclose(f);

    if (!c->endpoint[0] || !c->device_id[0] || !c->token[0]) {
        log_msg("[SaveState] config missing ENDPOINT, DEVICE_ID, or TOKEN\n");
        return -1;
    }

    return 0;
}

static const char *json_string_field(const char *json, const char *key,
                                     char *out, size_t out_size) {
    char needle[64];
    snprintf(needle, sizeof(needle), "\"%s\":\"", key);

    const char *p = strstr(json, needle);
    if (!p)
        return NULL;

    p += strlen(needle);

    size_t i = 0;
    while (*p && *p != '"' && i + 1 < out_size) {
        if (*p == '\\' && p[1])
            p++;
        out[i++] = *p++;
    }

    out[i] = 0;
    return out;
}

static int json_int_field(const char *json, const char *key) {
    char needle[64];
    snprintf(needle, sizeof(needle), "\"%s\":", key);

    const char *p = strstr(json, needle);
    return p ? atoi(p + strlen(needle)) : 0;
}

static void json_escape(char *dst, size_t cap, const char *src) {
    size_t n = 0;

    if (!src || cap == 0)
        return;

    for (const char *p = src; *p && n + 2 < cap; ++p) {
        if (*p == '"' || *p == '\\')
            dst[n++] = '\\';
        dst[n++] = *p;
    }

    dst[n] = 0;
}

static void lookup_title_name(const char *title_id, char *out, size_t out_size) {
    sqlite3 *db = NULL;
    sqlite3_stmt *tables = NULL;

    out[0] = 0;

    int rc = sqlite3_open_v2(APP_DB, &db,
                             SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX, NULL);
    if (rc != SQLITE_OK) {
        log_msg("[SaveState] app.db open failed for title lookup: rc=%d\n", rc);
        goto done;
    }

    sqlite3_busy_timeout(db, 2000);

    rc = sqlite3_prepare_v2(
        db,
        "select name from sqlite_master "
        "where type='table' and name like 'tbl_iconinfo_%' order by name",
        -1, &tables, NULL);

    if (rc != SQLITE_OK) {
        log_msg("[SaveState] app.db table query failed: rc=%d msg=%s\n",
                rc, sqlite3_errmsg(db));
        goto done;
    }

    for (;;) {
        rc = sqlite3_step(tables);

        if (rc == SQLITE_DONE)
            break;

        if (rc != SQLITE_ROW) {
            log_msg("[SaveState] app.db table scan failed: rc=%d msg=%s\n",
                    rc, sqlite3_errmsg(db));
            break;
        }

        const char *table = (const char *)sqlite3_column_text(tables, 0);
        if (!table)
            continue;

        char sql[256];
        snprintf(sql, sizeof(sql),
                 "select titleName from \"%s\" where titleId=? limit 1",
                 table);

        sqlite3_stmt *st = NULL;
        rc = sqlite3_prepare_v2(db, sql, -1, &st, NULL);
        if (rc != SQLITE_OK)
            continue;

        sqlite3_bind_text(st, 1, title_id, -1, SQLITE_TRANSIENT);

        rc = sqlite3_step(st);
        if (rc == SQLITE_ROW) {
            const char *name = (const char *)sqlite3_column_text(st, 0);
            if (name)
                strncpy(out, name, out_size - 1);
            out[out_size - 1] = 0;
        }

        sqlite3_finalize(st);

        if (out[0])
            break;
    }

done:
    if (tables)
        sqlite3_finalize(tables);
    if (db)
        sqlite3_close(db);
}

static int post_json(const struct config *cfg, const char *body, size_t body_len) {
    int net_pool = -1;
    int ssl_ctx = -1;
    int http_ctx = -1;
    int tmpl = -1;
    int conn = -1;
    int req = -1;
    int status = -1;
    int rc = -1;

    log_msg("[SaveState] initializing network\n");

    rc = sceNetInit();
    if (rc < 0) {
        log_msg("[SaveState] sceNetInit failed: %d\n", rc);
        return -1;
    }

    net_pool = sceNetPoolCreate("savestate-activity", 32 * 1024, 0);
    if (net_pool < 0) {
        log_msg("[SaveState] sceNetPoolCreate failed: %d\n", net_pool);
        return -1;
    }

    /* libSceHttp uses the system SSL service for HTTPS connections. */
    ssl_ctx = sceSslInit(256 * 1024);
    if (ssl_ctx < 0) {
        log_msg("[SaveState] sceSslInit failed: %d\n", ssl_ctx);
        goto fail;
    }

    /* TEMPORARY DIAGNOSTIC: disable TLS certificate verification.
     * This is only to prove whether 0x8095F00C is certificate validation.
     * Do not use this configuration for production. */
    log_msg("[SaveState] disabling SSL certificate verification (TEST ONLY)\n");
    rc = sceSslDisableVerifyOption();
    log_msg("[SaveState] sceSslDisableVerifyOption rc=%d (0x%08X)\n",
            rc, (unsigned int)rc);
    if (rc < 0) {
        log_msg("[SaveState] SSL verification disable failed; continuing anyway\n");
    }

    http_ctx = sceHttpInit(net_pool, ssl_ctx, 256 * 1024);
    if (http_ctx < 0) {
        log_msg("[SaveState] sceHttpInit failed: %d\n", http_ctx);
        goto fail;
    }

    log_msg("[SaveState] HTTP initialized; version=1.1\n");

    tmpl = sceHttpCreateTemplate(
        http_ctx, "SaveState-PS5-Activity/1.0", HTTP_VERSION_1_1, 1);
    if (tmpl < 0) {
        log_msg("[SaveState] sceHttpCreateTemplate failed: %d\n", tmpl);
        goto fail;
    }

    conn = sceHttpCreateConnectionWithURL(tmpl, cfg->endpoint, 1);
    if (conn < 0) {
        log_msg("[SaveState] sceHttpCreateConnectionWithURL failed: %d endpoint=%s\n",
                conn, cfg->endpoint);
        goto fail;
    }

    /* 1 == SCE_HTTP_METHOD_POST in the classic libSceHttp API. */
    req = sceHttpCreateRequestWithURL(
        conn, HTTP_METHOD_POST, cfg->endpoint, (uint64_t)body_len);
    if (req < 0) {
        log_msg("[SaveState] sceHttpCreateRequestWithURL failed: %d endpoint=%s\n",
                req, cfg->endpoint);
        goto fail;
    }

    rc = sceHttpAddRequestHeader(
        req, "Content-Type", "application/json", HTTP_HEADER_OVERWRITE);
    if (rc < 0) {
        log_msg("[SaveState] Content-Type header failed: %d\n", rc);
        goto fail;
    }

    rc = sceHttpAddRequestHeader(
        req, "Accept", "application/json", HTTP_HEADER_OVERWRITE);
    if (rc < 0) {
        log_msg("[SaveState] Accept header failed: %d\n", rc);
        goto fail;
    }

    rc = sceHttpAddRequestHeader(
        req, "X-SaveState-Device-Token", cfg->token, HTTP_HEADER_OVERWRITE);
    if (rc < 0) {
        log_msg("[SaveState] auth header failed: %d\n", rc);
        goto fail;
    }

    rc = sceHttpSetRequestContentLength(req, (uint64_t)body_len);
    if (rc < 0) {
        log_msg("[SaveState] sceHttpSetRequestContentLength failed: %d\n", rc);
        goto fail;
    }

    log_msg("[SaveState] sending POST (%zu bytes)\n", body_len);

    rc = sceHttpSendRequest(req, body, (uint32_t)body_len);
    if (rc < 0) {
        log_msg("[SaveState] sceHttpSendRequest failed: %d (0x%08X)\n",
                rc, (unsigned int)rc);
        goto fail;
    }

    rc = sceHttpGetStatusCode(req, &status);
    if (rc < 0) {
        log_msg("[SaveState] sceHttpGetStatusCode failed: %d\n", rc);
        goto fail;
    }

    log_msg("[SaveState] HTTP status=%d\n", status);

    if (status < 200 || status >= 300) {
        log_msg("[SaveState] upload rejected, HTTP status=%d\n", status);
        rc = -status;
        goto fail;
    }

    rc = 0;

fail:
    if (req >= 0)
        sceHttpDeleteRequest(req);
    if (conn >= 0)
        sceHttpDeleteConnection(conn);
    if (tmpl >= 0)
        sceHttpDeleteTemplate(tmpl);
    if (http_ctx >= 0)
        sceHttpTerm(http_ctx);
    if (ssl_ctx >= 0)
        sceSslTerm(ssl_ctx);
    if (net_pool >= 0)
        sceNetPoolDestroy(net_pool);

    return rc;
}

static int sync_once(const struct config *cfg) {
    sqlite3 *db = NULL;
    sqlite3_stmt *st = NULL;
    long long cursor = read_cursor();

    log_msg("[SaveState] opening logger DB; cursor=%lld\n", cursor);

    int rc = sqlite3_open_v2(
        SL2_DB, &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX, NULL);

    if (rc != SQLITE_OK) {
        log_msg("[SaveState] SQLite open failed: rc=%d msg=%s\n",
                rc, db ? sqlite3_errmsg(db) : "no db");
        goto fail;
    }

    rc = sqlite3_busy_timeout(db, 5000);
    if (rc != SQLITE_OK) {
        log_msg("[SaveState] sqlite3_busy_timeout failed: rc=%d\n", rc);
        goto fail;
    }

    sqlite3_stmt *maxst = NULL;
    long long max_rowid = cursor;

    rc = sqlite3_prepare_v2(
        db, "select coalesce(max(rowid),0) from tbl_log", -1, &maxst, NULL);

    if (rc != SQLITE_OK) {
        log_msg("[SaveState] max(rowid) prepare failed: rc=%d msg=%s\n",
                rc, sqlite3_errmsg(db));
        goto fail;
    }

    rc = sqlite3_step(maxst);
    if (rc == SQLITE_ROW) {
        max_rowid = sqlite3_column_int64(maxst, 0);
    } else {
        log_msg("[SaveState] max(rowid) step failed: rc=%d msg=%s\n",
                rc, sqlite3_errmsg(db));
        sqlite3_finalize(maxst);
        goto fail;
    }

    sqlite3_finalize(maxst);

    if (max_rowid < cursor) {
        log_msg("[SaveState] logger DB reset/rotated; resetting cursor to 0\n");
        cursor = 0;
    }

    const char *sql =
        "select rowid, created_date, log from tbl_log "
        "where event_id='ApplicationSessionEndBi' and rowid>? "
        "order by rowid asc limit ?";

    rc = sqlite3_prepare_v2(db, sql, -1, &st, NULL);
    if (rc != SQLITE_OK) {
        log_msg("[SaveState] session query prepare failed: rc=%d msg=%s\n",
                rc, sqlite3_errmsg(db));
        goto fail;
    }

    sqlite3_bind_int64(st, 1, cursor);
    sqlite3_bind_int(st, 2, SCAN_LIMIT);

    char body[128 * 1024];
    int prefix_len = snprintf(
        body, sizeof(body),
        "{\"schemaVersion\":1,\"deviceId\":\"%s\",\"events\":[",
        cfg->device_id);

    if (prefix_len < 0 || (size_t)prefix_len >= sizeof(body)) {
        log_msg("[SaveState] request buffer too small\n");
        goto fail;
    }

    int count = 0;
    long long last_scanned_rowid = cursor;

    for (;;) {
        rc = sqlite3_step(st);

        if (rc == SQLITE_DONE)
            break;

        if (rc != SQLITE_ROW) {
            log_msg("[SaveState] session query step failed: rc=%d msg=%s; "
                    "cursor NOT advanced\n",
                    rc, sqlite3_errmsg(db));
            goto fail;
        }

        long long rowid = sqlite3_column_int64(st, 0);
        const char *created = (const char *)sqlite3_column_text(st, 1);
        const char *log = (const char *)sqlite3_column_text(st, 2);

        /* Stop before consuming the next row when the event batch is full. */
        if (count >= MAX_BATCH)
            break;

        if (!log) {
            last_scanned_rowid = rowid;
            continue;
        }

        char title_id[80];
        char title_name[240];

        if (!json_string_field(log, "appTitleId",
                               title_id, sizeof(title_id))) {
            log_msg("[SaveState] rowid=%lld has no appTitleId; skipping\n", rowid);
            last_scanned_rowid = rowid;
            continue;
        }

        int fg = json_int_field(log, "totalFgTime");

        /* Best-effort local lookup. titleId remains authoritative. */
        lookup_title_name(title_id, title_name, sizeof(title_name));

        char escaped_name[480];
        char escaped_created[480];
        char item[1536];

        json_escape(escaped_name, sizeof(escaped_name), title_name);
        json_escape(escaped_created, sizeof(escaped_created),
                    created ? created : "");

        if (title_name[0]) {
            snprintf(item, sizeof(item),
                     "{\"sourceRowid\":%lld,\"titleId\":\"%s\","
                     "\"titleName\":\"%s\",\"createdDate\":\"%s\","
                     "\"totalFgTime\":%d}",
                     rowid, title_id, escaped_name, escaped_created, fg);
        } else {
            snprintf(item, sizeof(item),
                     "{\"sourceRowid\":%lld,\"titleId\":\"%s\","
                     "\"titleName\":null,\"createdDate\":\"%s\","
                     "\"totalFgTime\":%d}",
                     rowid, title_id, escaped_created, fg);
        }

        size_t current_len = strlen(body);
        size_t item_len = strlen(item);

        if (current_len + item_len + 3 >= sizeof(body)) {
            log_msg("[SaveState] request buffer full at rowid=%lld; "
                    "leaving cursor before this row\n", rowid);
            break;
        }

        if (count > 0)
            strcat(body, ",");

        strcat(body, item);
        count++;
        last_scanned_rowid = rowid;
    }

    sqlite3_finalize(st);
    st = NULL;

    if (count == 0) {
        strcat(body, "]}");
        sqlite3_close(db);
        db = NULL;

        if (write_cursor(last_scanned_rowid) != 0) {
            log_msg("[SaveState] no upload needed, but cursor write failed: errno=%d\n",
                    errno);
            return -1;
        }

        log_msg("[SaveState] no new session events; cursor=%lld\n",
                last_scanned_rowid);
        return 0;
    }

    strcat(body, "]}");

    sqlite3_close(db);
    db = NULL;

    log_msg("[SaveState] found %d session event(s), uploading through rowid=%lld\n",
            count, last_scanned_rowid);

    rc = post_json(cfg, body, strlen(body));

    if (rc != 0) {
        log_msg("[SaveState] upload failed rc=%d; cursor NOT advanced\n", rc);
        return -1;
    }

    if (write_cursor(last_scanned_rowid) != 0) {
        log_msg("[SaveState] upload succeeded but cursor write failed errno=%d; "
                "next invocation will resend safely via server dedupe\n", errno);
        return -1;
    }

    log_msg("[SaveState] uploaded %d event(s); cursor=%lld\n",
            count, last_scanned_rowid);

    return 1;

fail:
    if (st)
        sqlite3_finalize(st);
    if (db)
        sqlite3_close(db);
    return -1;
}

int main(void) {
    struct config cfg;

    if (mkdir_state_dir() < 0)
        return EXIT_FAILURE;

    log_msg("[SaveState HTTP TEST v1] activity logger starting\n");

    if (load_config(&cfg) < 0) {
        log_msg("[SaveState] configuration invalid; exiting\n");
        return EXIT_FAILURE;
    }

    log_msg("[SaveState] config loaded: endpoint=%s device=%s\n",
            cfg.endpoint, cfg.device_id);

    int batches = 0;

    for (;;) {
        int rc = sync_once(&cfg);

        if (rc < 0) {
            log_msg("[SaveState] sync failed after %d batch(es); exiting\n",
                    batches);
            return EXIT_FAILURE;
        }

        if (rc == 0)
            break;

        batches++;
    }

    log_msg("[SaveState] caught up after %d batch(es)\n", batches);
    return EXIT_SUCCESS;
}
