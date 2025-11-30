# Bog Factor Developer Tools

## Test Pages

- **test-live.html** - Test the live streaming widget in "LIVE NOW!" mode
- **test-countdown.html** - Test countdown timer with presets to simulate different times before/during/after show and transitions from not live to live back to not live

### Test Live

This page is a convenience tool so that you don't need to configure the page and wait for it to go live, instead you can immediately see it.

There should be toolbar icons directing the user to "Listen Live" and "Chat" visible on all pages.

The "Listen Live" feature should start the same live player that is controlled on the main and floating players.

The "Chat" feature should send users to a Chatango chatroom hosted by EHFM

### Test Countdown

As the show is only scheduled for once a month, it is convenient to be able to simulate what it looks like in the moments leading up to the start and the end of the show. This ensures that the site transitions cleanly and looks good throughout. Even the Bog Factor is only live for an hour, EHFM broadcasts 24/7 and so the user should be able to listen to our friend's shows through our site.

Typically this test page is used by setting the start of the show to be a minute from now, waiting until the next minute, and watching and listening for any transitions.

Then, the user can set the end of the show to be in a minute and do the same.

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




