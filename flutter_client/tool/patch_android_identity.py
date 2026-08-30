#!/usr/bin/env python3
"""Set the visible app name and opt in to Android predictive back.

`flutter create` labels the app from the Dart package name and leaves
predictive-back off. Android 13–16 need enableOnBackInvokedCallback to
preview the previous screen (or the launcher) during a back gesture.
"""
from pathlib import Path
import re

MANIFEST = Path("android/app/src/main/AndroidManifest.xml")
STRINGS = Path("android/app/src/main/res/values/strings.xml")
STYLES = [
    Path("android/app/src/main/res/values/styles.xml"),
    Path("android/app/src/main/res/values-night/styles.xml"),
]


CALLBACK_ACTIVITY = '''
        <activity
            android:name="com.linusu.flutter_web_auth_2.CallbackActivity"
            android:exported="true"
            android:taskAffinity="">
            <intent-filter android:label="flutter_web_auth_2">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="savestate" />
            </intent-filter>
        </activity>
'''


def patch_manifest(text: str) -> str:
    text = re.sub(r'android:label="[^"]*"', 'android:label="SaveState"', text)
    if "enableOnBackInvokedCallback" in text:
        text = re.sub(
            r'android:enableOnBackInvokedCallback="[^"]*"',
            'android:enableOnBackInvokedCallback="true"',
            text,
        )
    else:
        text = text.replace(
            "<application",
            '<application android:enableOnBackInvokedCallback="true"',
            1,
        )
        text = text.replace(
            "<activity",
            '<activity android:enableOnBackInvokedCallback="true"',
            1,
        )
    if "flutter_web_auth_2.CallbackActivity" not in text:
        text = text.replace("</application>", CALLBACK_ACTIVITY + "    </application>", 1)
    return text


def patch_strings(text: str) -> str:
    text = re.sub(
        r'<string name="app_name">[^<]*</string>',
        '<string name="app_name">SaveState</string>',
        text,
    )
    return text


def patch_styles(text: str) -> str:
    # Gives the predictive-back peek a dark plate instead of white flash.
    if "android:windowBackground" in text:
        return text
    return text.replace(
        "</style>",
        "        <item name=\"android:windowBackground\">#0F1416</item>\n    </style>",
        1,
    )


def main() -> None:
    if not MANIFEST.exists():
        raise SystemExit(f"missing {MANIFEST}")
    MANIFEST.write_text(patch_manifest(MANIFEST.read_text()))
    print("patched", MANIFEST)

    if STRINGS.exists():
        STRINGS.write_text(patch_strings(STRINGS.read_text()))
        print("patched", STRINGS)

    for path in STYLES:
        if path.exists():
            path.write_text(patch_styles(path.read_text()))
            print("patched", path)


if __name__ == "__main__":
    main()
