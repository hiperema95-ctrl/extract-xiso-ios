<div align="center">

# 💿 Extract-XISO for iOS

**Native iOS (`arm64`) utility to inspect and extract Xbox & Xbox 360 (`XDVDFS` / `XISO`) disc images directly on iPhone.**

[![Build Unsigned iOS IPA](https://github.com/hiperema95-ctrl/extract-xiso-ios/actions/workflows/build-ipa.yml/badge.svg)](https://github.com/hiperema95-ctrl/extract-xiso-ios/actions/workflows/build-ipa.yml)
[![Platform](https://img.shields.io/badge/Tested%20on-iPhone%2016%20Pro%20(LiveContainer)-107C10?logo=apple)](https://github.com/hiperema95-ctrl/extract-xiso-ios)
[![License](https://img.shields.io/badge/License-BSD%204--Clause-blue.svg)](LICENSE.TXT)

</div>

---

## 📖 Overview

**extract-xiso-ios** is a native iOS port of [`XboxDev/extract-xiso`](https://github.com/XboxDev/extract-xiso), converted and structured with the assistance of **Google AI Studio**.

Built with **SwiftUI** and a 64-bit **C bridge (`XISOBridge.c`)**, it allows you to open, browse, and extract multi-gigabyte Xbox and Xbox 360 `.iso` / `.xiso` disc images (`> 4 GB`) directly on your iPhone without needing a PC. It integrates directly with the iOS **Files** app (`UIDocumentPickerViewController`).

> ### ⚠️ Important Compatibility Notice
> * **Tested Device:** Currently tested **exclusively on iPhone 16 Pro** (not tested on iPad).
> * **Execution Environment:** Currently works **only inside [LiveContainer](https://github.com/LiveContainer/LiveContainer)**. Standard standalone sideloading outside of LiveContainer is not supported at this time.

---

## ✨ Key Features

* **📂 Full XDVDFS Directory Tree Browser:** Parses the Volume Descriptor at Sector `32` (`0x10000`), validates the `MICROSOFT*XBOX*MEDIA` signature, and traverses the binary directory tree displaying file sizes and LBA sector offsets.
* **🔍 Automatic Partition Offset Detection:** Supports both standard trimmed XISOs and full raw/Redump DVD9 disc images (Original Xbox `XGD1`, Xbox 360 `XGD2`, and `XGD3`), including an automatic 64 KB fallback scanner across the first `600 MB`.
* **🎮 `.XBE` & `.XEX` Metadata & Media Patching:**
  * Reads Original Xbox (`XBEH` / `default.xbe`) and Xbox 360 (`XEX2` / `default.xex`) headers to display the internal **Title Name** and **Title ID (Hex)**.
  * Optional automatic in-place **`.XBE` Media & Region Patching** (`0x00FFFFFF` / `0x80000007`) during extraction.
* **⚡ Full or Single-File Extraction (`-x`):**
  * Tap any individual file (e.g., `default.xex`, `default.xbe`, or game assets) to extract and export it immediately.
  * Extract the entire ISO image preserving its full folder hierarchy directly into the iOS **Files** app.
* **🌍 25+ Languages Included:** Automatic iOS system language detection plus built-in language selector (English, Italian, Spanish, French, German, Portuguese, Russian, Japanese, Chinese, Korean, Arabic, Hindi, Turkish, Dutch, Polish, Swedish, Ukrainian, Vietnamese, Thai, Indonesian, Czech, Greek, Romanian, and Hungarian).

---

## 📀 Supported Disc Image Formats & Offsets

The native 64-bit C engine (`XISOBridge.c`) automatically detects the game partition at the following base offsets (where the Volume Descriptor resides at `Base Offset + 0x10000`):

| Format / Image Type | Partition Base Offset | Volume Descriptor Offset |
| :--- | :--- | :--- |
| **Standard / Trimmed XISO** | `0x00000000` | `0x00010000` (Sector 32) |
| **Original Xbox (XGD1 Redump)** | `0x18300000` | `0x18310000` |
| **Xbox 360 (XGD2 Redump / DVD9)** | `0x0FD90000` | `0x0FDA0000` |
| **Xbox 360 (XGD2 Wave 1/2)** | `0x06060000` | `0x06070000` |
| **Xbox 360 (XGD3 Redump)** | `0x02080000` | `0x02090000` |
| **Xbox 360 (XGD3 Alternative)** | `0x02060000` | `0x02070000` |
| **Custom / Non-Standard** | *Auto-Scan (`0x0` – `600 MB`)* | *Automatic 64 KB step scan* |

---

## 📲 Installation (LiveContainer Only)

This application requires **LiveContainer** to run properly:

1. Download the latest `ExtractXISO-unsigned.ipa` from the [**Releases**](../../releases) page (or grab the artifact from the [**Actions**](../../actions) tab).
2. Open **LiveContainer** on your iPhone.
3. Tap the **`+`** button in LiveContainer and import `ExtractXISO-unsigned.ipa`.
4. Launch **Extract-XISO** directly from inside **LiveContainer**.

---

## 🚀 How to Use on iPhone

1. Launch **Extract-XISO** inside **LiveContainer** and tap **Open XISO File** (or the disc icon in the top bar).
2. Select your `.iso` or `.xiso` image from the iOS **Files** app.
3. Browse the folders or use the search bar to find specific files:
   * **Single File:** Tap the download button next to any file to extract and save it.
   * **Full Game Extraction:** Tap **Extract All to Folder (-x)** at the bottom to unpack the entire disc image and save the extracted folder via the iOS **Files** picker.

---

## 🛠️ Building from Source

The iOS project uses [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`ios/project.yml`) to generate the Xcode project cleanly.

```bash
# 1. Install XcodeGen (on macOS with Homebrew)
brew install xcodegen

# 2. Generate the Xcode project
cd ios
xcodegen generate

# 3. Build the unsigned Release .app for arm64
xcodebuild clean build \
  -project ExtractXISO.xcodeproj \
  -scheme ExtractXISO \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath build \
  ARCHS="arm64" \
  ONLY_ACTIVE_ARCH=NO \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  DEVELOPMENT_TEAM=""

# 4. Package into an unsigned .ipa
mkdir -p Payload
cp -R "$(find build -name 'ExtractXISO.app' -type d | head -n 1)" Payload/ExtractXISO.app
zip -r9 ExtractXISO-unsigned.ipa Payload
