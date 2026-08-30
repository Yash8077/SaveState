#!/usr/bin/env python3
"""Insert INTERNET permission into the main AndroidManifest if missing.

`flutter create` puts INTERNET in debug/profile manifests. Release APKs use
main/AndroidManifest.xml only — without this permission Android reports
Failed host lookup errno=7 instead of a permission error.
"""
from pathlib import Path
import sys

manifest = Path("android/app/src/main/AndroidManifest.xml")
if not manifest.exists():
    sys.exit(f"missing {manifest}")

text = manifest.read_text()
perms = [
    '<uses-permission android:name="android.permission.INTERNET"/>',
    '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>',
]
changed = False
for perm in perms:
    if perm in text:
        continue
    close = text.find(">")
    if close < 0:
        sys.exit("malformed AndroidManifest.xml")
    text = text[: close + 1] + "\n    " + perm + text[close + 1 :]
    changed = True

manifest.write_text(text)
print("updated" if changed else "already present", manifest)
print(text[:900])
