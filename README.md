# SaveState Trophy Sync feature

This branch adds local PS5 trophy recovery using the trophy screenshot `.ext` sidecars.

## PS5 behavior

The payload recursively scans:

`/user/av_contents/photo`

It reads each `.ext` JSON file, gets `trophyTitleId` and every `trophyId`, and gets the game Title ID from the sibling `.meta` file (`appVerTitleId`). If the `.meta` file is missing that field, the scanner falls back to a `CUSA...`/`PPSA...` identifier in the path.

It groups the result by game and posts one request to `/api/trophies/sync` using the existing PS5 device token.

The scanner does **not** delete screenshots or sidecars.

## Server behavior

`POST /api/trophies/sync` authenticates with the existing PS5 device credentials, resolves the Title ID through `playstation_titles`, and marks only the locally observed trophy IDs as earned.

`GET/POST /api/trophies/catalog` is protected by `CRON_SECRET`. The GET returns NPWR IDs currently present in `game_trophies`; the POST stores Sony trophy metadata without changing earned state.

## GitHub Action

`.github/workflows/sync-playstation-trophies.yml` runs daily at 04:30 UTC and can also be started manually.

Required GitHub repository secrets:

- `SAVESTATE_URL` — e.g. `https://save-state-jade.vercel.app`
- `CRON_SECRET` — same value configured on the backend
- `PSN_NPSSO` — PSN NPSSO token, or preferably `PSN_REFRESH_TOKEN` when using a persistent refresh token

The action installs `psn-api@2.18.1` for the job only. Sony's authenticated Trophy API is used for **catalog metadata only**, not for earned state.

PS5 uses `trophy2`; PS4/BC uses `trophy` when calling `getTitleTrophies()`.
