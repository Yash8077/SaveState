# SaveState PS5 Game Activity Logger

SaveState uses a PS5 one-shot payload as a journal harvester rather than a persistent active-sync service. The payload reads completed `ApplicationSessionEndBi` records from `sl2_log.db`, sends new sessions directly to the SaveState backend over HTTPS, then exits.

The server stores raw sessions and derives total playtime, per-game totals, sessions, days played, and per-game/per-day activity. A local SQLite `rowid` cursor makes the importer incremental and the server deduplicates `(device_id, source_rowid)`, so re-running the payload is safe.

No Raspberry Pi, PC polling job, FTP bridge, or permanently running PS5 network service is required. The next payload invocation can collect sessions that were completed before the previous shutdown.
