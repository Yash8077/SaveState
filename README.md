# SaveState UI update — based on latest main

Latest verified repository commit fetched before changes:
`9c6c552615c314fe93c75564628599be1444d2a4` — **Update stats_screen.dart**.

## Changelog

### Already present in latest main (kept, not duplicated)
- Flutter Stats already separates all-time activity from month-specific activity.
- Flutter Stats already loads only the selected month when changing months.
- Flutter Stats already handles signed-out users with a sign-in state.
- Flutter Stats already uses a full-size Material `ColorScheme.primary` outline for the selected calendar cell.

### Changes in this package
- **Home — Flutter + web:** refined the Playing / Beaten / Backlog / Favorites stat chips into compact Material-style outlined surfaces.
- **Discover — Flutter + web:** added a clear `Discover` heading and supporting subtitle above search.
- **Stats — Flutter + web:** removed the redundant progress bar from Most Played cards; playtime remains prominent.
- **Stats calendar — Flutter + web:** calendar durations use compact `Xh+` for anything over a whole hour (`1h+`, `2h+`, etc.), while exact durations remain in the selected-day details.
- **Stats calendar — web:** selected day uses a clear primary outline without the extra ring/glow treatment.
- **Flutter Stats calendar:** removed the per-day progress indicator beneath the duration; artwork/intensity remains the visual activity indicator.

## Files
- `src/routes/index.tsx`
- `src/routes/discover.tsx`
- `src/routes/stats.tsx`
- `flutter_client/lib/ui/screens/home_screen.dart`
- `flutter_client/lib/ui/screens/discover_screen.dart`
- `flutter_client/lib/ui/screens/stats_screen.dart`

## Validation
Flutter/Dart SDK was not available in this execution environment, so the Flutter changes were not locally compiled.
