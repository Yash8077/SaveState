Apply these changes to the current `src/lib/types.ts` and `src/lib/library.server.ts`.

`GameEntry`:
```ts
playtimeSeconds: number;
playtimeSource: "manual" | "ps5";
```

`EntryRow`:
```ts
playtime_seconds: number | string;
playtime_source: "manual" | "ps5";
```

Add `playtime_seconds, playtime_source,` to `ENTRY_SELECT`.

Add to `mapEntry()`:
```ts
playtimeSeconds: Number(row.playtime_seconds ?? 0),
playtimeSource: row.playtime_source === "ps5" ? "ps5" : "manual",
```

In `updateEntryRow()`, replace the current hours setter with:
```ts
if (data.hours !== undefined) {
  push(
    "hours = case when playtime_source = 'ps5' then hours else ? end",
    data.hours,
  );
}
```

This exposes the source to the UI and guarantees that a PS5-derived hour value
cannot be manually overwritten after the title is synchronized.
