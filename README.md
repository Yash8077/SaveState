SaveState Stats + PS5 Session Dates Fix

Replace:
  src/routes/stats.tsx
  flutter_client/lib/ui/screens/stats_screen.dart

Add:
  migrations/0012_ps5_session_dates.sql

Changes:
- Fixes React error #310 by removing the conditional hook ordering problem.
- Website timeline is responsive: compact calendar + selected-day games side-by-side on wider layouts, stacked on narrow layouts.
- Flutter timeline uses the same compact calendar + selected-day games pattern.
- Calendar cells are intentionally shorter and no longer create a large vertical wall of dates.
- Backfills first and last PlayStation session dates into matched library entries.
- New PS5/PS4 activity updates the matched library game's started_at / finished_at.
- Adding a library game after historical PS activity already exists also backfills those dates.
- Existing ApiClient/APK changes are untouched.

Validation:
- src/routes/stats.tsx passed TypeScript/TSX syntax transpilation.
- Flutter SDK/Dart analyzer was unavailable in the execution environment, so the Flutter file was not compiled here.
