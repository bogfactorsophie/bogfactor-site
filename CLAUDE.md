# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bog Factor is a static website for a radio show hosted by Sophie and Emily on EHFM. The site is built with vanilla HTML, CSS, and JavaScript with no build process or dependencies.

## Architecture

### Site Structure

The site uses a flat directory structure with section-based organization:

- `index.html` - Landing page with background image, live stream widget, and footer links
- `radio/index.html` - Radio show archive with embedded Mixcloud players and tracklist modals
- `about/index.html` - About page with information about the show and hosts
- `radio/shows.json` - Master data file containing all show metadata and tracklists
- `styles.css` - Global stylesheet shared across all pages
- `scripts/` - JavaScript modules for interactive features
- `assets/` - Image and media files
- `tools/` - Development utilities and test files

### Navigation Pattern

All subpages (radio, about) share a consistent layout:
- Toolbar navigation at the top with links to Home, Radio, and About
- SVG wavy border filters for visual effects
- Footer with Instagram and Mixcloud links

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

- `scripts/bog-scale.js` - Interactive hover effect for the bog factor scale image
- `scripts/draggable-suns.js` - Creates draggable sun elements that float across the page
- `scripts/live-stream.js` - Manages the live stream player and widget on the landing page
- `scripts/persistent-player.js` - Persistent audio player for Mixcloud shows on the radio page
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
- `README.md` - Instructions for adding new radio shows to the site

## Development

This is a static site with no build process. To develop:

1. Edit HTML, CSS, or JS files directly
2. Open files in browser or serve with any static server (e.g., `python3 -m http.server`)

### Testing Changes

Since this is a static site:
- Open `index.html` in browser to test landing page
- Navigate to subpages (`radio/`, `about/`) to test those sections
- Test draggable sun elements by clicking and dragging them
- Test live stream widget functionality using `tools/test-live.html`
- Test tracklist modals and YouTube search links on the radio page
- Verify show data displays correctly after editing `radio/shows.json`

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
- Persistent audio player for radio archive with Mixcloud integration
- Draggable sun elements for interactive experience
- Tracklist modals with YouTube search integration
- Clean, optimized codebase with unused files removed

### Best Practices

- Use vanilla HTML, CSS, and JavaScript for fast loading times
- Keep the codebase minimal and clean - no build process or dependencies
- Store all show data in `radio/shows.json` for easy updates
- Use root-relative paths for navigation, relative paths for assets
- Test changes using a local static server or by opening files directly in browser