# SaveState PS5 Game Activity Logger

This payload is a **one-shot journal harvester**, not a persistent active-sync daemon.

It reads completed application sessions from the PS5 system logger, uploads only sessions newer than the local cursor, advances the cursor after a successful upload, and exits. That means shutting down the PS5 does not lose the ability to sync history: the next time you run the payload it can harvest sessions that were recorded before shutdown.

## What it records

The payload reads `ApplicationSessionEndBi` rows from:

```text
/system_data/priv/system_logger2/nobackup/database/sl2_log.db
```

For each session it extracts:

- SQLite `rowid` as the source cursor/deduplication key
- `created_date`
- `appTitleId`
- `totalFgTime`
- the title name from `app.db` when available

The server keeps the raw sessions and calculates aggregate playtime from them. This supports both an activity journal and accurate per-game/per-day statistics.

## Required config

Create `/data/savestate-sync/config`:

```ini
ENDPOINT=https://save-state-jade.vercel.app/api/activity/ingest
DEVICE_ID=<device UUID from SaveState>
TOKEN=<device token from SaveState>
```

### TLS-bypass test build

The current test build disables TLS certificate verification unconditionally
to determine whether certificate trust is the cause of the failed upload. Its
log begins with `[SaveState TLS-BYPASS TEST v1]`.

Use it only on a trusted network and replace it after this one diagnostic run:
without certificate verification, an active network attacker could intercept
the device token. This must not be the production transport.

The cursor is stored in:

```text
/data/savestate-sync/last_rowid.txt
```

## Runtime behavior

The payload:

1. Opens `sl2_log.db` read-only.
2. Reads new logger rows after the stored cursor.
3. Keeps at most 100 activity events per HTTP request.
4. Uploads the batch over HTTPS.
5. Only after a successful response does it advance the local cursor.
6. Repeats until it is caught up, then exits.

It does **not** sleep or run as a permanent background process.

## Build

1. Vendor the SQLite amalgamation next to this file (the SDK doesn't bundle sqlite3):
   ```
   curl -sSL -o sqlite.zip https://sqlite.org/2025/sqlite-amalgamation-3450000.zip
   unzip -o sqlite.zip && cp sqlite-amalgamation-*/sqlite3.{c,h} .
   ```
   (check sqlite.org for the current release number if that path 404s)

2. Build with the `ps5-payload-dev/sdk` toolchain:
   ```
   export PS5_PAYLOAD_SDK=/opt/ps5-payload-sdk
   source $PS5_PAYLOAD_SDK/toolchain/prospero.sh
   make
   ```

`main.c` uses `sceHttp2*`/`sceSsl*`/`sceNet*`, matched against the symbols actually present in this SDK's `sce_stubs/libSceHttp2.c` and its own `samples/http2_get` reference example — not the unverified v1 `sceHttp*` calls in an earlier draft of this payload. Still worth a build-test against your exact installed SDK revision before trusting it on your console.

## Known unverified assumption

The `tbl_log` table name, `event_id='ApplicationSessionEndBi'`, and the `log` column's JSON shape (`appTitleId`, `totalFgTime`) are asserted, not confirmed against a real `sl2_log.db`. Before relying on this, pull a copy of your own `sl2_log.db` (via `websrv`'s `/fs/` browser or FTP) and run:
```
sqlite3 sl2_log.db ".schema tbl_log"
sqlite3 sl2_log.db "select rowid, event_id, created_date, log from tbl_log where event_id='ApplicationSessionEndBi' limit 3"
```
If the table/column names or JSON keys don't match, the payload will silently skip every row rather than error out loudly.
