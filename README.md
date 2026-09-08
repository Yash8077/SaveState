SaveState shared artwork resolution
 
Baseline verified: 32666a7a5108cf8a9cded6ff9f479d9aebec6781

This bundle contains complete replacement files, not patches.

The Flutter artwork path is centralized in models/artwork_resolver.dart. It is synchronous and network-free; it normalizes and orders artwork candidates. CachedNetworkImage continues to provide the actual HTTP/image cache, so the same canonical URL is reused across surfaces.

Updated surfaces:
- Stats
- Trophies
- Trophy game details
- Library/game cards
- Hero carousel

Game Details was intentionally left unchanged because its existing model-level artwork selection and poster fallback already use the shared normalization helpers and its source was not otherwise modified by this change.

No website/backend change is included because commit 32666a7 already contains the server-side missing-artwork backfill for trophy responses.

Rebuild the Flutter APK after replacing these files.
