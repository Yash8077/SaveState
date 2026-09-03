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
#include <sys/socket.h>
#include <netdb.h>
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

/* POSIX sockets + plain HTTP. HTTPS/TLS is intentionally not used here. */
extern int sceNetInit(void);
extern int sceNetPoolCreate(const char *name, int size, int flags);
extern int sceNetPoolDestroy(int pool_id);

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

static int parse_http_url(const char *url, char *host, size_t host_cap,
                          int *port, char *path, size_t path_cap) {
    const char *prefix = "http://";
    size_t prefix_len = strlen(prefix);

    if (strncmp(url, prefix, prefix_len) != 0) {
        log_msg("[SaveState] POSIX HTTP requires an http:// endpoint: %s\n", url);
        return -1;
    }

    const char *p = url + prefix_len;
    const char *slash = strchr(p, '/');
    const char *host_end = slash ? slash : p + strlen(p);

    if (host_end == p || (size_t)(host_end - p) >= host_cap)
        return -1;

    const char *colon = memchr(p, ':', (size_t)(host_end - p));
    *port = 80;

    if (colon) {
        size_t host_len = (size_t)(colon - p);
        if (host_len == 0 || host_len >= host_cap)
            return -1;
        memcpy(host, p, host_len);
        host[host_len] = 0;

        char port_buf[16];
        size_t port_len = (size_t)(host_end - colon - 1);
        if (port_len == 0 || port_len >= sizeof(port_buf))
            return -1;
        memcpy(port_buf, colon + 1, port_len);
        port_buf[port_len] = 0;
        *port = atoi(port_buf);
        if (*port <= 0 || *port > 65535)
            return -1;
    } else {
        size_t host_len = (size_t)(host_end - p);
        memcpy(host, p, host_len);
        host[host_len] = 0;
    }

    if (slash)
        snprintf(path, path_cap, "%s", slash);
    else
        snprintf(path, path_cap, "/");

    return 0;
}

static int send_all(int sock, const void *data, size_t len) {
    const char *p = (const char *)data;

    while (len > 0) {
        ssize_t n = send(sock, p, len, 0);
        if (n <= 0)
            return -1;
        p += n;
        len -= (size_t)n;
    }

    return 0;
}

static int post_json(const struct config *cfg, const char *body, size_t body_len) {
    int net_pool = -1;
    int sock = -1;
    int rc = -1;
    char host[256];
    char path[1024];
    int port = 80;

    log_msg("[SaveState] initializing POSIX network\n");

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

    if (parse_http_url(cfg->endpoint, host, sizeof(host), &port,
                       path, sizeof(path)) < 0) {
        log_msg("[SaveState] invalid POSIX HTTP endpoint=%s\n", cfg->endpoint);
        goto fail;
    }

    log_msg("[SaveState] POSIX HTTP target=%s:%d%s\n", host, port, path);

    struct addrinfo hints;
    struct addrinfo *res = NULL;
    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_STREAM;

    char port_str[16];
    snprintf(port_str, sizeof(port_str), "%d", port);

    rc = getaddrinfo(host, port_str, &hints, &res);
    if (rc != 0 || !res) {
        log_msg("[SaveState] getaddrinfo failed for %s:%d rc=%d\n",
                host, port, rc);
        goto fail;
    }

    sock = socket(res->ai_family, res->ai_socktype, res->ai_protocol);
    if (sock < 0) {
        log_msg("[SaveState] socket failed: %d\n", errno);
        freeaddrinfo(res);
        goto fail;
    }

    rc = connect(sock, res->ai_addr, res->ai_addrlen);
    freeaddrinfo(res);
    res = NULL;
    if (rc < 0) {
        log_msg("[SaveState] connect failed: errno=%d\n", errno);
        goto fail;
    }

    char request[2048];
    int request_len = snprintf(
        request, sizeof(request),
        "POST %s HTTP/1.1\r\n"
        "Host: %s\r\n"
        "Content-Type: application/json\r\n"
        "Accept: application/json\r\n"
        "X-SaveState-Device-Token: %s\r\n"
        "Content-Length: %zu\r\n"
        "Connection: close\r\n"
        "\r\n",
        path, host, cfg->token, body_len);

    if (request_len < 0 || (size_t)request_len >= sizeof(request)) {
        log_msg("[SaveState] HTTP request headers too large\n");
        goto fail;
    }

    log_msg("[SaveState] sending POSIX HTTP POST (%zu bytes body)\n", body_len);

    if (send_all(sock, request, (size_t)request_len) < 0 ||
        send_all(sock, body, body_len) < 0) {
        log_msg("[SaveState] send failed: errno=%d\n", errno);
        goto fail;
    }

    char response[4096];
    size_t used = 0;
    int status = -1;

    for (;;) {
        if (used + 1 >= sizeof(response)) {
            log_msg("[SaveState] HTTP response headers too large\n");
            goto fail;
        }

        ssize_t n = recv(sock, response + used, sizeof(response) - used - 1, 0);
        if (n <= 0)
            break;

        used += (size_t)n;
        response[used] = 0;

        char *line_end = strstr(response, "\r\n");
        if (line_end) {
            *line_end = 0;
            if (sscanf(response, "HTTP/%*s %d", &status) != 1)
                status = -1;
            *line_end = '\r';

            if (strstr(response, "\r\n\r\n"))
                break;
        }
    }

    if (status < 0) {
        log_msg("[SaveState] couldn't parse HTTP response; bytes=%zu\n", used);
        goto fail;
    }

    log_msg("[SaveState] POSIX HTTP status=%d\n", status);

    if (status < 200 || status >= 300) {
        log_msg("[SaveState] upload rejected, HTTP status=%d\n", status);
        rc = -status;
        goto fail;
    }

    rc = 0;

fail:
    if (sock >= 0)
        close(sock);
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

    log_msg("[SaveState POSIX-HTTP TEST v1] activity logger starting\n");

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