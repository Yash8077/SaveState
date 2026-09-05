# SaveState Trophy Catalog Update

This overlay updates the trophy catalog flow on top of `feature/trophy-sync`.

## What changed

- Adds `trophy_set_version` and `catalog_synced_at`.
- Earned trophy sync from the PS5 remains unchanged.
- The GitHub Action only calls PlayStation for uncached trophy sets.
- Once a trophy set has been cached successfully, later scheduled runs skip it entirely.
- Sony metadata never changes `earned` or `earned_at`.
- `trophySetVersion` is stored for future catalog invalidation/refresh support.
- The workflow is manual + daily schedule only. The scheduled workflow will run automatically after this workflow exists on the repository's default branch; use `workflow_dispatch` while testing from `feature/trophy-sync`.

## Apply

Extract this archive over the repository root, then:

```powershell
git add .
git status
git commit -m "Improve trophy catalog caching"
```

After deployment, run:

```text
Actions → Sync PlayStation Trophy Catalog → Run workflow
```

For the first run, make sure `CRON_SECRET`, `SAVESTATE_URL`, and `PSN_NPSSO` are configured as GitHub repository secrets.
