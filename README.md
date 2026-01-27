# Nunhead Repair Café Dashboard

A funky-lookin', zero-build dashboard system for repair cafés, displaying live repair queues and comprehensive historical statistics. If combined with a Google Sheet as a database, and an AppSheet app as an interface, the eco-system can manage Menders, Repairs, Events, Mailouts to Menders and Attendance. It's low-friction by design, minimising personal data collection and keeping GDPR compliance straightforward — customer data is not required, and anonymised quickly, just the essentials needed to fix things.

## Overview

This project consists of two pages:

- **`index.html`** — Live public repair dashboard for event days
- **`stats.html`** — Historical tatistics and analytics page

Both share the same design system with a dynamic random-contrast theming engine and responsive layouts.

## Features

### Live Dashboard (`index.html`)

- **Repair Queue**: Shows items waiting for repair with status pills and "needs" tags
- **Menders at Work**: Current repairs in progress with assigned mender
- **Success Counter**: Total successful repairs today (prominently displayed)
- **Auto-refresh**: Polls API every 20 seconds
- **Dynamic Theming**: Random high-contrast color palettes on demand

### Statistics Page (`stats.html`)

- **Date Range Picker**: Filter all data by custom date range (defaults to "this year")
- **Scorecard**: Primary metrics (Successful/Pending/Failed repairs) with visual prominence
- **Average Metrics**: Wait time, repair time, and visits per day
- **Podiums**: Rankings for fastest/most thorough/most successful menders, plus café performance by day
- **Charts**: Success rate pie chart (Chart.js) and repair type breakdown
- **Auto-refresh**: Polls API every 5 minutes

### Shared Features

- **Navigation**: Icon-based footer navigation between dashboard and stats
- **Theme Toggle**: Randomize color palette with one click
- **Responsive Design**: Adapts to all screen sizes (mobile → tablet → desktop)
- **Loading States**: Subtle spinner and status messages
- **Material Icons**: Clean icon system for UI elements

## Stack

- **Frontend**: Vanilla HTML/CSS/JS (zero build, fast, accessible)
- **Charts**: Chart.js 4.4.3 (CDN, stats page only)
- **Hosting**: GitHub Pages, Netlify, Cloudflare Pages, or any static host
- **Data Source**: Google Apps Script web app attached to a Google Sheet
- **Data Interaction**: This repo is just a dashboard. There is an AppSheet app which acts as an electronic-Point-of-Repair interface and event management tool.

## Configuration

Edit the `CONFIG` object in `app.js`:

```javascript
const CONFIG = {
  title: "Nunhead Repair Café",           // Site title
  logoUrl: "",                             // Logo image URL (leave empty for Material Icon default)
  endpoint: "YOUR_GAS_ENDPOINT_URL",      // Google Apps Script web app URL
  pollIntervalMs: 10000,                   // Default refresh interval (10s for dashboard)
  requestTimeoutMs: 20000,                 // API timeout threshold
};
```

### Logo Customization

- **Default**: Crossed spanner Material Icon (`handyman`)
- **Custom**: Set `logoUrl` to your image URL (PNG/SVG/JPG)

## API Integration

### Endpoints

The Google Apps Script endpoint must accept an `action` parameter:

- `?action=open_repairs` — Returns active repairs (queue + in-progress)
- `?action=closed_repairs` — Returns completed repair history

### Expected Data Schema

#### Open Repairs Response (`index.html`)

```javascript
{
  active: [
    {
      id: string,
      item: string,              // Item name
      owner: string,             // Owner name
      status: string,            // "Queueing" | "Repairing"
      needs: string[],           // ["Electrical", "Mechanical"]
      mender: string             // Assigned mender (if status = "Repairing")
    }
  ],
  stats: {
    repairedToday: number        // Count of successful repairs today
  }
}
```

#### Closed Repairs Response (`stats.html`)

```javascript
[
  {
    id: string,
    item: string,
    owner: string,
    mender: string[],            // Array of mender names
    status: string,              // "Repaired" | "Pending" | "Failed"
    needs: string[],             // Categories
    arrival: DateTime,           // ISO 8601 string
    repairStarted: DateTime,
    repairCompleted: DateTime,
    totalQueueTime: number,      // Seconds
    totalRepairTime: number,     // Seconds
    visits: number               // Number of visits (optional, falls back to arrival-based calc)
  }
]
```

## Theming System

### Random Contrast Theme

The app generates random color palettes on each theme toggle, ensuring:

- High contrast for readability (WCAG-compliant)
- Harmonious color relationships (complementary/triadic/analogous) (I mean...harmonius is probably subjective, but they're technically harmonius)
- Consistent status colors (success/warning/error remain pastel and static)
- Soft text colors derived from the theme palette

### Custom Theme Variables

All colors are CSS custom properties (`:root` variables) generated in JavaScript:

- `--bg`, `--card`, `--ink`: Base surface and text colors
- `--accent`, `--accent-2`: Primary/secondary accent colors
- `--success-color`, `--warning-color`, `--error-color`: Static status colors
- `--score-soft`: Soft color for auxiliary statistics
- `--ink-soft`: Softened body text color

## Responsive Breakpoints

- **≤ 560px**: Single-column stack (mobile)
- **≤ 1024px**: Two-column scorecards, stacked stats boards (tablet)
- **≤ 1100px**: Podiums/Splits stack vertically
- **> 1100px**: Full multi-column layout (desktop)

## Run Locally or Deploy

1. Open `index.html` or `stats.html` in a modern browser
2. No build step required — pure HTML/CSS/JS
3. We use GitHub pages, but choose your flavour of free hosting

## File Structure

```
.
├── index.html              # Live dashboard
├── stats.html              # Statistics page
├── app.js                  # Shared application logic
├── styles.css              # Shared styles and theming
├── dark_sparse_long_250.png  # Footer logo
└── README.md               # This file
```

## Customization Tips

### Adjust Polling Rates

Edit `app.js`:

```javascript
const pollIntervalMs =
  pageAction === "closed_repairs" ? 5 * 60 * 1000 : CONFIG.pollIntervalMs;
```

### Change Status Colors

Edit `styles.css`:

```css
:root {
  --success-color: #5cab88;   /* Pastel green */
  --warning-color: #e5a65f;   /* Pastel orange */
  --error-color: #d77777;     /* Pastel red */
}
```

### Add More Material Icons

Update the Google Fonts URL in both HTML files to include additional icon names:

```html
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=your_icon_name"
/>
```

## Troubleshooting

### "Connection issue" Error

- Verify your Google Apps Script endpoint is deployed as a web app
- Ensure the endpoint accepts `action` parameter
- Check CORS is enabled on your GAS deployment
- Confirm the endpoint returns JSON (not HTML error pages)

### Charts Not Rendering

- Check browser console for Chart.js errors
- Verify CDN is accessible: `https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js`
- Ensure `stats.html` includes the Chart.js script before `app.js`

### Theme Not Randomizing

- Check browser console for JavaScript errors
- Ensure `data-role="theme-toggle"` is present on the button
- Verify CSS custom properties are supported (no IE11)

## Credits

Built for Nunhead Repair Café with ❤️

- Powered by [Sitech Industries](https://sitechindustries.com)
- Icons: [Material Symbols](https://fonts.google.com/icons)
- Charts: [Chart.js](https://www.chartjs.org/)
