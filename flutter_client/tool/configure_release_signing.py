#!/usr/bin/env python3
"""Configure the Android release build to use the persistent SaveState key."""

from __future__ import annotations

import base64
import os
from pathlib import Path

KEYSTORE = Path("android/savestate-release.jks")
KEY_PROPERTIES = Path("android/key.properties")
APP_GRADLE = Path("android/app/build.gradle.kts")


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required GitHub Actions secret: {name}")
    return value


def main() -> None:
    encoded = required("SAVESTATE_KEYSTORE_BASE64")
    store_password = required("SAVESTATE_KEYSTORE_PASSWORD")
    key_alias = required("SAVESTATE_KEY_ALIAS")

    try:
        keystore = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise SystemExit(
            "SAVESTATE_KEYSTORE_BASE64 is not valid base64"
        ) from exc

    if not keystore:
        raise SystemExit("SAVESTATE_KEYSTORE_BASE64 decoded to an empty file")

    KEYSTORE.parent.mkdir(parents=True, exist_ok=True)
    KEYSTORE.write_bytes(keystore)

    KEY_PROPERTIES.write_text(
        "\n".join(
            [
                f"storePassword={store_password}",
                f"keyPassword={store_password}",
                f"keyAlias={key_alias}",
                "storeFile=savestate-release.jks",
                "",
            ]
        ),
        encoding="utf-8",
    )

    text = APP_GRADLE.read_text(encoding="utf-8")

    loader = """\
import java.io.FileInputStream
import java.util.Properties

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
"""

    if "val keystoreProperties =" not in text:
        text = loader + text

    signing_block = """\
    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
        }
    }

"""

    if 'create("release")' not in text:
        marker = "    buildTypes {"
        if marker not in text:
            raise SystemExit(
                "Could not find android.buildTypes in generated build.gradle.kts"
            )
        text = text.replace(marker, signing_block + marker, 1)

    text = text.replace(
        'signingConfig = signingConfigs.getByName("debug")',
        'signingConfig = signingConfigs.getByName("release")',
    )

    APP_GRADLE.write_text(text, encoding="utf-8")
    print("Persistent release signing configured.")


if __name__ == "__main__":
    main()
