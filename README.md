# SaveState Phase 2 — Collection Trophy Identity Fix

Baseline: `feature/trophy-sync` HEAD `8c0b935ef8553197ff0896016d54373e240298ba`

This patch fixes the assumption that one library/catalog game maps to exactly one PlayStation trophy identity.

## Implemented

- A trophy-capable collection/compilation can resolve to multiple PlayStation title IDs.
- Collection members are discovered from the catalog's IGDB `series` relation when the game is a bundle/collection/compilation-style entry.
- The same resolver is used by trophy detail and trophy overview aggregation.
- Trophy rows are deduplicated using `(platform, title_id, trophy_title_id, trophy_id)`.
- Trophy catalog writes preserve `trophy_title_id` and use it in their identity/upsert path.
- The database uniqueness key is expanded to include `trophy_title_id`, allowing multiple trophy sets to coexist safely.
- Existing legacy rows with an empty trophy-set ID are rebound when catalog metadata becomes available.
- Incomplete trophy catalogs are returned to the catalog sync target list so old/partial collection sets can be recovered.
- PS4 and PS5 identities remain separated; a collection uses the preferred platform from the library entry when available.
- Wiki catalog IDs remain backward-compatible.

## Expected result

A collection such as Uncharted: The Nathan Drake Collection is treated as one library game while its child PlayStation trophy identities are aggregated instead of selecting only one 54-trophy set.

The same mechanism applies to other collection/bundle/compilation entries without a title-specific exception.

## Deployment

1. Apply `migrations/0015_trophy_set_identity.sql`.
2. Deploy the updated server code.
3. Run the trophy catalog job so incomplete/legacy trophy sets are refreshed.
4. Run a normal PS5 trophy sync.

No Flutter/APK changes are included.
