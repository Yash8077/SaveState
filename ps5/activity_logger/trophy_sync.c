/* SaveState PS5 local trophy scanner.
 *
 * Trophy screenshot .ext files are treated as a discovery source, not as the
 * source of truth for trophy progress. The backend database is authoritative.
 *
 * The payload keeps a durable local record of processed .ext fingerprints in:
 *
 *     /data/savestate-sync/trophy-sync.state
 *
 * Only unprocessed discoveries are sent. A successful HTTP 200 is required
 * before a fingerprint is durably marked processed. A duplicate retry is
 * always safe because the server uses idempotent trophy upserts.
 *
 * HTTP 409 means ONLY "trophy sync lock is busy". It is not a duplicate or
 * already-recorded response and therefore must remain pending for a later run.
 *
 * This payload never deletes or modifies PS5 media files. Manual screenshot
 * deletion cannot remove trophy progress already recorded by SaveState.
 */
#include <ctype.h>
#include <curl/curl.h>
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#define TROPHY_PHOTO_ROOT "/user/av_contents/photo"
#define STATE_DIR "/data/savestate-sync"
#define CONFIG_FILE STATE_DIR "/config"
#define TROPHY_LOG_FILE STATE_DIR "/trophy-sync.log"
#define TROPHY_STATE_FILE STATE_DIR "/trophy-sync.state"

#define URL_MAX 512
#define TOKEN_MAX 256
#define DEVICE_ID_MAX 64
#define MAX_GROUPS 512
#define MAX_TROPHIES_PER_GROUP 2000
#define MAX_SOURCES_PER_GROUP 4096
#define MAX_JSON_FILE (256 * 1024)
#define INITIAL_BODY_CAP (64 * 1024)
#define RESPONSE_CAP (32 * 1024)

typedef struct {
    char endpoint[URL_MAX];
    char device_id[DEVICE_ID_MAX];
    char token[TOKEN_MAX];
} trophy_config;

typedef struct {
    char title_id[64];
    char trophy_title_id[64];
    int trophy_ids[MAX_TROPHIES_PER_GROUP];
    size_t trophy_count;
    uint64_t source_fingerprints[MAX_SOURCES_PER_GROUP];
    size_t source_count;
} trophy_group;

typedef struct {
    char *data;
    size_t len;
    size_t cap;
} string_builder;

typedef struct {
    uint64_t *values;
    size_t count;
    size_t cap;
} fingerprint_set;

typedef struct {
    char *data;
    size_t len;
    size_t cap;
} response_buffer;

typedef enum {
    POST_OK = 0,
    POST_BUSY = 1,
    POST_FAILED = -1
} post_result;

static trophy_group groups[MAX_GROUPS];
static size_t group_count = 0;
static fingerprint_set processed = {0};

static void trophy_log(const char *fmt, ...) {
    char line[1024];
    va_list ap;

    va_start(ap, fmt);
    vsnprintf(line, sizeof(line), fmt, ap);
    va_end(ap);

    fprintf(stderr, "%s", line);

    FILE *f = fopen(TROPHY_LOG_FILE, "a");
    if (f) {
        fputs(line, f);
        fflush(f);
        fclose(f);
    }
}

static void trim_newline(char *s) {
    char *p = strpbrk(s, "\r\n");
    if (p) *p = 0;
}

static int load_trophy_config(trophy_config *cfg) {
    FILE *f = fopen(CONFIG_FILE, "r");
    if (!f) return -1;

    memset(cfg, 0, sizeof(*cfg));

    char line[640];
    while (fgets(line, sizeof(line), f)) {
        char *eq = strchr(line, '=');
        if (!eq) continue;

        *eq++ = 0;
        trim_newline(eq);

        if (!strcmp(line, "ENDPOINT")) {
            strncpy(cfg->endpoint, eq, sizeof(cfg->endpoint) - 1);
        } else if (!strcmp(line, "DEVICE_ID")) {
            strncpy(cfg->device_id, eq, sizeof(cfg->device_id) - 1);
        } else if (!strcmp(line, "TOKEN")) {
            strncpy(cfg->token, eq, sizeof(cfg->token) - 1);
        }
    }

    fclose(f);
    return cfg->endpoint[0] && cfg->device_id[0] && cfg->token[0] ? 0 : -1;
}

static int derive_trophy_endpoint(
    const char *endpoint,
    char *out,
    size_t cap
) {
    const char *needle = "/api/activity/ingest";
    const char *p = strstr(endpoint, needle);
    if (!p) return -1;

    const size_t prefix = (size_t)(p - endpoint);
    const char *suffix = "/api/trophies/sync";

    if (prefix + strlen(suffix) + 1 > cap) return -1;

    memcpy(out, endpoint, prefix);
    out[prefix] = 0;
    strcat(out, suffix);
    return 0;
}

static size_t read_text_file(
    const char *path,
    char *out,
    size_t cap
) {
    FILE *f = fopen(path, "r");
    if (!f) return 0;

    size_t n = fread(out, 1, cap - 1, f);
    out[n] = 0;
    fclose(f);
    return n;
}

static int extract_string_field(
    const char *json,
    const char *key,
    char *out,
    size_t cap
) {
    char needle[96];
    snprintf(needle, sizeof(needle), "\"%s\":\"", key);

    const char *p = strstr(json, needle);
    if (!p) return -1;
    p += strlen(needle);

    size_t n = 0;
    while (*p && *p != '"' && n + 1 < cap) {
        if (*p == '\\' && p[1]) p++;
        out[n++] = *p++;
    }

    out[n] = 0;
    return n > 0 ? 0 : -1;
}

static int extract_int_after(
    const char *from,
    const char *key,
    int *value
) {
    char needle[96];
    snprintf(needle, sizeof(needle), "\"%s\":", key);

    const char *p = strstr(from, needle);
    if (!p) return -1;

    *value = atoi(p + strlen(needle));
    return 0;
}

static void normalize_title_id(char *id) {
    for (char *p = id; *p; ++p)
        *p = (char)toupper((unsigned char)*p);

    size_t n = strlen(id);
    if (n > 3 && !strcmp(id + n - 3, "_00"))
        id[n - 3] = 0;
}

static void normalize_trophy_title_id(char *id) {
    for (char *p = id; *p; ++p)
        *p = (char)toupper((unsigned char)*p);

    while (*id && isspace((unsigned char)*id))
        memmove(id, id + 1, strlen(id));

    size_t n = strlen(id);
    while (n > 0 && isspace((unsigned char)id[n - 1]))
        id[--n] = 0;
}

static int looks_like_title_id(const char *s) {
    if (!s || !s[0]) return 0;
    return strncasecmp(s, "CUSA", 4) == 0 ||
           strncasecmp(s, "PPSA", 4) == 0;
}

static int extract_title_id_from_path(
    const char *path,
    char *out,
    size_t cap
) {
    const char *p = path;

    while (*p) {
        if (!strncasecmp(p, "CUSA", 4) ||
            !strncasecmp(p, "PPSA", 4)) {
            size_t i = 0;
            while (p[i] &&
                   (isalnum((unsigned char)p[i]) || p[i] == '_') &&
                   i + 1 < cap) {
                out[i] = p[i];
                i++;
            }
            out[i] = 0;

            if (looks_like_title_id(out)) {
                normalize_title_id(out);
                return 0;
            }
        }
        ++p;
    }

    return -1;
}

static int find_group(
    const char *title_id,
    const char *trophy_title_id
) {
    for (size_t i = 0; i < group_count; ++i) {
        if (!strcmp(groups[i].title_id, title_id) &&
            !strcmp(groups[i].trophy_title_id, trophy_title_id)) {
            return (int)i;
        }
    }
    return -1;
}

static int get_or_add_group(
    const char *title_id,
    const char *trophy_title_id
) {
    int idx = find_group(title_id, trophy_title_id);
    if (idx >= 0) return idx;

    if (group_count >= MAX_GROUPS) {
        trophy_log(
            "[SaveState Trophy] group limit reached; dropping %s -> %s\n",
            title_id,
            trophy_title_id
        );
        return -1;
    }

    idx = (int)group_count++;
    memset(&groups[idx], 0, sizeof(groups[idx]));
    strncpy(groups[idx].title_id, title_id,
            sizeof(groups[idx].title_id) - 1);
    strncpy(groups[idx].trophy_title_id, trophy_title_id,
            sizeof(groups[idx].trophy_title_id) - 1);

    return idx;
}

static int add_trophy(int group_idx, int trophy_id) {
    trophy_group *group = &groups[group_idx];

    for (size_t i = 0; i < group->trophy_count; ++i) {
        if (group->trophy_ids[i] == trophy_id)
            return 0;
    }

    if (group->trophy_count >= MAX_TROPHIES_PER_GROUP)
        return -1;

    group->trophy_ids[group->trophy_count++] = trophy_id;
    return 1;
}

static int add_source_fingerprint(int group_idx, uint64_t fingerprint) {
    trophy_group *group = &groups[group_idx];

    for (size_t i = 0; i < group->source_count; ++i) {
        if (group->source_fingerprints[i] == fingerprint)
            return 0;
    }

    if (group->source_count >= MAX_SOURCES_PER_GROUP)
        return -1;

    group->source_fingerprints[group->source_count++] = fingerprint;
    return 1;
}

static uint64_t fnv1a_append(
    uint64_t hash,
    const unsigned char *data,
    size_t len
) {
    for (size_t i = 0; i < len; ++i) {
        hash ^= (uint64_t)data[i];
        hash *= UINT64_C(1099511628211);
    }
    return hash;
}

static uint64_t file_fingerprint(
    const char *path,
    const char *contents,
    size_t contents_len
) {
    uint64_t hash = UINT64_C(1469598103934665603);
    hash = fnv1a_append(hash, (const unsigned char *)path, strlen(path));
    hash = fnv1a_append(hash, (const unsigned char *)"\0", 1);
    hash = fnv1a_append(hash,
                        (const unsigned char *)contents,
                        contents_len);
    return hash;
}

static int fingerprint_compare(const void *a, const void *b) {
    const uint64_t av = *(const uint64_t *)a;
    const uint64_t bv = *(const uint64_t *)b;
    return av < bv ? -1 : (av > bv ? 1 : 0);
}

static int fingerprint_set_add(
    fingerprint_set *set,
    uint64_t value
) {
    if (set->count == set->cap) {
        size_t new_cap = set->cap ? set->cap * 2 : 256;
        uint64_t *grown =
            (uint64_t *)realloc(set->values, new_cap * sizeof(uint64_t));
        if (!grown) return -1;
        set->values = grown;
        set->cap = new_cap;
    }

    set->values[set->count++] = value;
    return 0;
}

static int fingerprint_set_contains(
    const fingerprint_set *set,
    uint64_t value
) {
    return bsearch(
        &value,
        set->values,
        set->count,
        sizeof(uint64_t),
        fingerprint_compare
    ) != NULL;
}

static void free_processed_state(void) {
    free(processed.values);
    processed.values = NULL;
    processed.count = 0;
    processed.cap = 0;
}

static int load_processed_state(void) {
    FILE *f = fopen(TROPHY_STATE_FILE, "r");
    if (!f) return 0;

    char line[64];
    while (fgets(line, sizeof(line), f)) {
        char *end = NULL;
        errno = 0;
        uint64_t value = strtoull(line, &end, 16);
        if (errno == 0 && end != line)
            (void)fingerprint_set_add(&processed, value);
    }

    fclose(f);
    qsort(processed.values, processed.count,
          sizeof(uint64_t), fingerprint_compare);
    return 0;
}

/*
 * The state file is append-only. fsync is required before this function
 * reports success, otherwise a crash/power loss can leave a false local
 * acknowledgement behind. A failed fsync simply causes a safe duplicate
 * transmission next time because the server is idempotent.
 */
static int persist_processed_fingerprint(uint64_t fingerprint) {
    int fd = open(
        TROPHY_STATE_FILE,
        O_WRONLY | O_CREAT | O_APPEND,
        0666
    );
    if (fd < 0) return -1;

    char line[32];
    const int len = snprintf(
        line,
        sizeof(line),
        "%016" PRIx64 "\n",
        fingerprint
    );

    const ssize_t written = write(fd, line, (size_t)len);
    if (written != len) {
        close(fd);
        return -1;
    }

    if (fsync(fd) < 0) {
        close(fd);
        return -1;
    }

    if (close(fd) < 0)
        return -1;

    return 0;
}

static void process_ext(const char *ext_path) {
    char json[MAX_JSON_FILE];
    const size_t json_len = read_text_file(
        ext_path,
        json,
        sizeof(json)
    );
    if (json_len == 0) {
        trophy_log(
            "[SaveState Trophy] failed to read %s\n",
            ext_path
        );
        return;
    }

    const uint64_t fingerprint = file_fingerprint(
        ext_path,
        json,
        json_len
    );

    if (fingerprint_set_contains(&processed, fingerprint))
        return;

    char trophy_title_id[64] = {0};
    if (extract_string_field(
            json,
            "trophyTitleId",
            trophy_title_id,
            sizeof(trophy_title_id)) < 0) {
        return;
    }

    normalize_trophy_title_id(trophy_title_id);
    if (!trophy_title_id[0]) return;

    char meta_path[1024];
    strncpy(meta_path, ext_path, sizeof(meta_path) - 1);
    meta_path[sizeof(meta_path) - 1] = 0;

    char *dot = strrchr(meta_path, '.');
    if (!dot) return;
    strcpy(dot, ".meta");

    char title_id[64] = {0};
    char meta[MAX_JSON_FILE];
    if (read_text_file(meta_path, meta, sizeof(meta)) > 0) {
        (void)extract_string_field(
            meta,
            "appVerTitleId",
            title_id,
            sizeof(title_id)
        );
    }

    if (!title_id[0]) {
        (void)extract_title_id_from_path(
            ext_path,
            title_id,
            sizeof(title_id)
        );
    }

    if (!title_id[0]) {
        trophy_log(
            "[SaveState Trophy] no Title ID for %s\n",
            ext_path
        );
        return;
    }

    normalize_title_id(title_id);

    const int group_idx = get_or_add_group(title_id, trophy_title_id);
    if (group_idx < 0) return;

    int new_ids = 0;
    const char *p = json;

    while ((p = strstr(p, "\"trophyId\":")) != NULL) {
        int trophy_id = 0;
        if (extract_int_after(p, "trophyId", &trophy_id) == 0) {
            const int added = add_trophy(group_idx, trophy_id);
            if (added > 0) new_ids++;
        }
        p += strlen("\"trophyId\":");
    }

    if (new_ids == 0)
        return;

    if (add_source_fingerprint(group_idx, fingerprint) < 0) {
        trophy_log(
            "[SaveState Trophy] source limit reached for %s -> %s\n",
            title_id,
            trophy_title_id
        );
        return;
    }

    trophy_log(
        "[SaveState Trophy] pending %s -> %s: +%d trophy ID(s)\n",
        title_id,
        trophy_title_id,
        new_ids
    );
}

static void walk_photos(const char *dir_path, size_t *ext_count) {
    DIR *dir = opendir(dir_path);
    if (!dir) return;

    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL) {
        if (!strcmp(entry->d_name, ".") ||
            !strcmp(entry->d_name, ".."))
            continue;

        char path[1024];
        snprintf(path, sizeof(path), "%s/%s", dir_path, entry->d_name);

        struct stat st;
        if (stat(path, &st) < 0) continue;

        if (S_ISDIR(st.st_mode)) {
            walk_photos(path, ext_count);
            continue;
        }

        const size_t n = strlen(entry->d_name);
        if (n >= 4 &&
            !strcasecmp(entry->d_name + n - 4, ".ext")) {
            (*ext_count)++;
            process_ext(path);
        }
    }

    closedir(dir);
}

static void sb_init(string_builder *sb) {
    sb->data = (char *)calloc(1, INITIAL_BODY_CAP);
    sb->len = 0;
    sb->cap = sb->data ? INITIAL_BODY_CAP : 0;
}

static void sb_free(string_builder *sb) {
    free(sb->data);
    sb->data = NULL;
    sb->len = 0;
    sb->cap = 0;
}

static int sb_reserve(string_builder *sb, size_t extra) {
    if (extra <= sb->cap - sb->len) return 0;

    size_t needed = sb->len + extra;
    size_t new_cap = sb->cap ? sb->cap : INITIAL_BODY_CAP;

    while (new_cap < needed) {
        if (new_cap > SIZE_MAX / 2) return -1;
        new_cap *= 2;
    }

    char *grown = (char *)realloc(sb->data, new_cap);
    if (!grown) return -1;

    sb->data = grown;
    sb->cap = new_cap;
    return 0;
}

static int sb_append(string_builder *sb, const char *text) {
    const size_t n = strlen(text);
    if (sb_reserve(sb, n + 1) < 0) return -1;

    memcpy(sb->data + sb->len, text, n);
    sb->len += n;
    sb->data[sb->len] = 0;
    return 0;
}

static int sb_appendf(string_builder *sb, const char *fmt, ...) {
    va_list ap;
    va_list copy;

    va_start(ap, fmt);
    va_copy(copy, ap);
    const int needed = vsnprintf(NULL, 0, fmt, copy);
    va_end(copy);

    if (needed < 0) {
        va_end(ap);
        return -1;
    }

    if (sb_reserve(sb, (size_t)needed + 1) < 0) {
        va_end(ap);
        return -1;
    }

    vsnprintf(sb->data + sb->len, sb->cap - sb->len, fmt, ap);
    va_end(ap);
    sb->len += (size_t)needed;
    return 0;
}

static void json_escape(char *dst, size_t cap, const char *src) {
    size_t n = 0;
    if (cap == 0) return;

    for (const char *p = src; *p && n + 2 < cap; ++p) {
        if (*p == '"' || *p == '\\')
            dst[n++] = '\\';
        dst[n++] = *p;
    }
    dst[n] = 0;
}

static size_t capture_body(
    void *ptr,
    size_t size,
    size_t nmemb,
    void *userdata
) {
    response_buffer *response = (response_buffer *)userdata;
    const size_t incoming = size * nmemb;

    if (response->len >= response->cap - 1)
        return incoming;

    size_t available = response->cap - response->len - 1;
    size_t copy_len = incoming < available ? incoming : available;
    memcpy(response->data + response->len, ptr, copy_len);
    response->len += copy_len;
    response->data[response->len] = 0;

    return incoming;
}

static int response_buffer_init(response_buffer *response) {
    response->data = (char *)calloc(1, RESPONSE_CAP);
    response->len = 0;
    response->cap = response->data ? RESPONSE_CAP : 0;
    return response->data ? 0 : -1;
}

static void response_buffer_free(response_buffer *response) {
    free(response->data);
    response->data = NULL;
    response->len = 0;
    response->cap = 0;
}

static post_result post_trophy_sync(
    const trophy_config *cfg,
    const char *endpoint
) {
    string_builder body;
    sb_init(&body);
    if (!body.data) return POST_FAILED;

    char device_id[DEVICE_ID_MAX * 2];
    json_escape(device_id, sizeof(device_id), cfg->device_id);

    if (sb_appendf(
            &body,
            "{\"schemaVersion\":1,\"deviceId\":\"%s\",\"games\":[",
            device_id) < 0) {
        sb_free(&body);
        return POST_FAILED;
    }

    size_t emitted = 0;
    for (size_t i = 0; i < group_count; ++i) {
        trophy_group *group = &groups[i];
        if (!group->title_id[0] || !group->trophy_title_id[0] ||
            group->trophy_count == 0)
            continue;

        char title[128];
        char npwr[128];
        json_escape(title, sizeof(title), group->title_id);
        json_escape(npwr, sizeof(npwr), group->trophy_title_id);

        if (emitted > 0 && sb_append(&body, ",") < 0) {
            sb_free(&body);
            return POST_FAILED;
        }

        if (sb_appendf(
                &body,
                "{\"titleId\":\"%s\",\"trophyTitleId\":\"%s\",\"trophyIds\":[",
                title,
                npwr) < 0) {
            sb_free(&body);
            return POST_FAILED;
        }

        for (size_t t = 0; t < group->trophy_count; ++t) {
            if (t > 0 && sb_append(&body, ",") < 0) {
                sb_free(&body);
                return POST_FAILED;
            }
            if (sb_appendf(&body, "%d", group->trophy_ids[t]) < 0) {
                sb_free(&body);
                return POST_FAILED;
            }
        }

        if (sb_append(&body, "]}") < 0) {
            sb_free(&body);
            return POST_FAILED;
        }

        emitted++;
    }

    if (sb_append(&body, "]}") < 0) {
        sb_free(&body);
        return POST_FAILED;
    }

    CURL *curl = curl_easy_init();
    if (!curl) {
        sb_free(&body);
        return POST_FAILED;
    }

    response_buffer response;
    if (response_buffer_init(&response) < 0) {
        curl_easy_cleanup(curl);
        sb_free(&body);
        return POST_FAILED;
    }

    struct curl_slist *headers = NULL;
    char auth[512];
    snprintf(
        auth,
        sizeof(auth),
        "X-SaveState-Device-Token: %s",
        cfg->token
    );

    headers = curl_slist_append(headers, "Content-Type: application/json");
    headers = curl_slist_append(headers, "Accept: application/json");
    headers = curl_slist_append(headers, auth);

    long status = 0;
    CURLcode rc;

    curl_easy_setopt(curl, CURLOPT_URL, endpoint);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.data);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE_LARGE, (curl_off_t)body.len);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, capture_body);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, "SaveState-PS5-Trophy/1.2");
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

    /* Existing SaveState PS5 payload behavior does not depend on a CA bundle. */
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);

    rc = curl_easy_perform(curl);
    if (rc == CURLE_OK)
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status);

    if (rc != CURLE_OK) {
        trophy_log(
            "[SaveState Trophy] POST transport failure curl=%d (%s)\n",
            (int)rc,
            curl_easy_strerror(rc)
        );
        response_buffer_free(&response);
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        sb_free(&body);
        return POST_FAILED;
    }

    trophy_log(
        "[SaveState Trophy] POST status=%ld sets=%zu body=%zu bytes response=%.*s\n",
        status,
        emitted,
        body.len,
        (int)(response.len > 512 ? 512 : response.len),
        response.data ? response.data : ""
    );

    post_result result = POST_FAILED;
    if (status == 200) {
        result = POST_OK;
    } else if (status == 409) {
        result = POST_BUSY;
        trophy_log(
            "[SaveState Trophy] server busy (409/SYNC_LOCKED); local work remains pending\n"
        );
    } else if (status == 207) {
        trophy_log(
            "[SaveState Trophy] partial sync (207); local work remains pending\n"
        );
    }

    response_buffer_free(&response);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    sb_free(&body);
    return result;
}

static int mark_group_processed(const trophy_group *group) {
    for (size_t i = 0; i < group->source_count; ++i) {
        const uint64_t fingerprint = group->source_fingerprints[i];

        if (fingerprint_set_contains(&processed, fingerprint))
            continue;

        if (persist_processed_fingerprint(fingerprint) < 0) {
            trophy_log(
                "[SaveState Trophy] failed to persist processed fingerprint=%016" PRIx64 "\n",
                fingerprint
            );
            return -1;
        }

        if (fingerprint_set_add(&processed, fingerprint) < 0) {
            trophy_log(
                "[SaveState Trophy] processed fingerprint memory update failed; duplicate will be safe on retry\n"
            );
            return -1;
        }
    }

    return 0;
}

static void reset_scan_state(void) {
    group_count = 0;
    memset(groups, 0, sizeof(groups));
}

static void sync_trophies_once(void) {
    trophy_config cfg;

    if (load_trophy_config(&cfg) < 0) {
        trophy_log(
            "[SaveState Trophy] activity config missing/invalid; trophy scan skipped\n"
        );
        return;
    }

    char endpoint[URL_MAX];
    if (derive_trophy_endpoint(cfg.endpoint, endpoint, sizeof(endpoint)) < 0) {
        trophy_log(
            "[SaveState Trophy] couldn't derive /api/trophies/sync from ENDPOINT\n"
        );
        return;
    }

    reset_scan_state();

    size_t ext_count = 0;
    walk_photos(TROPHY_PHOTO_ROOT, &ext_count);

    trophy_log(
        "[SaveState Trophy] scanned %zu .ext file(s), found %zu pending title/NPWR set(s)\n",
        ext_count,
        group_count
    );

    if (group_count == 0) {
        trophy_log(
            "[SaveState Trophy] no pending trophy discoveries found\n"
        );
        return;
    }

    const post_result result = post_trophy_sync(&cfg, endpoint);

    if (result == POST_OK) {
        int persist_failed = 0;
        for (size_t i = 0; i < group_count; ++i) {
            if (mark_group_processed(&groups[i]) < 0) {
                persist_failed = 1;
                break;
            }
        }

        if (persist_failed) {
            trophy_log(
                "[SaveState Trophy] server accepted upload, but local processed state was not fully persisted; duplicate retry is expected\n"
            );
        } else {
            trophy_log(
                "[SaveState Trophy] trophy upload accepted and local discoveries marked processed\n"
            );
        }
    } else if (result == POST_BUSY) {
        trophy_log(
            "[SaveState Trophy] sync deferred; pending discoveries retained for the next payload run\n"
        );
    } else {
        trophy_log(
            "[SaveState Trophy] trophy upload failed; pending discoveries retained\n"
        );
    }
}

__attribute__((constructor))
static void savestate_trophy_sync_constructor(void) {
    (void)mkdir(STATE_DIR, 0777);

    if (load_processed_state() < 0)
        trophy_log("[SaveState Trophy] couldn't load local processed state\n");

    curl_global_init(CURL_GLOBAL_DEFAULT);
    sync_trophies_once();
    curl_global_cleanup();
    free_processed_state();
}
