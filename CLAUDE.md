# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bog Factor is a static website for a radio show hosted by Sophie and Emily on EHFM. The site is built with vanilla HTML, CSS, and JavaScript with no build process or dependencies.

## Architecture

### Site Structure

The site uses a flat directory structure with section-based organization:

- `index.html` - Landing page with background image, rotating sun logo, and footer links
- `radio/index.html` - Radio show archive with embedded Mixcloud players
- `about/index.html` - About page with information about the show and hosts
- `blog/index.html` - Blog section (currently minimal content)
- `styles.css` - Global stylesheet shared across all pages
- `scripts/mousefollower.js` - Interactive mouse cursor trail effect
- `assets/` - Image and media files

### Navigation Pattern

All subpages (radio, about, blog) share a consistent layout:
- Header with site title linking back to `/index.html`
- Rotating sun image in header
- Navigation banner with links to all three sections
- Footer with Instagram and Mixcloud links

The landing page (`index.html`) has a minimal layout with just the background image, rotating sun, and footer.

### CSS Architecture

`styles.css` contains:
- Global typography using Luminari (display) and Noto Serif Gurmukhi (body text) from CDN fonts
- `.textbox` class for content boxes with SVG wavy borders and noise texture effect
- `.rotating-image` animations (forward/reverse on hover)
- `.cursor-image` styles for mousefollower effect
- `.banner` navigation link styling with color transitions
- Responsive footer layout

### JavaScript Features

`scripts/mousefollower.js` implements a custom cursor trail effect:
- Creates three trailing images (sun, neolithic ball, beastie) that follow the mouse
- Uses `requestAnimationFrame` for smooth animation
- Trail particles drift towards current mouse position
- Handles scroll events to maintain position
- Shows/hides images on mouse enter/leave

### Asset Organization

Images in `assets/`:
- `sun_image.png` - Rotating header logo
- `vibes-graphic.jpg` - Landing page background
- `sophie-and-emily.jpg` - Photo of hosts
- `bog factor scale.jpg` - Interactive bog factor scale (expands on hover)
- `beastie.png`, `neolithic-towie-ball.webp`, `pig.png` - Cursor trail images
- `cursor.png` - Additional cursor asset

## Development

This is a static site with no build process. To develop:

1. Edit HTML, CSS, or JS files directly
2. Open files in browser or serve with any static server (e.g., `python3 -m http.server`)

### Testing Changes

Since this is a static site:
- Open `index.html` in browser to test landing page
- Navigate to subpages (`radio/`, `about/`, `blog/`) to test those sections
- Test mousefollower effect by moving cursor across pages
- Test rotating sun hover effect in headers

### Path Conventions

- Root-relative paths are used inconsistently:
  - Some pages use `/styles.css`, others use `../styles.css`
  - Some use `/scripts/mousefollower.js`, others use relative paths
  - Images use `../assets/` or `/assets/` depending on context

When adding new pages or modifying paths, maintain consistency with the existing pattern for that section.

## Current State

The site is actively being worked on:
- Landing page has been simplified (branch: sophie/change-landing-page)
- Modified files: `index.html`, `styles.css`
- Recent commits show iterative design changes

### Known Issues

- Path inconsistencies between absolute and relative references
- Landing page has a typo: `</div>s` at line 29 in `index.html`
- Footer links point to general Instagram/Mixcloud URLs instead of Bog Factor specific accounts on some pages
- Use vanilla HTML and CSS where possible to create a website that loads fast