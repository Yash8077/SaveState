/* SaveState PS5 local trophy scanner.
 *
 * Runs once when the payload starts. It recursively scans trophy screenshot
 * sidecars under /user/av_contents/photo, parses plain-JSON .ext files, gets
 * the game Title ID from the sibling .meta file (with path fallback), groups
 * earned trophy IDs by game, and posts them to SaveState.
 *
 * It intentionally does not delete media files. Deletion can be added after
 * the sync path has been validated in production.
 */
#include <ctype.h>
#include <dirent.h>
#include <errno.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>
#include <curl/curl.h>

#define TROPHY_PHOTO_ROOT "/user/av_contents/photo"
#define STATE_DIR "/data/savestate-sync"
#define CONFIG_FILE STATE_DIR "/config"
#define TROPHY_LOG_FILE STATE_DIR "/trophy-sync.log"

#define URL_MAX 512
#define TOKEN_MAX 256
#define DEVICE_ID_MAX 64
#define MAX_GAMES 256
#define MAX_TROPHIES_PER_GAME 1000
#define MAX_JSON 128 * 1024

typedef struct {
    char endpoint[URL_MAX];
    char device_id[DEVICE_ID_MAX];
    char token[TOKEN_MAX];
} trophy_config;

typedef struct {
    char title_id[64];
    char trophy_title_id[64];
    int trophy_ids[MAX_TROPHIES_PER_GAME];
    size_t trophy_count;
} trophy_game;

static trophy_game games[MAX_GAMES];
static size_t game_count = 0;

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

        if (!strcmp(line, "ENDPOINT"))
            strncpy(cfg->endpoint, eq, sizeof(cfg->endpoint) - 1);
        else if (!strcmp(line, "DEVICE_ID"))
            strncpy(cfg->device_id, eq, sizeof(cfg->device_id) - 1);
        else if (!strcmp(line, "TOKEN"))
            strncpy(cfg->token, eq, sizeof(cfg->token) - 1);
    }

    fclose(f);
    return cfg->endpoint[0] && cfg->device_id[0] && cfg->token[0] ? 0 : -1;
}

static int derive_trophy_endpoint(const char *endpoint, char *out, size_t cap) {
    const char *needle = "/api/activity/ingest";
    const char *p = strstr(endpoint, needle);
    if (!p) return -1;

    size_t prefix = (size_t)(p - endpoint);
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

static int extract_string_field(const char *json, const char *key, char *out, size_t cap) {
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

static int extract_int_after(const char *json, const char *from, const char *key, int *value) {
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

static int looks_like_title_id(const char *s) {
    if (!s) return 0;
    return (strncasecmp(s, "CUSA", 4) == 0 || strncasecmp(s, "PPSA", 4) == 0);
}

static int extract_title_id_from_path(const char *path, char *out, size_t cap) {
    const char *p = path;
    while (*p) {
        if (!strncasecmp(p, "CUSA", 4) || !strncasecmp(p, "PPSA", 4)) {
            size_t i = 0;
            while (p[i] && (isalnum((unsigned char)p[i]) || p[i] == '_') && i + 1 < cap)
                out[i++] = p[i];
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

static int find_game(const char *title_id) {
    for (size_t i = 0; i < game_count; ++i) {
        if (!strcmp(games[i].title_id, title_id)) return (int)i;
    }
    return -1;
}

static int get_or_add_game(const char *title_id, const char *trophy_title_id) {
    int idx = find_game(title_id);
    if (idx >= 0) {
        if (!games[idx].trophy_title_id[0] && trophy_title_id)
            strncpy(games[idx].trophy_title_id, trophy_title_id,
                    sizeof(games[idx].trophy_title_id) - 1);
        return idx;
    }

    if (game_count >= MAX_GAMES) return -1;

    idx = (int)game_count++;
    memset(&games[idx], 0, sizeof(games[idx]));
    strncpy(games[idx].title_id, title_id, sizeof(games[idx].title_id) - 1);
    if (trophy_title_id)
        strncpy(games[idx].trophy_title_id, trophy_title_id,
                sizeof(games[idx].trophy_title_id) - 1);
    return idx;
}

static int add_trophy(int game_idx, int trophy_id) {
    trophy_game *game = &games[game_idx];
    for (size_t i = 0; i < game->trophy_count; ++i) {
        if (game->trophy_ids[i] == trophy_id) return 0;
    }
    if (game->trophy_count >= MAX_TROPHIES_PER_GAME) return -1;
    game->trophy_ids[game->trophy_count++] = trophy_id;
    return 0;
}

static void process_ext(const char *ext_path) {
    char json[MAX_JSON];
    if (read_text_file(ext_path, json, sizeof(json)) < 0) return;

    char trophy_title_id[64] = {0};
    if (extract_string_field(json, "trophyTitleId", trophy_title_id, sizeof(trophy_title_id)) < 0)
        return;

    char meta_path[1024];
    strncpy(meta_path, ext_path, sizeof(meta_path) - 1);
    char *dot = strrchr(meta_path, '.');
    if (!dot) return;
    strcpy(dot, ".meta");

    char title_id[64] = {0};
    char meta[MAX_JSON];
    if (read_text_file(meta_path, meta, sizeof(meta)) == 0)
        extract_string_field(meta, "appVerTitleId", title_id, sizeof(title_id));

    if (!title_id[0])
        extract_title_id_from_path(ext_path, title_id, sizeof(title_id));

    if (!title_id[0]) {
        trophy_log("[SaveState Trophy] no Title ID for %s\n", ext_path);
        return;
    }

    normalize_title_id(title_id);
    int game_idx = get_or_add_game(title_id, trophy_title_id);
    if (game_idx < 0) return;

    const char *p = json;
    int found = 0;
    while ((p = strstr(p, "\"trophyId\":")) != NULL) {
        int trophy_id = 0;
        if (extract_int_after(json, p, "trophyId", &trophy_id) == 0) {
            if (add_trophy(game_idx, trophy_id) == 0) found++;
        }
        p += 11;
    }

    if (found)
        trophy_log("[SaveState Trophy] %s -> %s: %d trophy event(s)\n",
                   title_id, trophy_title_id, found);
}

static void walk_photos(const char *dir_path) {
    DIR *dir = opendir(dir_path);
    if (!dir) return;

    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL) {
        if (!strcmp(entry->d_name, ".") || !strcmp(entry->d_name, "..")) continue;

        char path[1024];
        snprintf(path, sizeof(path), "%s/%s", dir_path, entry->d_name);

        struct stat st;
        if (stat(path, &st) < 0) continue;

        if (S_ISDIR(st.st_mode)) {
            walk_photos(path);
            continue;
        }

        size_t n = strlen(entry->d_name);
        if (n >= 4 && !strcasecmp(entry->d_name + n - 4, ".ext"))
            process_ext(path);
    }

    closedir(dir);
}

static size_t discard_body(void *ptr, size_t size, size_t nmemb, void *userdata) {
    (void)ptr;
    (void)userdata;
    return size * nmemb;
}

static void json_escape(char *dst, size_t cap, const char *src) {
    size_t n = 0;
    for (const char *p = src; *p && n + 2 < cap; ++p) {
        if (*p == '"' || *p == '\\') dst[n++] = '\\';
        dst[n++] = *p;
    }
    dst[n] = 0;
}

static int post_trophy_sync(const trophy_config *cfg, const char *endpoint) {
    char *body = calloc(1, MAX_JSON);
    if (!body) return -1;

    char device_id[DEVICE_ID_MAX * 2];
    json_escape(device_id, sizeof(device_id), cfg->device_id);
    snprintf(body, MAX_JSON,
             "{\"schemaVersion\":1,\"deviceId\":\"%s\",\"games\":[",
             device_id);

    for (size_t i = 0; i < game_count; ++i) {
        trophy_game *g = &games[i];
        if (!g->title_id[0] || !g->trophy_count) continue;

        if (strchr(strchr(body, '[') ? body + 1 : body, '}'))
            strcat(body, ",");

        char title[128];
        char npwr[128];
        json_escape(title, sizeof(title), g->title_id);
        json_escape(npwr, sizeof(npwr), g->trophy_title_id);

        size_t room = MAX_JSON - strlen(body);
        char item[8192];
        snprintf(item, sizeof(item), "{\"titleId\":\"%s\",\"trophyTitleId\":\"%s\",\"trophyIds\":[", title, npwr);

        if (strlen(item) + 8 >= room) { free(body); return -1; }
        strcat(body, item);

        for (size_t t = 0; t < g->trophy_count; ++t) {
            char num[32];
            snprintf(num, sizeof(num), "%d", g->trophy_ids[t]);
            if (t) strcat(body, ",");
            strcat(body, num);
        }
        strcat(body, "]}");
    }

    strcat(body, "]}");

    CURL *curl = curl_easy_init();
    if (!curl) {
        free(body);
        return -1;
    }

    struct curl_slist *headers = NULL;
    char auth[512];
    snprintf(auth, sizeof(auth), "X-SaveState-Device-Token: %s", cfg->token);
    headers = curl_slist_append(headers, "Content-Type: application/json");
    headers = curl_slist_append(headers, "Accept: application/json");
    headers = curl_slist_append(headers, auth);

    long status = 0;
    curl_easy_setopt(curl, CURLOPT_URL, endpoint);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE_LARGE, (curl_off_t)strlen(body));
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, discard_body);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, "SaveState-PS5-Trophy/1.0");
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);

    CURLcode rc = curl_easy_perform(curl);
    if (rc == CURLE_OK)
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status);

    trophy_log("[SaveState Trophy] POST status=%ld games=%zu bytes=%zu\n",
               status, game_count, strlen(body));

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    free(body);

    return (rc == CURLE_OK && status >= 200 && status < 300) ? 0 : -1;
}

static void sync_trophies_once(void) {
    trophy_config cfg;
    if (load_trophy_config(&cfg) < 0) {
        trophy_log("[SaveState Trophy] activity config missing/invalid; trophy scan skipped\n");
        return;
    }

    char endpoint[URL_MAX];
    if (derive_trophy_endpoint(cfg.endpoint, endpoint, sizeof(endpoint)) < 0) {
        trophy_log("[SaveState Trophy] couldn't derive /api/trophies/sync from ENDPOINT\n");
        return;
    }

    game_count = 0;
    memset(games, 0, sizeof(games));

    walk_photos(TROPHY_PHOTO_ROOT);

    if (!game_count) {
        trophy_log("[SaveState Trophy] no trophy .ext files found\n");
        return;
    }

    if (post_trophy_sync(&cfg, endpoint) < 0)
        trophy_log("[SaveState Trophy] sync failed; media was left untouched\n");
    else
        trophy_log("[SaveState Trophy] sync succeeded; media was left untouched\n");
}

__attribute__((constructor))
static void savestate_trophy_sync_constructor(void) {
    mkdir(STATE_DIR, 0777);
    curl_global_init(CURL_GLOBAL_DEFAULT);
    sync_trophies_once();
    curl_global_cleanup();
}
