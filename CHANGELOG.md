# PS5 Activity Logger — changes vs `main` (107dba6)

Feature: harvest completed PS5 play sessions from the console's local
activity log and sync them into SaveState, without needing PSN sync, a
Raspberry Pi, or an always-on LAN device. Console pushes to the backend
directly via a one-shot payload.

Base drafted by ChatGPT; PS5 payload and Flutter pairing UI fixed/simplified
below. Everything in this zip is new relative to `main` unless noted.

---

## Backend (TanStack Start — not SvelteKit, corrected assumption from earlier)

**New files:**
- `src/lib/activity-schema.ts` — Zod validation for device creation and
  event ingestion payloads (`schemaVersion`, `deviceId`, up to 500
  events/request, `totalFgTime` capped at 30 days as a sanity bound)
- `src/lib/activity.server.ts` — device token issuance (hashed, `ssps5_`
  prefixed), device auth, event ingestion with `on conflict (device_id,
  source_rowid) do nothing` dedup, and dashboard aggregation (totals,
  per-game, daily breakdown) computed on read from raw events
- `src/routes/api/activity.ts` — `GET /api/activity` — authenticated
  dashboard endpoint for the signed-in user
- `src/routes/api/activity/ingest.ts` — `POST /api/activity/ingest` —
  device-token-authenticated event ingestion, called by the PS5 payload
- `src/routes/api/activity/device.ts` — `GET/POST/DELETE
  /api/activity/device` — device management for the signed-in user
- `migrations/0008_ps5_activity.sql` — `ps5_devices` (hashed tokens,
  scoped to `user_id`) and `ps5_activity_events` (raw per-session rows,
  `unique(device_id, source_rowid)` for dedup) tables
- `migrations/0009_ps5_activity_indexes.sql` — indexes for
  `(user_id, received_at)` and `(user_id, title_id, received_at)` so
  dashboard queries stay cheap as history grows
- `docs-ps5-activity.md` — short internal note on the feature

**Not changed:** no web (browser) UI added — this data is currently
Flutter-only. Web dashboard support is unbuilt.

---

## PS5 payload — `ps5/activity_logger/`

One-shot ELF: reads completed sessions from `sl2_log.db`, uploads new
ones, advances a local cursor, exits. No persistent background process —
survives reboot/rest-mode/shutdown by design, since it isn't running
continuously in the first place.

**Fixed from the original draft** (verified against a real clone of
`ps5-payload-dev/sdk`):

- `main.c` — HTTP layer rewritten from unverified v1 `sceHttp*`/`sceHttps*`
  calls to `sceHttp2*`/`sceSsl*`/`sceNet*`, matched against actual symbols
  in the SDK's `sce_stubs/libSceHttp2.c` and its own `samples/http2_get`
  reference example. Added failure logging throughout (`main()`,
  `load_config()`, `mkdir_p()`, upload path) — previously failed silently
  with no indication of why. Syntax-checked clean against a stub header.
- `Makefile` — now includes `$(PS5_PAYLOAD_SDK)/toolchain/prospero.mk`
  (the real path) instead of `Makefile.inc` (doesn't exist in the
  installed SDK tree). Compiles `sqlite3.c` directly into the payload
  instead of assuming a system `-lsqlite3` (the SDK ships no sqlite3 at
  all). Links `-lSceNet -lSceSsl -lSceHttp2`. Fails fast with a clear
  message if `sqlite3.c`/`.h` haven't been vendored yet.
- `README.md` — documents the sqlite vendoring step and flags the
  `sl2_log.db` schema assumption (`tbl_log`, `event_id =
  'ApplicationSessionEndBi'`, `appTitleId`/`totalFgTime` JSON fields) as
  worth confirming against your own console before trusting it blindly.

**Provenance / licensing note:** the `sl2_log.db` schema this payload
relies on matches, field-for-field, `src/activitydb.c` in the **GPLv3+**
`soniciso/sonicloader` (Elf Arsenal) project, which itself ports the same
approach from the `hotshotz79` PS5-Activity-Log project. If you publish
this repo or accept contributions, this subdirectory likely needs GPLv3+
licensing and attribution to stay compliant — it isn't just a style
concern.

**Still unverified:** the exact `sl2_log.db` schema and `sceHttp2`
signatures haven't been build-tested against a real SDK + real console.
Recommended before relying on this: `sqlite3 sl2_log.db ".schema
tbl_log"` on a copy of your own activity log, and a real build via the
included GitHub Action.

---

## Flutter client — `flutter_client/lib/`

- `services/api_client.dart` — added `getActivity()`, `createPs5Device()`,
  `getPs5Devices()`, `deletePs5Device(id)`
- `ui/screens/settings_screen.dart` — new "PS5 Activity" settings page,
  **simplified for single-device personal use**:
  - Checks for an existing device on load instead of letting you
    spam-create duplicate device rows every time you open the page
  - Existing device → status card (name, last-synced time), no token
    shown (server only stores it hashed, can't be redisplayed)
  - No device yet → "Create PS5 connection" button, same as the original
  - Lost the token → "Reissue it" button (deletes the old device row,
    mints a fresh one) since there's no way to recover a lost token
    otherwise
  - One-time reveal now includes `ENDPOINT=` alongside `DEVICE_ID=`/
    `TOKEN=` — the original only showed the latter two, requiring you to
    remember the endpoint URL separately
- `ui/screens/stats_screen.dart` — new "PS5 Game Activity" card (total
  hours, recent sessions, games/sessions/days-played summary) and a
  "Daily activity" breakdown grouped by date, fetched alongside existing
  library data. Kept visually separate from manually-entered library
  hours, not merged into the same numbers.

---

## CI — `.github/workflows/build-ps5-payload.yml`

New. Builds `ps5-payload-dev/sdk` from source on `ubuntu-latest`, vendors
the SQLite amalgamation, builds `ps5/activity_logger/`, and uploads the
resulting `savestate-activity.elf` as a workflow artifact. Triggers on
pushes touching `ps5/**` or manual dispatch. Does not yet cache the SDK
build (rebuilds from scratch each run, ~2-3 min overhead) — fine for
occasional manual triggers, worth revisiting if this ends up running on
every push.

---

## Setup, once these files are in place

1. Run migrations `0008` and `0009` against your Neon/Postgres instance
2. Build the payload (locally with the real SDK, or via the GitHub Action)
3. In the Flutter app: Settings → PS5 Activity → "Create PS5 connection"
   → copy the three `ENDPOINT=`/`DEVICE_ID=`/`TOKEN=` lines
4. On the PS5: create `/data/savestate-sync/config` with those three lines
5. Send `savestate-activity.elf` to the console via your loader
6. Run it once manually, confirm `GET /api/activity` shows data, *then*
   consider wiring it into autoload
