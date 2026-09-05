# SaveState Trophy Catalog Cache v2

This update replaces the previous per-trophy `catalog_synced_at` cache check with a
dedicated `trophy_catalogs` table.

## Behavior

- `game_trophies` stores individual trophy definitions and local earned state.
- `trophy_catalogs` stores one cache record per `(platform, trophy_title_id)`.
- The GitHub Action asks `/api/trophies/catalog` for only uncached catalog targets.
- A successful Sony fetch writes the catalog cache record.
- Subsequent daily runs skip that NPWR entirely and do not call PlayStation.
- Sony catalog updates never overwrite `earned` or `earned_at`.
- `trophy_set_version` and `total_trophies` are stored for progress reporting and future refresh logic.
- `getGameTrophyProgress()` provides total, earned, percentage, and platinum/gold/silver/bronze counts.

## Apply

Extract over the repository root and run:

```powershell
git add .
git status
git commit -m "Use dedicated trophy catalog cache"
git push
```

Then deploy the feature branch and run the trophy catalog workflow once manually.
The next run should print:

```text
No uncached trophy catalogs to sync.
```
