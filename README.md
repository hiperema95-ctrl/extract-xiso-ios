<div align="center">

# 💿 Extract-XISO for iOS

**Native iOS (`arm64`) and Web utility to inspect, extract, optimize, and build Xbox & Xbox 360 (`XDVDFS` / `XISO`) disc images directly on iPhone, iPad, and modern browsers.**

[![Build Unsigned iOS IPA](https://github.com/hiperema95-ctrl/extract-xiso-ios/actions/workflows/build-ipa.yml/badge.svg)](https://github.com/hiperema95-ctrl/extract-xiso-ios/actions/workflows/build-ipa.yml)
[![Platform](https://img.shields.io/badge/Platform-iOS%2015.0%2B%20%7C%20iPadOS%20%7C%20Web-107C10?logo=apple)](https://github.com/hiperema95-ctrl/extract-xiso-ios)
[![License](https://img.shields.io/badge/License-BSD%204--Clause-blue.svg)](LICENSE.TXT)

</div>

---

## 📖 Overview

**extract-xiso-ios** brings the functionality of [`XboxDev/extract-xiso`](https://github.com/XboxDev/extract-xiso) to iOS, iPadOS, and the Web with a dark-themed interface inspired by the iOS *Files* app. 

The repository provides two complete implementations:
1. **Native iOS App (`ios/`):** Built with **SwiftUI** and a 64-bit **C bridge (`XISOBridge.c`)** using `fseeko` for large multi-gigabyte images (`> 4 GB`). It integrates natively with the iOS Document Picker, *Files* app (`UISupportsDocumentBrowser`), and iTunes/Finder file sharing (`UIFileSharingEnabled`).
2. **Browser XDVDFS Studio (`src/`):** A client-side **TypeScript/React** engine (`xdvdfs.ts` & `zipBuilder.ts`) that uses chunked `Blob.slice()` reads and streaming **ZIP64** generation, allowing you to inspect, extract, optimize, and create `4.7 GB – 8.5 GB` Xbox ISOs in the browser without loading the entire image into RAM.

---

## ✨ Key Features

* **📂 Full XDVDFS Directory Tree Inspector:** Parses the Volume Descriptor at Sector `32` (`0x10000`), validates the `MICROSOFT*XBOX*MEDIA` signature, and traverses the binary search tree directory records showing LBA sectors, byte offsets, file sizes, and attributes.
* **🔍 Automatic Partition Offset Detection:** Instantly detects trimmed XISOs as well as raw/Redump DVD9 images (Original Xbox `XGD1`, Xbox 360 `XGD2`, and `XGD3`) with an automatic fallback scanner across the first `600 MB`.
* **🎮 `.XBE` & `.XEX` Header Parser & Media Patching:**
  * Reads Original Xbox (`XBEH` / `default.xbe`) and Xbox 360 (`XEX2` / `default.xex`) headers to extract the internal **Title Name** and **Title ID (Hex)**.
  * Optional automatic in-place **`.XBE` Media & Region Patching** (`0x00FFFFFF` / `0x80000007`) so extracted or rebuilt Original Xbox backups can boot from any media (HDD / DVD-R).
* **⚡ Extract Mode (`-x`):**
  * Extract individual files, custom multi-file selections, or the entire disc image.
  * Export directly to a local directory or package into a zero-compression (`STORE`) **ZIP / ZIP64** archive supporting extractions over `4 GB` without 32-bit offset overflow.
* **🔄 Rewrite & Optimize Mode (`-r`):** Strip video padding partitions from raw Redump images and rebuild a clean, sector-aligned trimmed `.iso` from all or selected files.
* **🛠️ Create Mode (`-c`):** Assemble a local game folder or file queue into a compliant `XDVDFS` `.iso` image with balanced Binary Search Tree (BST) directory tables and 32-sector boundary padding.
* **🌍 25+ Languages Supported:** Automatic OS language detection plus manual switcher for English, Italian, Spanish, French, German, Portuguese, Russian, Japanese, Simplified/Traditional Chinese, Korean, Arabic (with RTL layout), Hindi, Turkish, Dutch, Polish, Swedish, Ukrainian, Vietnamese, Thai, Indonesian, Czech, Greek, Romanian, and Hungarian.

---

## 📀 Supported Disc Image Formats & Offsets

Both the native iOS C engine and the Web engine automatically detect the game partition at the following base offsets (where the Volume Descriptor resides at `Base Offset + 0x10000`):

| Format / Image Type | Partition Base Offset | Volume Descriptor Offset |
| :--- | :--- | :--- |
| **Standard / Trimmed XISO** | `0x00000000` | `0x00010000` (Sector 32) |
| **Original Xbox (XGD1 Redump)** | `0x18300000` | `0x18310000` |
| **Xbox 360 (XGD2 Redump / DVD9)** | `0x0FD90000` | `0x0FDA0000` |
| **Xbox 360 (XGD2 Wave 1/2)** | `0x06060000` | `0x06070000` |
| **Xbox 360 (XGD3 Redump)** | `0x02080000` | `0x02090000` |
| **Xbox 360 (XGD3 Alternative)** | `0x02060000` | `0x02070000` |
| **Custom / Non-Standard** | *Auto-Scan (`0x0` – `600 MB`)* | *64 KB coarse + 2048 B sector scan* |

---

## 📲 iOS Installation (Sideloading)

### Option A: Download from Releases (Recommended)
1. Go to the [**Releases**](../../releases) page and download the latest `ExtractXISO-unsigned.ipa`.
2. Sideload the `.ipa` on your iPhone or iPad (iOS / iPadOS `15.0+`) using your preferred tool:
   * **SideStore** / **AltStore**
   * **Feather** / **eSign** / **Sideloadly**
   * **LiveContainer** / **TrollStore**

### Option B: Download from GitHub Actions Artifacts
Every push to `main` automatically compiles a fresh unsigned `.ipa` via GitHub Actions:
1. Open the [**Actions**](../../actions) tab at the top of this repository.
2. Click on the latest successful **Build Unsigned iOS IPA (Extract-XISO)** workflow run.
3. Scroll down to **Artifacts** and download `ExtractXISO-unsigned-ipa`.

---

## 🛠️ Building from Source

### 1. Native iOS App (`XcodeGen` + `xcodebuild`)
The iOS project uses [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`ios/project.yml`) for clean, reproducible project generation without fragile `.xcodeproj` UUID conflicts.

```bash
# 1. Install XcodeGen (macOS with Homebrew)
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
