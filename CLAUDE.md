# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bog Factor is a monthly radio show hosted by Sophie and Emily on EHFM, a community radio station broadcasting from Edinburgh. The girls play music of all genres but with a particular bent for psychedelic, folk, and sleazy music. They are inspired by nature and the neolithic, and have a particular fondness for the Rhynie Man, who they want to free from his shackles.

The show is live from 1pm-2pm UK time on the first Friday of every month.

## Web Design Principles

As much as is practical the site is built with vanilla HTML, CSS, and JavaScript with no build process or dependencies.

The website is intended to be quirky and fun with playful elements.

When the show is live on air the site should transform and encourage users to listen and chat with the hosts.

The colour pallette should use warm earthy tones, and avoid hard blacks and whites. Folksy motifs should be used, with design inspired by folk art, old guide books, and other old world ephemera.

## Hosting

The website is hosted on Cloudflare Pages, and the domain [bogfactor.co.uk](https://bogfactor.co.uk) is connected with the `main` branch of this repository.

## Architecture

### Site Structure

The site uses a flat directory structure with section-based organization:

- `index.html` - Landing page with background image, live stream widget, and footer links
- `radio/index.html` - Radio show archive with embedded Mixcloud players and tracklist modals
- `about/index.html` - About page with information about the show and hosts
- `radio/shows.json` - Master data file containing all show metadata and tracklists
- `styles.css` - Global stylesheet shared across all pages
- `scripts/` - JavaScript modules for interactive features
- `assets/` - Image and other media files
- `tools/` - Development utilities and test files

### Navigation Pattern

All subpages (radio, about) share a consistent layout:
- Toolbar navigation at the top with links to Home, Radio, and About
- SVG wavy border filters for visual effects
- Footer with Instagram and Email mailto links

The landing page (`index.html`) has a minimal layout with the background image, toolbar navigation, live stream widget (when show is live), and footer.

### CSS Architecture

`styles.css` contains:
- Global typography using Luminari (display) and Noto Serif Gurmukhi (body text) from CDN fonts
- `.textbox` class for content boxes with SVG wavy borders and noise texture effect
- `.toolbar` styles for the navigation bar
- `.stream-widget` styles for the live streaming player interface
- `.modal` styles for tracklist popups on the radio page
- Draggable sun elements with animations
- Responsive footer layout

### JavaScript Features

The site uses vanilla JavaScript modules for interactive features:

- `scripts/draggable-suns.js` - Creates draggable sun elements that float across the page
- `scripts/live-stream.js` - Manages the live stream player and widget on the landing page
- `scripts/mixcloud-player.js` - Fixed player at bottom of page for Mixcloud show playback
- `scripts/toolbar-live-widget.js` - Live indicator widget shown in the toolbar during broadcasts

All scripts use IIFE (Immediately Invoked Function Expressions) to avoid global namespace pollution.

### Asset Organization

Images in `assets/`:
- `sun_image.png` - Draggable sun element used throughout the site
- `vibes-graphic.jpg` - Landing page background image
- `sophie-and-emily.jpg` - Photo of hosts used on about page
- `bog factor scale.jpg` - Interactive bog factor scale (expands on hover)
- Show-specific images:
  - `conker-season-pack.png` - Conk Factor 2025 episode
  - `crop-circle-pic.jpg` - Space Age Special episode
  - `ehfm-ground-floor-studio.jpg` - First show in residency
  - `Helston-Dragon.jpg` - Beltane episode
  - `no-souptember.jpg` - Summer Isn't Over episode
  - `the-stranglers.jpg` - Soft Rock & Sleaze episode

### Show Data Structure

Show metadata is stored in `radio/shows.json` as an array of show objects. Each show contains:
- `id` - Unique identifier (e.g., "nov2025")
- `title` - Show title and date
- `description` - Brief description of the episode theme
- `mixcloudPath` - Path to the Mixcloud player (e.g., "/ehfm/bog-fav/")
- `date` - Date in YYYY-MM format
- `image` (optional) - Relative path to show-specific image
- `tracklist` - Array of track strings in "Artist - Title" format

The radio page dynamically generates show cards and tracklist modals from this JSON file.

### Development Tools

The `tools/` directory contains:
- `test-live.html` - Test page for live streaming widget functionality
- `rekordbox-to-json.py` - Python utility to convert Rekordbox DJ playlist exports to JSON format
- `sync-playlists.py` - Syncs all tracks from `shows.json` to "Bog Factor" playlists on Spotify and Tidal
- `requirements.txt` - Python dependencies for `sync-playlists.py` (tidalapi, spotipy, python-dotenv)
- `README.md` - Instructions for adding new radio shows and using the playlist sync tool

## Playlist Sync

`tools/sync-playlists.py` automatically syncs every track from `radio/shows.json` to a "Bog Factor" playlist on Spotify and Tidal. It uses fuzzy matching to find tracks, handling quirks like curly quotes, feat. suffixes, and swapped artist/title fields.

### GitHub Actions

The workflow at `.github/workflows/sync-playlists.yml` runs automatically when `radio/shows.json` is pushed to `main`, or manually via workflow_dispatch.

Required GitHub Actions secrets:
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` - Spotify OAuth credentials
- `TIDAL_REFRESH_TOKEN` - Tidal OAuth refresh token (obtained via `--setup tidal`)
- `GH_PAT` - GitHub Personal Access Token with `secrets` read/write permission, used to rotate the Tidal refresh token after each run

### Local Usage

Python dependencies are in `tools/requirements.txt` with a venv at `tools/.venv`:

```bash
source tools/.venv/bin/activate
python tools/sync-playlists.py --dry-run          # preview changes
python tools/sync-playlists.py --service tidal     # sync only Tidal
python tools/sync-playlists.py --setup tidal       # interactive first-time auth
```

Local credentials are stored in a `.env` file in the repo root (gitignored).

### Tidal Auth Notes

Tidal uses PKCE OAuth. The access token is short-lived (~24 hours) but the refresh token is used to obtain new access tokens automatically. The script calls `token_refresh()` explicitly before loading the session, since tidalapi's built-in refresh only triggers on "token expired" errors, not missing tokens. After each CI run, if the refresh token rotates, the workflow updates the `TIDAL_REFRESH_TOKEN` secret via `gh secret set`.

## Development

This is a static site with no build process. To develop:

1. Edit HTML, CSS, or JS files directly
2. Open files in browser or serve with any static server (e.g., `python3 -m http.server`)

### Path Conventions

- Root-relative paths are used for navigation links (e.g., `/index.html`, `/radio/index.html`)
- Relative paths are used for assets and scripts within subdirectories:
  - Landing page uses: `styles.css`, `scripts/`, `assets/`
  - Subpages use: `../styles.css`, `../scripts/`, `../assets/`
- Show images in `shows.json` use relative paths: `../assets/image-name.jpg`

When adding new pages or modifying paths, maintain consistency with the existing pattern for that section.

## Current State

The site is actively being worked on with recent enhancements:
- Live streaming widget added to landing page with play/pause controls
- Fixed Mixcloud player for radio archive with slide-up/down animations
- Draggable sun elements for interactive experience
- Tracklist modals with YouTube search integration
- Automated playlist sync to Spotify and Tidal via GitHub Actions
- Clean, optimized codebase with unused files removed

### Best Practices

- Use vanilla HTML, CSS, and JavaScript for fast loading times
- Keep the codebase minimal and clean - no build process or dependencies
- Store all show data in `radio/shows.json` for easy updates
- Use root-relative paths for navigation, relative paths for assets
- Test changes using a local static server or by opening files directly in browser

## Testing

Usually in active development we will spin up a local web server, this will host the site at `http://127.0.0.1:3000`

Any new feature that affects the website when Bog Factor is live on air (or the transitions between live and not live) should be added in an identical manner to the test pages at `tools\test-live.html` and `tools\test-countdown.html`. Testing is a very important part of development and should be considered whenever making any changes.

The procedure for testing is something like:
- Open `index.html` in browser to test landing page
- Navigate to subpages (`radio/`, `about/`) to test those sections
- Test tracklist modals and YouTube search links on the radio page
- Test Mixcloud widgets on the radio page
- Test draggable sun elements by clicking and dragging them
- Test behaviour of the site when Bog Factor is on air using `tools/test-live.html`
- Test behaviour of the site when Bog Factor goes on and off air using `tools/test-countdown.html`
- Verify show data displays correctly after editing `radio/shows.json`

Further documentation of these test features is included in `radio/README.md`