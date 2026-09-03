# Flutter app note

No Flutter API/schema change is required for this feature.

The existing Flutter client already calls `/api/activity?limit=100` and the existing
`StatsScreen` already renders the returned `totals`, `recent`, and `games` fields.
Because the server endpoint is now catalog-filtered, the existing PS5 card automatically
becomes game-only after the next Android build/release.

Recommended small UI wording change when you next touch `flutter_client/lib/ui/screens/stats_screen.dart`:

- `PS5 Game Activity` instead of `PS5 Activity`
- keep using `activity.totals` and `activity.games`
- optionally surface `totals.games`, `totals.sessions`, and `totals.days`
