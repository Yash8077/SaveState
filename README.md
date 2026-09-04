# SaveState Stats / Calendar refinement

Files in this patch:

- `src/routes/stats.tsx`
- `flutter_client/lib/ui/screens/stats_screen.dart`
- `migrations/0012_ps5_session_dates.sql`

Changes:

- React hook-ordering issue removed.
- Website now separates all-time activity summary from month-specific calendar data, so changing months does not blank/reload the hero, most-played rail, or library metrics.
- Month changes show loading only inside the activity calendar/day-games region.
- Website calendar is compact and becomes a two-pane calendar + selected-day game list on wide layouts.
- Flutter follows the same interaction: month switching keeps the rest of the Stats screen stable and only the timeline enters a loading state.
- Calendar keeps PlayStation cover art as a subtle heatmap layer while remaining compact.
- Session-date migration backfills first and last PlayStation session into `game_entries.started_at` / `finished_at`, and keeps them updated for future imports.
- `0012_ps5_session_dates.sql` explicitly casts session keys to PostgreSQL `date` to avoid the Vercel migration failure.
