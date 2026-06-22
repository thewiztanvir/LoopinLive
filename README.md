# LoopinLive

<p align="center">
  <img src="public/Loopin-Live-Logo.png" alt="LoopinLive Logo" width="120" />
</p>

LoopinLive is a production-grade web IPTV player engineered with **Next.js 16**, **React 19**, and **Tailwind CSS v4**. It provides enterprise-grade playback, advanced playlist management, curated live channel discovery, and integrated sports intelligence.

**Live Demo:** https://LoopinLiveTV.netlify.app

---

## Overview

LoopinLive delivers a modern platform for streaming live television and sports content through a responsive browser experience. The application supports core IPTV workflows, including live playback, channel search, category filtering, playlist import, and real-time football match tracking.

---

## Key Capabilities

- **High-quality streaming**: HLS and DASH playback with adaptive fallback behavior for native Safari and non-Safari browsers.
- **Playlist management**: Load remote playlists via URL, upload local `.m3u`, `.m3u8`, or `.json` files, and persist user playlists in browser storage.
- **Channel discovery**: Search and filter 6500+ channels by category, region, and curated collections.
- **Sports integration**: Dedicated sports dashboard for live football scores, match events, standings, and FIFA World Cup 2026 coverage.
- **Premium UI**: Responsive glassmorphism design, skeleton loading states, sticky navigation, and an optimized low-overhead visual background.
- **Browser persistence**: Custom playlists and selections are stored locally for session continuity.

---

## Product Highlights

### Streaming & Playback

LoopinLive ships with a capable media layer that handles:

- HLS playback with `hls.js` fallback on non-native platforms
- DASH playback via `shaka-player`
- native playback fallback for Safari
- fullscreen mode and Picture-in-Picture support
- custom volume and mute controls
- robust error handling and stream recovery

### Playlist Management

Users can manage IPTV playlists using the following flows:

- import playlist URLs
- upload local `.m3u`, `.m3u8`, or `.json` files
- browse and select saved playlists
- delete custom playlists from local browser storage

### Sports Experience

LoopinLive includes a sports-oriented interface with live football data, including:

- match scorecards and live status
- recent goal and event listings
- competition standings
- FIFA World Cup 2026 announcement and dedicated channel category

---

## Data Sources

The application includes built-in data files and API support for channel catalogs and sports content.

- Primary channel catalog: `app/data/channels.json`
- FIFA World Cup channel catalog: `app/data/fifa.json`
- Generated M3U output: `app/data/channels.m3u`

### Raw Data Access

- JSON catalog
  ```text
  https://raw.githubusercontent.com/thewiztanvir/LoopinLive/refs/heads/main/app/data/channels.json
  ```
- M3U playlist
  ```text
  https://raw.githubusercontent.com/thewiztanvir/LoopinLive/refs/heads/main/app/data/channels.m3u
  ```

---

## Development

### Prerequisites

- Node.js 18 or newer

### Setup

```bash
git clone https://github.com/thewiztanvir/LoopinLive.git
cd LoopinLive
npm install
npm run dev
```

Open http://localhost:3000 to launch the application.

### Production build

```bash
npm run build
npm start
```

---

## Utility Scripts

The repository includes a JSON-to-M3U conversion utility for channel catalogs.

- Convert all supported JSON channel files:
  ```bash
  npm run convert-m3u
  ```
- Convert FIFA channels only:
  ```bash
  npm run convert-fifa
  ```
- Convert a custom JSON file:
  ```bash
  node scripts/json-to-m3u.js <path-to-input.json> <path-to-output.m3u>
  ```

---

## Technology Stack

- **Next.js 16**
- **React 19**
- **Tailwind CSS v4**
- **Motion** for animations
- **HLS.js** for HLS playback
- **Shaka Player** for DASH playback

---

## Compliance

LoopinLive does not host or own any media content. It acts as a client application for publicly available IPTV streams and playlists. Channel availability may change over time.

If you are the copyright owner of any content presented through this repository and wish to request removal, please open an issue.

---

## Attribution

Developed by Mitab Sany.

---

## License

This project is licensed under the GNU General Public License v3 (GPLv3). Any derivative work based on this repository must remain open source under the same license and preserve attribution.
