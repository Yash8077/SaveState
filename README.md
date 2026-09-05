# SaveState PS5 trophy scanner fix

Replace `ps5/activity_logger/trophy_sync.c` on `feature/trophy-sync`.

## What this fixes

The old scanner keyed its in-memory game bucket only by `title_id` (CUSA/PPSA). That incorrectly merged multiple PlayStation trophy sets that share one application Title ID. A collection can therefore contain multiple `trophyTitleId`/NPWR values under one CUSA.

The scanner now keys every group by:

`title_id + trophy_title_id`

Every `.ext` sidecar is still scanned, but duplicate trophy IDs are merged in memory inside the correct title/NPWR group. The payload sends one HTTP request containing one entry per unique Title ID + NPWR pair.

This means a layout such as:

CUSA02320 + NPWR09798_00 -> Uncharted 1 earned trophies
CUSA02320 + NPWRxxxxx_00 -> Uncharted 2 earned trophies

is preserved as two separate sync groups instead of one.

## Important behavior

Do not skip an entire NPWR just because that NPWR already exists in the database. The user may earn additional trophies in an already-known set later. The correct optimization is to deduplicate repeated `.ext` observations for the same `title_id + trophy_title_id + trophy_id` during the current scan. The server remains idempotent on repeated syncs.

The request is built dynamically, so a large trophy library does not depend on a fixed 128 KiB JSON body limit.

## Build

The existing `ps5/activity_logger/Makefile` already compiles `trophy_sync.c`, so no Makefile change is required.

Run the existing `build-ps5-payload` GitHub Action and deploy its `savestate-activity.elf` artifact to the PS5 payload manager.
