/* SaveState PS5 local trophy scanner.
 *
 * Scans every trophy screenshot .ext sidecar under /user/av_contents/photo.
 * The PlayStation application Title ID (CUSA/PPSA) is NOT the trophy-set
 * identity: a single title can contain multiple NPWR trophy sets (for example
 * a collection). Each scan group is therefore keyed by:
 *
 *     title_id + trophy_title_id
 *
 * Every .ext is read once, trophy IDs are deduplicated in memory, and a single
 * POST is sent after the filesystem scan completes.
 *
 * This deliberately does not delete or modify PS5 media files.
 */
#include <ctype.h>
#include <curl/curl.h>
#include <dirent.h>
#include <errno.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/stat.h>
#include <unistd.h>

#define TROPHY_PHOTO_ROOT "/user/av_contents/photo"
#define STATE_DIR "/data/savestate-sync"
#define CONFIG_FILE STATE_DIR "/config"
#define TROPHY_LOG_FILE STATE_DIR "/trophy-sync.log"

#define URL_MAX 512
#define TOKEN_MAX 256
#define DEVICE_ID_MAX 64
#define MAX_GROUPS 512
#define MAX_TROPHIES_PER_GROUP 2000
#define MAX_JSON_FILE (256 * 1024)
#define INITIAL_BODY_CAP (64 * 1024)

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
} trophy_group;

typedef struct {
    char *data;
    size_t len;
    size_t cap;
} string_builder;

static trophy_group groups[MAX_GROUPS];
static size_t group_count = 0;

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

static int read_text_file(const char *path, char *out, size_t cap) {
    FILE *f = fopen(path, "r");
    if (!f) return -1;

    size_t n = fread(out, 1, cap - 1, f);
    out[n] = 0;
    fclose(f);
    return 0;
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

/*
 * Trophy-set identity is title_id + trophy_title_id.
 *
 * This is the critical difference from the previous implementation, which
 * keyed only by title_id and therefore merged/dropped multiple NPWR sets that
 * shared a CUSA/PPSA.
 */
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
    if (idx >= 0)
        return idx;

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

    strncpy(
        groups[idx].title_id,
        title_id,
        sizeof(groups[idx].title_id) - 1
    );
    strncpy(
        groups[idx].trophy_title_id,
        trophy_title_id,
        sizeof(groups[idx].trophy_title_id) - 1
    );

    trophy_log(
        "[SaveState Trophy] discovered trophy set %s -> %s\n",
        groups[idx].title_id,
        groups[idx].trophy_title_id
    );

    return idx;
}

/* Return 1 only when a new trophy ID was added. */
static int add_trophy(int group_idx, int trophy_id) {
    trophy_group *group = &groups[group_idx];

    for (size_t i = 0; i < group->trophy_count; ++i) {
        if (group->trophy_ids[i] == trophy_id)
            return 0;
    }

    if (group->trophy_count >= MAX_TROPHIES_PER_GROUP) {
        trophy_log(
            "[SaveState Trophy] trophy limit reached for %s -> %s\n",
            group->title_id,
            group->trophy_title_id
        );
        return -1;
    }

    group->trophy_ids[group->trophy_count++] = trophy_id;
    return 1;
}

static void process_ext(const char *ext_path) {
    char json[MAX_JSON_FILE];

    if (read_text_file(ext_path, json, sizeof(json)) < 0) {
        trophy_log(
            "[SaveState Trophy] failed to read %s\n",
            ext_path
        );
        return;
    }

    char trophy_title_id[64] = {0};
    if (extract_string_field(
            json,
            "trophyTitleId",
            trophy_title_id,
            sizeof(trophy_title_id)
        ) < 0) {
        return;
    }

    normalize_trophy_title_id(trophy_title_id);
    if (!trophy_title_id[0])
        return;

    char meta_path[1024];
    strncpy(meta_path, ext_path, sizeof(meta_path) - 1);
    meta_path[sizeof(meta_path) - 1] = 0;

    char *dot = strrchr(meta_path, '.');
    if (!dot)
        return;

    strcpy(dot, ".meta");

    char title_id[64] = {0};
    char meta[MAX_JSON_FILE];

    if (read_text_file(meta_path, meta, sizeof(meta)) == 0) {
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
    if (group_idx < 0)
        return;

    int new_ids = 0;
    const char *p = json;

    while ((p = strstr(p, "\"trophyId\":")) != NULL) {
        int trophy_id = 0;

        if (extract_int_after(p, "trophyId", &trophy_id) == 0) {
            const int added = add_trophy(group_idx, trophy_id);
            if (added > 0)
                new_ids++;
        }

        p += strlen("\"trophyId\":");
    }

    if (new_ids > 0) {
        trophy_log(
            "[SaveState Trophy] %s -> %s: +%d new trophy ID(s)\n",
            title_id,
            trophy_title_id,
            new_ids
        );
    }
}

static void walk_photos(const char *dir_path, size_t *ext_count) {
    DIR *dir = opendir(dir_path);
    if (!dir)
        return;

    struct dirent *entry;

    while ((entry = readdir(dir)) != NULL) {
        if (!strcmp(entry->d_name, ".") ||
            !strcmp(entry->d_name, ".."))
            continue;

        char path[1024];
        snprintf(
            path,
            sizeof(path),
            "%s/%s",
            dir_path,
            entry->d_name
        );

        struct stat st;
        if (stat(path, &st) < 0)
            continue;

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
    if (extra <= sb->cap - sb->len)
        return 0;

    size_t needed = sb->len + extra;
    size_t new_cap = sb->cap ? sb->cap : INITIAL_BODY_CAP;

    while (new_cap < needed) {
        if (new_cap > (SIZE_MAX / 2))
            return -1;
        new_cap *= 2;
    }

    char *grown = (char *)realloc(sb->data, new_cap);
    if (!grown)
        return -1;

    sb->data = grown;
    sb->cap = new_cap;
    return 0;
}

static int sb_append(string_builder *sb, const char *text) {
    const size_t n = strlen(text);

    if (sb_reserve(sb, n + 1) < 0)
        return -1;

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

static void json_escape(
    char *dst,
    size_t cap,
    const char *src
) {
    size_t n = 0;

    if (cap == 0) return;

    for (const char *p = src; *p && n + 2 < cap; ++p) {
        if (*p == '"' || *p == '\\')
            dst[n++] = '\\';
        dst[n++] = *p;
    }

    dst[n] = 0;
}

static size_t discard_body(
    void *ptr,
    size_t size,
    size_t nmemb,
    void *userdata
) {
    (void)ptr;
    (void)userdata;
    return size * nmemb;
}

static int post_trophy_sync(
    const trophy_config *cfg,
    const char *endpoint
) {
    string_builder body;
    sb_init(&body);

    if (!body.data)
        return -1;

    char device_id[DEVICE_ID_MAX * 2];
    json_escape(device_id, sizeof(device_id), cfg->device_id);

    if (sb_appendf(
            &body,
            "{\"schemaVersion\":1,\"deviceId\":\"%s\",\"games\":[",
            device_id
        ) < 0) {
        sb_free(&body);
        return -1;
    }

    size_t emitted = 0;

    for (size_t i = 0; i < group_count; ++i) {
        trophy_group *group = &groups[i];

        if (!group->title_id[0] ||
            !group->trophy_title_id[0] ||
            group->trophy_count == 0) {
            continue;
        }

        char title[128];
        char npwr[128];
        json_escape(title, sizeof(title), group->title_id);
        json_escape(npwr, sizeof(npwr), group->trophy_title_id);

        if (emitted > 0) {
            if (sb_append(&body, ",") < 0) {
                sb_free(&body);
                return -1;
            }
        }

        if (sb_appendf(
                &body,
                "{\"titleId\":\"%s\",\"trophyTitleId\":\"%s\",\"trophyIds\":[",
                title,
                npwr
            ) < 0) {
            sb_free(&body);
            return -1;
        }

        for (size_t t = 0; t < group->trophy_count; ++t) {
            if (t > 0 && sb_append(&body, ",") < 0) {
                sb_free(&body);
                return -1;
            }

            if (sb_appendf(
                    &body,
                    "%d",
                    group->trophy_ids[t]
                ) < 0) {
                sb_free(&body);
                return -1;
            }
        }

        if (sb_append(&body, "]}") < 0) {
            sb_free(&body);
            return -1;
        }

        emitted++;
    }

    if (sb_append(&body, "]}") < 0) {
        sb_free(&body);
        return -1;
    }

    CURL *curl = curl_easy_init();
    if (!curl) {
        sb_free(&body);
        return -1;
    }

    struct curl_slist *headers = NULL;
    char auth[512];

    snprintf(
        auth,
        sizeof(auth),
        "X-SaveState-Device-Token: %s",
        cfg->token
    );

    headers = curl_slist_append(
        headers,
        "Content-Type: application/json"
    );
    headers = curl_slist_append(
        headers,
        "Accept: application/json"
    );
    headers = curl_slist_append(headers, auth);

    long status = 0;

    curl_easy_setopt(curl, CURLOPT_URL, endpoint);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.data);
    curl_easy_setopt(
        curl,
        CURLOPT_POSTFIELDSIZE_LARGE,
        (curl_off_t)body.len
    );
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, discard_body);
    curl_easy_setopt(
        curl,
        CURLOPT_USERAGENT,
        "SaveState-PS5-Trophy/1.1"
    );
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

    /*
     * Existing SaveState PS5 payload behavior uses the PS5 cURL/TLS stack
     * without requiring a CA bundle on the console.
     */
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);

    CURLcode rc = curl_easy_perform(curl);

    if (rc == CURLE_OK)
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status);

    trophy_log(
        "[SaveState Trophy] POST status=%ld sets=%zu ext_scan complete body=%zu bytes\n",
        status,
        emitted,
        body.len
    );

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    sb_free(&body);

    return rc == CURLE_OK && status >= 200 && status < 300 ? 0 : -1;
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

    if (derive_trophy_endpoint(
            cfg.endpoint,
            endpoint,
            sizeof(endpoint)
        ) < 0) {
        trophy_log(
            "[SaveState Trophy] couldn't derive /api/trophies/sync from ENDPOINT\n"
        );
        return;
    }

    group_count = 0;
    memset(groups, 0, sizeof(groups));

    size_t ext_count = 0;
    walk_photos(TROPHY_PHOTO_ROOT, &ext_count);

    trophy_log(
        "[SaveState Trophy] scanned %zu .ext file(s), found %zu unique title/NPWR set(s)\n",
        ext_count,
        group_count
    );

    if (group_count == 0) {
        trophy_log(
            "[SaveState Trophy] no trophy .ext files found\n"
        );
        return;
    }

    if (post_trophy_sync(&cfg, endpoint) < 0) {
        trophy_log(
            "[SaveState Trophy] trophy upload failed\n"
        );
    }
}

__attribute__((constructor))
static void savestate_trophy_sync_constructor(void) {
    (void)mkdir(STATE_DIR, 0777);

    /*
     * curl_global_init/cleanup is also performed by the activity logger,
     * but this constructor keeps the scanner safe when its lifecycle changes.
     */
    curl_global_init(CURL_GLOBAL_DEFAULT);
    sync_trophies_once();
    curl_global_cleanup();
}
