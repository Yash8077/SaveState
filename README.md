# SaveState Trophy Artwork Fix — based on 054c87f

Base commit: `054c87f41f2538e0570a2415499f8828e980a40c`
Message: `Major Change: PS5 Trohpies Fast Fetching`

Changes:
- Preserves the latest fast trophy-overview implementation.
- Keeps trophy overview restricted to games in the authenticated user's library.
- Adds a shared artwork backfill for library entries whose `cover_url`/`header_url` is missing.
- Only games missing artwork trigger the catalog fallback.
- The fetched artwork is persisted to `game_entries`.
- Trophy detail uses the same fallback, fixing blank Nathan Drake banner/cover data.
- Existing trophy identity and NPWR logic are untouched.
- No Flutter/Dart files are included; no APK rebuild is required.

Files:
- `src/routes/api/trophies/list.ts`
- `src/routes/api/trophies/game.ts`
- `src/lib/library-artwork.server.ts`
