# Bog Factor Developer Tools

## Test Pages

- **test-live.html** - Test the live streaming widget in "LIVE NOW!" mode
- **test-countdown.html** - Test countdown timer with presets to simulate different times before/during/after show and transitions from not live to live back to not live

Both test pages load the real production scripts (`scripts/live-stream.js` and `scripts/toolbar-live-widget.js`) and override their behaviour using a `window.BogFactorTestConfig` mechanism. This means the test pages always exercise the same code that runs on the live site — no duplicated logic that can drift out of sync.

### Test Live

This page is a convenience tool so that you don't need to configure the page and wait for it to go live, instead you can immediately see it.

There should be toolbar icons directing the user to "Listen Live" and "Chat" visible on all pages.

The "Listen Live" feature should start the same live player that is controlled on the main and floating players.

The "Chat" feature should send users to a Chatango chatroom hosted by EHFM.

### Test Countdown

As the show is only scheduled for once a month, it is convenient to be able to simulate what it looks like in the moments leading up to the start and the end of the show. This ensures that the site transitions cleanly and looks good throughout. Even though Bog Factor is only live for an hour, EHFM broadcasts 24/7 and so the user should be able to listen to our friend's shows through our site.

Typically this test page is used by setting the start of the show to be a minute from now, waiting until the next minute, and watching and listening for any transitions.

Then, the user can set the end of the show to be in a minute and do the same.

---

## Test Override Hooks (`window.BogFactorTestConfig`)

The production scripts check for a `window.BogFactorTestConfig` object at runtime. When it is not present (i.e. on the real site), nothing changes. When it is present (i.e. on the test pages), the scripts use the provided overrides instead of their real logic.

The config object is set in a `<script>` tag **before** the production scripts are loaded, so the overrides are in place by the time the scripts initialise.

### Available overrides

| Property | Type | Used by | Description |
|---|---|---|---|
| `isLiveNow` | `function` | `live-stream.js`, `toolbar-live-widget.js` | Returns `true`/`false` to override live detection, or `null` to fall through to real logic |
| `getNextShowDate` | `function` | `live-stream.js` | Returns a `Date` for the next show start, or `null` to fall through to real logic |
| `isLandingPage` | `boolean` | `live-stream.js` | When `true`, the script treats the page as the landing page (shows the main widget instead of just the floating player) |

### How each test page uses them

**test-live.html** sets a simple static config:

```javascript
window.BogFactorTestConfig = {
  isLiveNow: () => true,
  isLandingPage: true
};
```

This makes the page always appear in the live state.

**test-countdown.html** sets a config with dynamic overrides tied to a `testNextShowDate` variable that the test controls modify:

```javascript
var testNextShowDate = null;

window.BogFactorTestConfig = {
  isLandingPage: true,
  getNextShowDate: function() {
    if (!testNextShowDate) return null; // fall through to real logic
    // ... return testNextShowDate or calculate next month's show if this one ended
  },
  isLiveNow: function() {
    if (!testNextShowDate) return null; // fall through to real logic
    // ... return true if now is between testNextShowDate and testNextShowDate + 1 hour
  }
};
```

When no test date is set, both functions return `null` and the real scheduling logic runs. When a test date is applied, the overrides simulate the show starting and ending at the configured time.

The test controls call `window.BogFactorLiveStream.forceUpdate()` after changing `testNextShowDate` to immediately re-evaluate the countdown, widget state, and update interval.

### API methods used by test pages

The `window.BogFactorLiveStream` object exposes these methods that the test pages use:

| Method | Description |
|---|---|
| `forceUpdate()` | Re-evaluates countdown, widget state, and restarts the update interval |
| `getCurrentInterval()` | Returns the current update interval in ms (1000 or 60000) |
| `getNextShowDate()` | Returns the computed next show `Date` |
| `isLiveNow()` | Returns whether the show is currently live |

---

## Adding a New Show

The radio page generates shows dynamically from `shows.json`. This makes it easy to add new shows each month!

Edit `radio/shows.json` and add a new object at the **top** of the array (most recent shows first):

```json
{
  "id": "dec2025",
  "title": "December 2025 Show",
  "description": "Welcome to our website, traveller, are you ready to join us on our quest? Sophie and Emily are ready to take you to the bog",
  "mixcloudPath": "/ehfm/bog-factor-051225/",
  "date": "2025-12",
  "tracklist": []
}
```

### Field Explanations

- **id**: Unique identifier (used for modal IDs). Use format like `dec2025`, `jan2026`, etc.
- **title**: Show title displayed on the page
- **description**: Show description text
- **mixcloudPath**: The Mixcloud URL path (e.g., from `https://www.mixcloud.com/ehfm/bog-factor-051225/` use `/ehfm/bog-factor-051225/`)
- **date**: Date in YYYY-MM format (for future sorting if needed)
- **tracklist**: Array of track strings (empty for now, populate later)

## Adding a Tracklist

To add a tracklist to an existing show, replace the empty `tracklist` array with track names:

```json
"tracklist": [
  "Artist Name - Track Title",
  "Another Artist - Another Track",
  "Third Artist - Third Track"
]
```

The tracklist will automatically appear in the modal popup when you click "View Tracklist".

## Example: Full Show Entry with Tracklist

```json
{
  "id": "dec2025",
  "title": "December 2025 Show",
  "description": "A festive bog journey through winter sounds",
  "mixcloudPath": "/ehfm/bog-factor-051225/",
  "date": "2025-12",
  "tracklist": [
    "Kate Bush - Running Up That Hill",
    "Aphex Twin - Xtal",
    "Burial - Archangel"
  ]
}
```

## Notes

- Shows are displayed in the order they appear in the JSON file
- Keep most recent shows at the top of the array
- The page loads instantly - all show data is fetched and rendered client-side
- No build process needed - just edit the JSON and refresh!

---

## Playlist Sync (`sync-playlists.py`)

Automatically syncs all tracks from `shows.json` to a "Bog Factor" playlist on Spotify and/or Tidal. Runs automatically via GitHub Actions whenever `shows.json` is updated on main.

### First-Time Setup

Install the Python dependencies:

```bash
pip install -r tools/requirements.txt
```

#### Spotify

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create a new app
2. Set the redirect URI to `http://localhost:8888/callback`
3. Note your Client ID and Client Secret
4. Run the setup wizard:

```bash
python tools/sync-playlists.py --setup spotify
```

5. Follow the prompts to authorise in your browser
6. Add the output values to a `.env` file in the repo root (for local use) and as GitHub Actions secrets (for automation)

#### Tidal

1. Run the setup wizard:

```bash
python tools/sync-playlists.py --setup tidal
```

2. Open the URL shown and log in to authorise
3. Add the output values to `.env` and GitHub Actions secrets

### Usage

```bash
# Sync all configured services
python tools/sync-playlists.py

# Preview what would be synced (no changes made)
python tools/sync-playlists.py --dry-run

# Sync only one service
python tools/sync-playlists.py --service spotify
python tools/sync-playlists.py --service tidal
```

### GitHub Actions

The workflow at `.github/workflows/sync-playlists.yml` runs automatically when `radio/shows.json` is pushed to main. It can also be triggered manually from the Actions tab.

Required GitHub Actions secrets:
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`
- `TIDAL_REFRESH_TOKEN`
- `GH_PAT` (a GitHub Personal Access Token with `secrets` read/write permission, used to rotate the Tidal refresh token)

Any tracks that can't be found on a service are logged in the Actions output for manual review.




