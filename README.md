# Nunhead Repair Café Dashboard

This is a tiny, zero-build, single-page dashboard that polls your Google Apps
Script endpoint and renders the live repair queue.

## Stack recommendation

- **Frontend:** Vanilla HTML/CSS/JS (fast, accessible, zero build tooling).
- **Hosting:** GitHub Pages, Netlify, or Cloudflare Pages (all free static hosting).
- **Data:** Google Apps Script web app endpoint (already provided).

## How to customise

Open `app.js` and edit the `CONFIG` block:

- `title` for the header text.
- `logoUrl` for your logo image (PNG/SVG URL or data URL).
- `pollIntervalMs` for polling frequency.

## Run locally

Open `index.html` in a browser.

## Deploy

Any static host works. For GitHub Pages:

1. Create a repository and add these files.
2. In GitHub, enable **Pages** for the main branch and root folder.
3. Share the Pages URL on your display screen.


