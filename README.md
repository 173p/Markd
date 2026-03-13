<div align="center">
  <img width="120" height="120" alt="Markd logo" src="https://github.com/user-attachments/assets/208042c0-8ba5-4230-b784-9cfe026f013c" />

  <h1>Markd</h1>
  <p><strong>YouTube Timestamp Marker Extension</strong></p>

  <p>
    <a href="#-installation">Install</a> ·
    <a href="#-usage">Usage</a> ·
    <a href="#-features">Features</a> ·
    <a href="#%EF%B8%8F-project-structure">Structure</a> ·
    <a href="#-troubleshooting">Troubleshooting</a>
  </p>

  <p>
    <!-- Replace with real badge URLs once published -->
    <img alt="Chrome Web Store" src="https://img.shields.io/badge/Chrome-Coming%20Soon-4285F4?logo=googlechrome&logoColor=white" />
    <img alt="Firefox Add-ons" src="https://img.shields.io/badge/Firefox-Coming%20Soon-FF7139?logo=firefox&logoColor=white" />
    <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-green" />
  </p>
</div>

---

Markd automatically adds chapter markers to YouTube videos by intelligently extracting timestamps from multiple sources with smart priority-based loading.

---

## Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
  - [Automatic Chapter Detection](#automatic-chapter-detection)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Custom Timestamps](#custom-timestamps)
  - [Supported Timestamp Formats](#supported-timestamp-formats)
  - [Chapter Source Priority](#chapter-source-priority)
- [Project Structure](#%EF%B8%8F-project-structure)
- [Troubleshooting](#-troubleshooting)
- [Credits](#-credits)

---

## ✨ Features

- **Multi-source chapter detection** — pulls from SponsorBlock, video descriptions, and comments
- **Custom timestamps** — paste your own timestamps from any format via the extension popup
- **Smart deduplication** — detects native YouTube chapters and avoids conflicts with the SponsorBlock extension
- **Keyboard navigation** — jump between chapters without touching the mouse
- **Validation** — timestamps are validated against actual video duration before injection

---

## 📦 Installation

| Browser | Link |
|---------|------|
| Chrome  | *(coming soon)* |
| Firefox | *(coming soon)* |

> **Manual installation:** Download the latest release, go to `chrome://extensions/` (or `about:debugging` in Firefox), enable Developer Mode, and load the unpacked folder.

---

## 🚀 Usage

### Automatic Chapter Detection

Markd runs automatically on every YouTube video — no setup needed.

1. Open any YouTube video (`youtube.com/watch?v=...`)
2. Chapter markers appear on the progress bar automatically
3. Hover over a marker to see its chapter title
4. Click a marker to jump to that chapter

### Keyboard Shortcuts

Navigate chapters hands-free:

| Browser | Shortcut | Action |
|---------|----------|--------|
| Firefox | `Ctrl + ←` / `Ctrl + →` | Previous / Next chapter |
| Chrome  | `Shift + ←` / `Shift + →` | Previous / Next chapter |

> Different shortcuts per browser to avoid conflicts with the [SponsorBlock](https://sponsor.ajay.app/) extension.

### Custom Timestamps

Override automatic chapters with your own timestamps:

1. Click the **Markd extension icon** while watching a video
2. Paste timestamps into the text box (any [supported format](#supported-timestamp-formats))
3. Click **"Apply Timestamps"** to override the current chapters
4. Click **"Clear"** to restore the original chapters

### Supported Timestamp Formats

Markd parses all common timestamp styles found in descriptions and comments:

| Format | Example |
|--------|---------|
| Basic | `0:00 Introduction` |
| With dash | `0:00 - Introduction` |
| Zero-padded | `00:00 Introduction` |
| Bracketed | `[0:00] Introduction` |
| Reversed | `Introduction - 0:00` |
| With hours | `1:23:45 Introduction` |

### Chapter Source Priority

Markd uses a tiered fallback system — higher-priority sources are always preferred:

```
1. SponsorBlock API   ← Community-verified, most reliable
2. Video Description  ← Official creator chapters
3. Video Comments     ← User-submitted (scans top 200 comments)
```

Custom timestamps (entered via the popup) override all of the above.

---

## 🏗️ Project Structure

```
Markd/
├── manifest.json                      # Extension manifest (v3)
├── icons/                             # Extension icons (16, 32, 192, 512px)
├── src/
│   ├── content/                       # Core extension logic
│   │   ├── content.js                 # Entry point & message handling
│   │   ├── chapterManager.js          # Chapter sourcing & validation
│   │   ├── sponsorBlockAPI.js         # SponsorBlock integration
│   │   ├── invidiousAPI.js            # Invidious API (fallback)
│   │   ├── descriptionParser.js       # Description timestamp parsing
│   │   ├── commentScanner.js          # Comment scanning
│   │   ├── timestampParser.js         # Timestamp format parsing
│   │   ├── uiInjector.js              # Visual chapter marker injection
│   │   └── playerIntegration.js       # YouTube player controls
│   ├── popup/                         # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── styles/
│   │   ├── variables.css              # Color palette / CSS variables
│   │   └── chapters.css               # Chapter marker styles
│   └── utils/
│       ├── browserCompat.js           # Cross-browser API compatibility
│       ├── logger.js                  # Debug logging
│       ├── storage.js                 # Browser storage wrapper
│       ├── domObserver.js             # DOM change detection
│       └── pageDataExtractor.js       # YouTube page data extraction
└── README.md
```

---

## 🔧 Troubleshooting

<details>
<summary><strong>Chapters not appearing</strong></summary>

1. Verify Markd is enabled at `chrome://extensions/` (or `about:addons` in Firefox)
2. Hard-reload the YouTube page (`Ctrl+Shift+R`)
3. Check that the video has timestamps in at least one source (description, comments, or SponsorBlock)
4. Test on a different video with known chapters to rule out a video-specific issue

</details>

<details>
<summary><strong>Conflicts with SponsorBlock</strong></summary>

Markd automatically detects if the [SponsorBlock extension](https://sponsor.ajay.app/) is active. When detected, Markd skips marker injection to prevent duplicate styling on the progress bar. This is expected behavior.

</details>

<details>
<summary><strong>Wrong chapter source being used</strong></summary>

Markd always uses the highest-priority source available: **SponsorBlock → Description → Comments**. If a higher-priority source exists for a video, lower-priority ones are skipped. Use the popup to paste custom timestamps if you want to override the detected source entirely.

</details>

---

## 🙏 Credits

- [**SponsorBlock**](https://github.com/ajayyy/SponsorBlock)
- [**Invidious**](https://github.com/iv-org/invidious)
