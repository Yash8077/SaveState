# Stats revamp

This version makes PS5 activity the playtime source for library hours once a
library title is matched to the imported PlayStation title catalog.

UX changes:
- Artwork-first Most Played rail.
- Artwork-backed monthly calendar.
- Tap a calendar day to see game-by-game time and sessions.
- Tap a game to open `/game/:id` in the Flutter client.
- Unmatched titles fall back to Discover search.
- Library overview keeps status/score information separate from imported time.

The router already provides `/game/:id`, so no new Flutter route is necessary.
