# Markd - YouTube Timestamp Marker Extension

**Markd** automatically adds chapter markers to YouTube videos by intelligently extracting timestamps from multiple sources with priority-based loading.

## Features

- **Multi-Source Chapter Detection**:
  1. **SponsorBlock API** - Community-submitted chapters (fastest, most reliable)
  2. **Video Description** - Official YouTube chapters and timestamps
  3. **Comments** - User-submitted timestamps (fallback)

- **Custom Timestamps**:
  - Click extension icon to paste your own timestamps
  - Supports formats: `0:00 Title`, `[0:00] Title`, `00:00 - Title`
  - Overrides automatic chapters when needed
  - Reset to original chapters anytime


- **Smart Detection**:
  - Auto-detects YouTube native chapters
  - Avoids duplicates with SponsorBlock extension
  - Validates timestamps against video duration

## Installation

### Chrome / Firefox
placeholder link for chrome
placeholder link for firefox

## Usage

### Automatic Chapter Detection

Markd automatically detects and displays chapters when you open a YouTube video:

1. **Open any YouTube video** (`youtube.com/watch?v=...`)
2. **Chapter markers appear** on the progress bar automatically
3. **Hover over markers** to see chapter titles
4. **Click markers** to jump to chapters

### Keyboard Shortcuts

Navigate between chapters using keyboard shortcuts:

- **Firefox**: `Ctrl + ←/→` (Left/Right Arrow) - Skip to previous/next chapter
- **Chrome**: `Shift + ←/→` (Left/Right Arrow) - Skip to previous/next chapter

**Note**: Different shortcuts per browser to avoid conflicts with SponsorBlock extension

### Custom Timestamps

Add your own timestamps from comments or descriptions:

1. **Click the Markd extension icon** while watching a video
2. **Paste timestamps** in any supported format:
   ```
   0:00 Introduction
   1:30 Main Topic
   5:45 Conclusion
   ```
3. **Click "Apply Timestamps"** to override automatic chapters
4. **Click "Clear"** to reset to original chapters

### Supported Timestamp Formats

- `0:00 Title` - Basic format
- `0:00 - Title` - With dash separator
- `00:00 Title` - Zero-padded
- `[0:00] Title` - Bracketed timestamp
- `Title - 0:00` - Reversed format
- `1:23:45 Title` - Hour:minute:second format

### Chapter Source Priority

Markd uses a smart priority system:

1. **SponsorBlock API** (highest priority)
   - Community-verified chapters
   - Most reliable and accurate
   - Fetched from SponsorBlock database

2. **Video Description** (medium priority)
   - Official YouTube chapters
   - Creator-submitted timestamps
   - Parsed from description text

3. **Comments** (lowest priority / fallback)
   - User-submitted timestamps
   - Scanned from top 200 comments
   - Auto-fixed and deduplicated

## 🏗️ Project Structure

```
Markd/
├── manifest.json                      # Extension manifest (v3)
├── icons/                             # Extension icons
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── android-chrome-192x192.png
│   └── android-chrome-512x512.png
├── src/
│   ├── content/                       # Main extension logic
│   │   ├── content.js                 # Entry point & message handling
│   │   ├── chapterManager.js          # Chapter sourcing & validation
│   │   ├── sponsorBlockAPI.js         # SponsorBlock integration
│   │   ├── invidiousAPI.js            # Invidious API (fallback)
│   │   ├── descriptionParser.js       # Description parsing
│   │   ├── commentScanner.js          # Comment scanning
│   │   ├── timestampParser.js         # Timestamp format parsing
│   │   ├── uiInjector.js              # Visual chapter markers
│   │   └── playerIntegration.js       # YouTube player controls
│   ├── popup/                         # Extension popup UI
│   │   ├── popup.html                 # Popup interface
│   │   ├── popup.js                   # Popup logic
│   │   └── popup.css                  # Popup styling
│   ├── styles/                        # CSS files
│   │   ├── variables.css              # Color palette
│   │   └── chapters.css               # Chapter marker styles
│   └── utils/                         # Utility modules
│       ├── browserCompat.js           # Cross-browser API compatibility
│       ├── logger.js                  # Debug logging
│       ├── storage.js                 # Browser storage wrapper
│       ├── domObserver.js             # DOM change detection
│       └── pageDataExtractor.js       # YouTube page data extraction
└── README.md
```

## Troubleshooting

### Chapters Not Appearing

1. Verify extension is enabled in `chrome://extensions/`
2. Reload the YouTube page
3. Ensure video has chapters from at least one source
4. Try a different video with known chapters

### Conflicts with SponsorBlock

- Markd automatically detects SponsorBlock extension
- If SponsorBlock is enabled, Markd will skip injection
- This prevents duplicate styling on the progress bar

### Wrong Chapter Source

- Priority: SponsorBlock → Description → Comments
- If higher-priority source exists, lower ones are skipped
- Use custom timestamps to override any source


## 🙏 Credits

- **SponsorBlock** - Community chapter database
- **Invidious** - Video metadata API
