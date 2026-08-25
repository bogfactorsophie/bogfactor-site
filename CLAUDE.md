## Project Overview

Bog Factor is a monthly radio show hosted by Sophie and Emily on EHFM, a community radio station broadcasting from Edinburgh. The girls play psychedelic, folk, and sleazy music. They are inspired by nature and the neolithic, and have a particular fondness for the Rhynie Man, who they want to free from his shackles.

The show is live from 1pm-2pm UK time on the first Friday of every month.

## Web Design Principles

* Quirky and fun with playful elements
* When Live on Air - the site encourage users to listen and join the chat
* The colour pallette should use warm earthy tones
* Avoid hard blacks and whites
* Folksy motifs should be used, with design inspired by folk art, old guide books, and other old world ephemera.

## Hosting

The website is hosted on Cloudflare Pages, and the domain [bogfactor.co.uk](https://bogfactor.co.uk) is connected with the `main` branch of this repository.

A Cloudflare worker automatically builds preview versions of the site on PR commits

## Architecture

### Site Structure

The site uses a flat directory structure with section-based organization:

- `index.html` - Landing page with background image, live stream widget, and footer links
- `radio/index.html` - Radio show archive with embedded Mixcloud players and tracklist modals
- `about/index.html` - About page with information about the show and hosts
- Show metadata and tracklists live in the `bogfactor` D1 database, served by
  `worker-shows` at `/api/shows`. There is no longer a checked-in data file.
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

Show metadata lives in D1 and is served by `worker-shows` from `GET /api/shows`,
newest first. Each show comes back as:
- `id` - Unique identifier (e.g., "nov2025")
- `title` - Show title and date
- `description` - Brief description of the episode theme
- `mixcloudPath` - Path to the Mixcloud player (e.g., "/ehfm/bog-fav/")
- `airedAt` - ISO date the show went out
- `image` (optional) - `/api/images/{key}`, backed by R2 — **not** a path into `assets/`
- `tracklist` - Array of track strings in "Artist - Title" format

`scripts/generate-show-list.js` (radio page) and `scripts/recent-shows.js`
(landing page) both fetch `/api/shows`. Shows are edited through `/admin/shows`,
which writes to D1 via `/api/admin/shows`.

### Development Tools

The `tools/` directory contains:
- `test-live.html` - Test page for live streaming widget functionality
- `rekordbox-to-json.py` - Python utility to convert Rekordbox DJ playlist exports to JSON format
- `sync-playlists.py` - Syncs all tracks to "Bog Factor" playlists on Spotify and Tidal. **Currently broken:** it still reads the removed `radio/shows.json` and needs repointing at `/api/shows`
- `requirements.txt` - Python dependencies for `sync-playlists.py` (tidalapi, spotipy, python-dotenv)
- `README.md` - Instructions for adding new radio shows and using the playlist sync tool

## Playlist Sync

`tools/sync-playlists.py` syncs every track to a "Bog Factor" playlist on Spotify and Tidal. **It is currently broken:** `SHOWS_JSON` still points at `radio/shows.json`, which has been removed now that shows live in D1. It needs repointing at `/api/shows` (the response already carries `tracklist` per show). It uses fuzzy matching to find tracks, handling quirks like curly quotes, feat. suffixes, and swapped artist/title fields.

### GitHub Actions

The workflow at `.github/workflows/sync-playlists.yml` triggers on pushes to `radio/shows.json`, or manually via workflow_dispatch. Since that file no longer exists, **only the manual trigger can fire** — the trigger needs changing to a cron once the script reads from the API.

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

There is no build step — edit HTML, CSS, or JS files directly. Static-only
pages (e.g. `about/`) can be opened straight in a browser. However, any page
that calls the API — `radio/`, `tracks/`, and `admin/` all `fetch('/api/...')`
— needs the `worker-shows` worker running on the **same origin**, so a bare
`python3 -m http.server` is not enough for those.

### Local dev with the API (recommended)

`worker-shows/wrangler.dev.toml` is a dev-only config that serves the whole
static site **and** the `/api/*` worker from one origin
(`http://127.0.0.1:8787`) against a **local** D1 database, so no `fetch()` URLs
need editing. It is never used in production (live = Pages + the worker route).

First time only — create and seed the local database:

```bash
# Apply the schema to the LOCAL D1
npx wrangler d1 execute bogfactor --local --file=worker-shows/schema.sql -c worker-shows/wrangler.dev.toml

# Seed shows. There is no seed file: the one-off JSON migration and its source
# data have both been removed now that shows live in D1. Export from the
# production database instead, or the local archive comes up empty:
#   npx wrangler d1 export bogfactor --remote --output=tools/out/shows.sql
#   npx wrangler d1 execute bogfactor --local --file=tools/out/shows.sql -c worker-shows/wrangler.dev.toml

# Seed the default broadcast schedule (1st Friday monthly, 13:00–14:00 Europe/London)
npx wrangler d1 execute bogfactor --local --file=tools/seed-schedule.sql -c worker-shows/wrangler.dev.toml
```

Then, to run the site:

```bash
npx wrangler dev -c worker-shows/wrangler.dev.toml --port 8787
# Site + API on http://127.0.0.1:8787  (e.g. /radio/tracks/, /radio/, /api/shows)
```

Local D1 lives under `.wrangler/` (gitignored); re-run the seed step to refresh
it. Show images are not seeded into local R2, so `/api/images/*` will 404
locally — harmless for everything except previewing show artwork.

Note: `/api/admin/*` still requires a `Cf-Access-Jwt-Assertion` header (injected
by Cloudflare Access in production), so the admin page's write actions won't
work against local dev as-is.

### Static-only quick look

For pages that don't touch the API, you can still serve statically:

```bash
python3 -m http.server 3000   # http://127.0.0.1:3000
```

### Path Conventions

- Root-relative paths are used for navigation links (e.g., `/index.html`, `/radio/index.html`)
- Relative paths are used for assets and scripts within subdirectories:
  - Landing page uses: `styles.css`, `scripts/`, `assets/`
  - Subpages use: `../styles.css`, `../scripts/`, `../assets/`

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
- Store all show data in D1, edited through `/admin/shows` — never in a checked-in file
- Use root-relative paths for navigation, relative paths for assets
- Test changes using a local static server or by opening files directly in browser

## Testing

Usually in active development we spin up the local dev server (see **Local dev
with the API** above) which hosts the full site and API at
`http://127.0.0.1:8787`. Use this for anything that loads shows or tracks. A
plain static server at `http://127.0.0.1:3000` is fine only for API-free pages.

Any new feature that affects the website when Bog Factor is live on air (or the transitions between live and not live) should be added in an identical manner to the test pages at `tools\test-live.html` and `tools\test-countdown.html`. Testing is a very important part of development and should be considered whenever making any changes.

The procedure for testing is something like:
- Open `index.html` in browser to test landing page
- Navigate to subpages (`radio/`, `about/`) to test those sections
- Test tracklist modals and YouTube search links on the radio page
- Test Mixcloud widgets on the radio page
- Test draggable sun elements by clicking and dragging them
- Test behaviour of the site when Bog Factor is on air using `tools/test-live.html`
- Test behaviour of the site when Bog Factor goes on and off air using `tools/test-countdown.html`
- Verify show data displays correctly after editing shows in `/admin/shows`

Further documentation of these test features is included in `radio/README.md`