# SaveState PS5 Activity Logger — cURL HTTPS test

This build replaces the custom POSIX HTTP uploader with the PS5-payload-dev cURL stack.

The Makefile uses `prospero-curl-config`, matching `ps5-payload-dev/fetchpkg`'s PS5 build.

The payload sends the existing SaveState activity JSON directly to the configured `ENDPOINT`.
For this diagnostic build, cURL TLS peer/host verification is disabled so that Sony's CA-store
problem is isolated from the cURL transport itself.

Set `/data/savestate-sync/config` to the real HTTPS endpoint:

    ENDPOINT=https://save-state-jade.vercel.app/api/activity/ingest
    DEVICE_ID=...
    TOKEN=...

This test does not use the local HTTP relay.
