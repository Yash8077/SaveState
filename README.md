# SaveState Phase 2 — Collection Trophy Identity Fix (final)

Baseline: `feature/trophy-sync` after `8c0b935ef8553197ff0896016d54373e240298ba` and the pushed Phase 2 backend fix.

This change fixes collection/compilation trophy resolution generically. It is not a Nathan Drake special case.

## What it changes

- A PlayStation title can be associated with multiple trophy sets via `trophy_title_game_map`.
- PSN sync persists `platform + title_id + trophy_title_id` even when a game has zero earned trophies.
- Catalog ingestion uses those mappings to populate complete trophy sets, including sets with zero earned trophies.
- Catalog reads can resolve a collection to multiple PlayStation child title IDs using the catalog's IGDB series relation.
- Exact member matches are preferred; unresolved collection members use token-scored name matching for PlayStation naming differences such as remastered/edition suffixes.
- Resolved catalog-to-PlayStation identities are persisted in `catalog_trophy_identities` so subsequent requests do not have to rediscover the mapping.
- Trophy detail and trophy overview use the same identity resolver and aggregate all selected trophy sets.
- Trophy rows are deduplicated by `(platform, title_id, trophy_title_id, trophy_id)`.
- PS4/PS5 platform preference from the library entry is preserved.
- SQL paths that used array-cast predicates were removed from the collection resolver to avoid the runtime `$1` syntax failure seen on Android.

## Deployment

1. Apply `migrations/0016_trophy_identity_maps.sql` after `0015_trophy_set_identity.sql`.
2. Deploy the updated server files.
3. Run the trophy catalog job. Existing sync mappings cause all known trophy sets to be requested; incomplete catalogs are retried.
4. Run a normal PS5 trophy sync once after deployment.
5. Open Nathan Drake Collection again. It should aggregate the child trophy identities rather than selecting a single 54-trophy list.

No Flutter/APK changes are included.
