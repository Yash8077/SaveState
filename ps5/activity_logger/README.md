# SaveState PS5 Activity Logger — POSIX HTTP test

This build removes `libSceSsl`, `libSceHttp`, and `libSceHttp2` from the upload path.
It uses POSIX IPv4 TCP sockets and plain HTTP/1.1 for the SaveState ingest request.

## Configuration

`/data/savestate-sync/config` must use an `http://` endpoint, for example:

```text
ENDPOINT=http://<plain-http-host>/api/activity/ingest
DEVICE_ID=<device-id>
TOKEN=<device-token>
```

An `https://` endpoint is intentionally rejected by the payload because this build does not implement TLS.

## Request

The payload sends:

- `POST /api/activity/ingest HTTP/1.1`
- `Content-Type: application/json`
- `Accept: application/json`
- `X-SaveState-Device-Token: <token>`
- `Content-Length: <body length>`
- `Connection: close`

The existing SQLite event extraction, cursor handling, and server-side dedupe model are unchanged.
