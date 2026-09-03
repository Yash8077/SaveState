/* SaveState PS5 Game Activity Logger.
 *
 * Harvests completed application sessions from the PS5 system logger and
 * pushes them to SaveState. This is intentionally a one-shot payload: it
 * reads the journal, uploads any new sessions, advances its local cursor, and
 * exits. Run it from your payload/autoload environment whenever convenient.
 */
#include <errno.h>
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
#define MAX_BATCH 100
#define SCAN_LIMIT 500
#define POST_URL_MAX 512
#define TOKEN_MAX 256
#define DEVICE_ID_MAX 64

/* sceHttp2, sceSsl, and sceNet declarations, matched against the actual
 * symbols present in ps5-payload-sdk's sce_stubs/libSceHttp2.c and the
 * SDK's own samples/http2_get reference example (verified against SDK
 * commit at https://github.com/ps5-payload-dev/sdk, Sept 2026). This
 * replaces the earlier draft's v1-style sceHttp and sceHttps calls, which
 * don't correspond to any confirmed symbol in this SDK. */
extern int sceNetInit(void);
extern int sceNetPoolCreate(const char *name, int size, int flags);
extern int sceNetPoolDestroy(int pool_id);

extern int sceSslInit(size_t pool_size);
extern int sceSslTerm(int ctx_id);

extern int sceHttp2Init(int net_pool_id, int ssl_ctx_id, size_t pool_size, int is_default);
extern int sceHttp2Term(int http_ctx_id);

extern int sceHttp2CreateTemplate(int http_ctx_id, const char *agent, int http_ver, int auto_proxy);
extern int sceHttp2DeleteTemplate(int tmpl_id);

extern int sceHttp2CreateRequestWithURL(int tmpl_id, const char *method, const char *url,
                                         uint64_t content_length);
extern int sceHttp2DeleteRequest(int req_id);

extern int sceHttp2AddRequestHeader(int req_id, const char *name, const char *value, unsigned int mode);
extern int sceHttp2SetRequestContentLength(int req_id, uint64_t content_length);
extern int sceHttp2SendRequest(int req_id, const void *data, size_t data_size);
extern int sceHttp2GetStatusCode(int req_id, int *status);

#define HTTP2_VERSION_1_1 1
#define HTTP2_HEADER_ADD 0

struct config {
    char endpoint[POST_URL_MAX];
    char device_id[DEVICE_ID_MAX];
    char token[TOKEN_MAX];
};

static int mkdir_p(void) {
    if (mkdir(STATE_DIR, 0777) < 0 && errno != EEXIST) {
        fprintf(stderr, "mkdir(%s) failed: errno=%d\n", STATE_DIR, errno);
        return -1;
    }
    return 0;
}

static long long read_cursor(void) {
    FILE *f = fopen(CURSOR_FILE, "r");
    long long n = 0;
    if (!f) return 0;
    if (fscanf(f, "%lld", &n) != 1) n = 0;
    fclose(f);
    return n < 0 ? 0 : n;
}

static int write_cursor(long long n) {
    char tmp[128];
    snprintf(tmp, sizeof(tmp), "%s.tmp", CURSOR_FILE);
    FILE *f = fopen(tmp, "w");
    if (!f) return -1;
    fprintf(f, "%lld\n", n);
    fflush(f);
    fclose(f);
    return rename(tmp, CURSOR_FILE);
}

static int load_config(struct config *c) {
    FILE *f = fopen(CONFIG_FILE, "r");
    char line[640];
    memset(c, 0, sizeof(*c));
    if (!f) {
        fprintf(stderr, "couldn't open %s (errno=%d) -- create it with "
                        "ENDPOINT=/DEVICE_ID=/TOKEN= lines\n", CONFIG_FILE, errno);
        return -1;
    }
    while (fgets(line, sizeof(line), f)) {
        char *eq = strchr(line, '=');
        if (!eq) continue;
        *eq++ = 0;
        char *nl = strpbrk(eq, "\r\n");
        if (nl) *nl = 0;
        if (!strcmp(line, "ENDPOINT")) strncpy(c->endpoint, eq, sizeof(c->endpoint)-1);
        else if (!strcmp(line, "DEVICE_ID")) strncpy(c->device_id, eq, sizeof(c->device_id)-1);
        else if (!strcmp(line, "TOKEN")) strncpy(c->token, eq, sizeof(c->token)-1);
    }
    fclose(f);
    if (!(c->endpoint[0] && c->device_id[0] && c->token[0])) {
        fprintf(stderr, "%s is missing one of ENDPOINT/DEVICE_ID/TOKEN\n", CONFIG_FILE);
    }
    return c->endpoint[0] && c->device_id[0] && c->token[0] ? 0 : -1;
}

static const char *json_string_field(const char *json, const char *key, char *out, size_t out_size) {
    char needle[64];
    snprintf(needle, sizeof(needle), "\"%s\":\"", key);
    const char *p = strstr(json, needle);
    if (!p) return NULL;
    p += strlen(needle);
    size_t i = 0;
    while (*p && *p != '"' && i + 1 < out_size) {
        if (*p == '\\' && p[1]) p++;
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

static void json_escape_append(char *dst, size_t cap, const char *s) {
    size_t n = strlen(dst);
    for (const char *p = s; *p && n + 2 < cap; ++p) {
        if (*p == '"' || *p == '\\') { if (n + 2 >= cap) break; dst[n++]='\\'; }
        dst[n++] = *p;
    }
    dst[n] = 0;
}

static void lookup_title_name(const char *title_id, char *out, size_t out_size) {
    sqlite3 *db = NULL;
    sqlite3_stmt *tables = NULL;
    out[0] = 0;
    if (sqlite3_open_v2(APP_DB, &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX, NULL) != SQLITE_OK) goto done;
    if (sqlite3_prepare_v2(db,
        "select name from sqlite_master where type='table' and name like 'tbl_iconinfo_%' order by name",
        -1, &tables, NULL) != SQLITE_OK) goto done;
    while (sqlite3_step(tables) == SQLITE_ROW) {
        const char *table = (const char *)sqlite3_column_text(tables, 0);
        if (!table) continue;
        char sql[256];
        snprintf(sql, sizeof(sql), "select titleName from \"%s\" where titleId=? limit 1", table);
        sqlite3_stmt *st = NULL;
        if (sqlite3_prepare_v2(db, sql, -1, &st, NULL) != SQLITE_OK) continue;
        sqlite3_bind_text(st, 1, title_id, -1, SQLITE_TRANSIENT);
        if (sqlite3_step(st) == SQLITE_ROW) {
            const char *name = (const char *)sqlite3_column_text(st, 0);
            if (name) strncpy(out, name, out_size - 1);
            out[out_size - 1] = 0;
        }
        sqlite3_finalize(st);
        if (out[0]) break;
    }
done:
    if (tables) sqlite3_finalize(tables);
    if (db) sqlite3_close(db);
}

/* Mirrors the init/request/fini shape of the SDK's own samples/http2_get,
 * the one HTTP example actually confirmed to build against this SDK, rather
 * than an unverified v1 sceHttp API. */
static int post_json(const struct config *cfg, const char *body, size_t body_len) {
    int net_pool = -1, ssl_ctx = -1, http_ctx = -1, tmpl = -1, req = -1;
    int status = -1;
    int rc = -1;

    if (sceNetInit() < 0) {
        fprintf(stderr, "sceNetInit failed\n");
        return -1;
    }

    if ((net_pool = sceNetPoolCreate("savestate-activity", 32 * 1024, 0)) < 0) {
        fprintf(stderr, "sceNetPoolCreate failed: %d\n", net_pool);
        return -1;
    }

    if ((ssl_ctx = sceSslInit(256 * 1024)) < 0) {
        fprintf(stderr, "sceSslInit failed: %d\n", ssl_ctx);
        goto fail;
    }

    if ((http_ctx = sceHttp2Init(net_pool, ssl_ctx, 256 * 1024, 1)) < 0) {
        fprintf(stderr, "sceHttp2Init failed: %d\n", http_ctx);
        goto fail;
    }

    if ((tmpl = sceHttp2CreateTemplate(http_ctx, "SaveState-PS5-Activity/1.0", HTTP2_VERSION_1_1, 1)) < 0) {
        fprintf(stderr, "sceHttp2CreateTemplate failed: %d\n", tmpl);
        goto fail;
    }

    if ((req = sceHttp2CreateRequestWithURL(tmpl, "POST", cfg->endpoint, (uint64_t)body_len)) < 0) {
        fprintf(stderr, "sceHttp2CreateRequestWithURL failed: %d\n", req);
        goto fail;
    }

    sceHttp2AddRequestHeader(req, "Content-Type", "application/json", HTTP2_HEADER_ADD);
    sceHttp2AddRequestHeader(req, "Accept", "application/json", HTTP2_HEADER_ADD);
    sceHttp2AddRequestHeader(req, "X-SaveState-Device-Token", cfg->token, HTTP2_HEADER_ADD);
    sceHttp2SetRequestContentLength(req, (uint64_t)body_len);

    if (sceHttp2SendRequest(req, body, body_len) < 0) {
        fprintf(stderr, "sceHttp2SendRequest failed\n");
        goto fail;
    }

    if (sceHttp2GetStatusCode(req, &status) < 0) {
        fprintf(stderr, "sceHttp2GetStatusCode failed\n");
        goto fail;
    }

    if (status < 200 || status >= 300) {
        fprintf(stderr, "upload rejected, HTTP status %d\n", status);
        rc = -status;
        goto fail;
    }

    rc = 0;

fail:
    if (req >= 0) sceHttp2DeleteRequest(req);
    if (tmpl >= 0) sceHttp2DeleteTemplate(tmpl);
    if (http_ctx >= 0) sceHttp2Term(http_ctx);
    if (ssl_ctx >= 0) sceSslTerm(ssl_ctx);
    if (net_pool >= 0) sceNetPoolDestroy(net_pool);
    return rc;
}

static int sync_once(const struct config *cfg) {
    sqlite3 *db = NULL;
    sqlite3_stmt *st = NULL;
    long long cursor = read_cursor();
    if (sqlite3_open_v2(SL2_DB, &db, SQLITE_OPEN_READONLY | SQLITE_OPEN_NOMUTEX, NULL) != SQLITE_OK) goto fail;

    sqlite3_stmt *maxst = NULL;
    long long max_rowid = cursor;
    if (sqlite3_prepare_v2(db, "select coalesce(max(rowid),0) from tbl_log", -1, &maxst, NULL) == SQLITE_OK) {
        if (sqlite3_step(maxst) == SQLITE_ROW) max_rowid = sqlite3_column_int64(maxst, 0);
        sqlite3_finalize(maxst);
    }
    if (max_rowid < cursor) cursor = 0; /* logger DB was reset/rotated */

    const char *sql = "select rowid, created_date, log from tbl_log "
                      "where event_id='ApplicationSessionEndBi' and rowid>? "
                      "order by rowid asc limit ?";
    if (sqlite3_prepare_v2(db, sql, -1, &st, NULL) != SQLITE_OK) goto fail;
    sqlite3_bind_int64(st, 1, cursor);
    sqlite3_bind_int(st, 2, SCAN_LIMIT);

    char body[128 * 1024];
    snprintf(body, sizeof(body), "{\"schemaVersion\":1,\"deviceId\":\"%s\",\"events\":[", cfg->device_id);
    int count = 0;
    long long last_scanned_rowid = cursor;
    while (sqlite3_step(st) == SQLITE_ROW) {
        long long rowid = sqlite3_column_int64(st, 0);
        if (count >= MAX_BATCH) break;
        const char *created = (const char *)sqlite3_column_text(st, 1);
        const char *log = (const char *)sqlite3_column_text(st, 2);
        if (!log) {
            last_scanned_rowid = rowid;
            continue;
        }
        char title_id[80]; char title_name[240];
        if (!json_string_field(log, "appTitleId", title_id, sizeof(title_id))) {
            last_scanned_rowid = rowid;
            continue;
        }
        int fg = json_int_field(log, "totalFgTime");
        lookup_title_name(title_id, title_name, sizeof(title_name));
        if (count++) strcat(body, ",");
        char esc_name[480] = "";
        json_escape_append(esc_name, sizeof(esc_name), title_name);
        char item[1024];
        if (title_name[0]) {
            snprintf(item, sizeof(item),
                "{\"sourceRowid\":%lld,\"titleId\":\"%s\",\"titleName\":\"%s\",\"createdDate\":\"%s\",\"totalFgTime\":%d}",
                rowid, title_id, esc_name, created ? created : "", fg);
        } else {
            snprintf(item, sizeof(item),
                "{\"sourceRowid\":%lld,\"titleId\":\"%s\",\"titleName\":null,\"createdDate\":\"%s\",\"totalFgTime\":%d}",
                rowid, title_id, created ? created : "", fg);
        }
        if (strlen(body) + strlen(item) + 4 >= sizeof(body)) break;
        strcat(body, item);
        last_scanned_rowid = rowid;
    }
    sqlite3_finalize(st); st = NULL;

    /* We still advance across unrelated/malformed logger rows. The cursor is
     * only committed after a successful upload when there is a batch, or
     * immediately when there was nothing worth uploading. */
    if (!count) {
        sqlite3_close(db);
        return write_cursor(last_scanned_rowid);
    }
    strcat(body, "]}");
    sqlite3_close(db); db = NULL;

    {
        int post_rc = post_json(cfg, body, strlen(body));
        if (post_rc == 0) {
            if (write_cursor(last_scanned_rowid) != 0) {
                fprintf(stderr, "uploaded %d event(s) but failed to write cursor "
                                "(errno=%d) -- next run will resend this batch, "
                                "which the server dedupes safely\n", count, errno);
                return -1;
            }
            fprintf(stderr, "uploaded %d event(s), cursor now at rowid %lld\n",
                    count, last_scanned_rowid);
            return 1;
        }
        fprintf(stderr, "upload failed (rc=%d), cursor not advanced, will retry "
                        "this batch next invocation\n", post_rc);
        return -1;
    }
fail:
    if (st) sqlite3_finalize(st);
    if (db) sqlite3_close(db);
    return -1;
}

int main(void) {
    struct config cfg;
    if (mkdir_p() < 0) return EXIT_FAILURE;
    if (load_config(&cfg) < 0) return EXIT_FAILURE;

    fprintf(stderr, "savestate-activity: starting, endpoint=%s device=%s\n",
            cfg.endpoint, cfg.device_id);

    /* Drain the journal in batches. The payload exits when caught up, so
     * there is no persistent process to die when the console shuts down. */
    int batches = 0;
    for (;;) {
        int rc = sync_once(&cfg);
        if (rc < 0) {
            fprintf(stderr, "savestate-activity: sync failed after %d batch(es), exiting\n",
                    batches);
            return EXIT_FAILURE;
        }
        if (rc == 0) break;
        batches++;
    }
    fprintf(stderr, "savestate-activity: caught up after %d batch(es)\n", batches);
    return EXIT_SUCCESS;
}
