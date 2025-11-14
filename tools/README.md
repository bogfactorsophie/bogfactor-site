# Radio Shows - How to Add New Shows

The radio page now generates shows dynamically from `shows.json`. This makes it easy to add new shows each month!

## Adding a New Show

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

## Test Pages

- **test-live.html** - Test the live streaming widget in "LIVE NOW!" mode
- **test-countdown.html** - Test countdown timer with presets to simulate different times before/during/after show
