# SaveState PS5 game activity implementation

## Added

- `migrations/0010_playstation_titles.sql`
- `src/lib/playstation-titles.server.ts`
- `src/routes/api/cron/playstation-titles.ts`
- `src/lib/web-activity.ts`
- `vercel.json`

## Replaced

- `src/lib/activity.server.ts`
- `src/routes/stats.tsx`

## Behavior

1. Raw `ps5_activity_events` stays untouched.
2. `playstation_titles` mirrors the upstream PS4/PS5 title catalog.
3. The sync marks obvious apps, demos, entitlements, DLC, soundtracks, tests, etc. as non-games.
4. `/api/activity` only aggregates events whose title ID is recognized as a game and whose recorded foreground time is > 0.
5. Existing historical activity names are backfilled from the title catalog.
6. Activity results attempt a best-effort title-name match to the user's `game_entries` and return `libraryGameId` where matched.
7. Vercel runs the catalog sync daily at 04:00 UTC. Daily is used because current Vercel Hobby cron limits require no more than once-per-day schedules; this is more frequent than the original weekly requirement and keeps the data fresher.
8. Set `CRON_SECRET` in Vercel to protect the sync route. If it is not configured, the route remains callable manually for testing.
9. Flutter already consumes the same `/api/activity` response, so the game-only filtering is reflected there without changing the app's transport contract.

## Important

The upstream dataset contains both actual games and non-game PlayStation packages/apps. The importer intentionally filters obvious non-game entries instead of trusting the upstream file as a perfect game-only database.

The classification rules are intentionally conservative and can be expanded later without deleting raw activity records. The upstream catalog is not a perfect game-only dataset, so the importer excludes obvious non-game package types while retaining the raw source rows.
