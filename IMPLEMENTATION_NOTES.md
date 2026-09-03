# SaveState PS5 Activity Revamp

Target base: `36accc580c6b02881a5dea73b773c1e37633906f`

## Included

- `vercel.json`
  - Changes PlayStation title catalog sync from daily to weekly.
  - Schedule: Sundays at 04:00 UTC (`0 4 * * 0`).
- `src/lib/activity.server.ts`
  - Bootstraps `playstation_titles` automatically when empty.
  - Adds month-aware activity queries.
  - Keeps all-time totals while allowing the UI to request a specific calendar month.
  - Keeps manual library `hours` out of PS5 playtime analytics.
- `src/routes/api/activity.ts`
  - Accepts `?month=YYYY-MM`.
- `src/lib/web-activity.ts`
  - Adds month support to the browser client.
- `src/routes/stats.tsx`
  - Full stats redesign around actual PS5 activity.
  - Monthly activity calendar.
  - Clicking a day shows game-by-game time and session counts.
  - Manual library hours are no longer displayed/used.
  - Library score/status insights remain separate.
- `flutter_client/lib/services/api_client.dart`
  - Adds month-aware activity requests.
- `flutter_client/lib/ui/screens/stats_screen.dart`
  - Full Material 3-style activity calendar.
  - Month navigation.
  - Tappable day drill-down.
  - Most-played games and library overview.
  - No manual game-hour calculation.

## One important deployment behavior

The catalog still refreshes weekly through Vercel. The activity API also bootstraps the catalog on the first request if `playstation_titles` is empty. That prevents a fresh deployment from showing zero activity simply because the first weekly cron has not happened yet.

## Vercel

The weekly schedule is valid for Vercel Cron. Vercel schedules are UTC. Hobby cron restrictions require schedules no more frequent than once per day, so weekly is safely within that limit.

After the code is deployed, the first visit to Stats can populate an empty `playstation_titles` table automatically. Subsequent updates are handled by the weekly cron.
