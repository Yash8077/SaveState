#!/usr/bin/env python3
"""Install SaveState launcher icons, including Android 13 Material You monochrome.

`flutter create` stamps the default Flutter icons. Run this after that so the
APK ships the cartridge mark plus a themed-icon layer.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "brand_icons"
RES = ROOT / "android/app/src/main/res"

ADAPTIVE = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
"""

COLORS = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#1A1C1E</color>
</resources>
"""


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def copy(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def main() -> None:
    if not RES.exists():
        raise SystemExit(f"missing {RES} — run flutter create first")
    if not BRAND.exists():
        raise SystemExit(f"missing {BRAND}")

    write(RES / "mipmap-anydpi-v26/ic_launcher.xml", ADAPTIVE)
    write(RES / "mipmap-anydpi-v26/ic_launcher_round.xml", ADAPTIVE)
    write(RES / "values/ic_launcher_background.xml", COLORS)

    copy(
        BRAND / "ic_launcher_foreground.png",
        RES / "drawable-nodpi/ic_launcher_foreground.png",
    )
    copy(
        BRAND / "ic_launcher_monochrome.png",
        RES / "drawable-nodpi/ic_launcher_monochrome.png",
    )

    for density in ("mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"):
        src = BRAND / f"mipmap-{density}" / "ic_launcher.png"
        if not src.exists():
            continue
        copy(src, RES / f"mipmap-{density}/ic_launcher.png")
        copy(src, RES / f"mipmap-{density}/ic_launcher_round.png")

    print("installed SaveState adaptive + themed launcher icons")


if __name__ == "__main__":
    main()
