SaveState trophy overview performance fix

Base branch: feature/trophy-sync
Base HEAD checked before changes: cd9f6fcbe2c7715119ba7c6d6a7460712ad9dc32

Changes:
- Replace the Trophies overview's per-library-game catalog/PlayStation resolver with one DB-only trophy query.
- Keep the overview scoped to the authenticated user's library.
- Prefer persisted catalog_trophy_identities and fall back to an exact DB title match for older library rows.
- Aggregate trophy totals, earned counts, tier counts, percentage, title IDs, and last-earned timestamp in server code.
- No Wikipedia, IGDB, catalog API, or per-game network resolution is used by /api/trophies/list.
- The existing /api/trophies/game detail endpoint and trophy resolver are unchanged.

Validation performed:
- Node TypeScript syntax check passed for both changed files.
- Full npm typecheck/build was not run because this environment could not resolve github.com to clone/install the repository dependencies.
