# Copilot Instructions for SANKETA

Concise, project-specific guidelines for AI coding agents to be immediately productive.

## Big Picture Architecture
- Static front-end (HTML/CSS/JS) served via any static host; optional Node/Express backend under `backend/` (port 4000) supplying demo adaptive traffic data & contact endpoint.
- Front-end relies on graceful degradation: most pages work without backend; missing API falls back (e.g., contact form -> `mailto:`; city suggestions -> local fallback list; intersection data -> local deterministic generator in inline script).
- Live traffic demo logic currently embedded inline in `index.html` (Leaflet map + city search + synthetic intersection phase simulation). Header/footer & shared UI logic reside in `assets/js/main.js`.

## Key Files & Responsibilities
- `index.html`: Landing page + inline map demo script (search, suggestions, geocoding, synthetic intersections, phase rotation). Modify map logic here unless refactoring into a separate JS module.
- `assets/js/main.js`: Navigation (`routes` array), footer generation, blog sample rendering, contact form submission logic (primary API -> fallback mailto). Keep additions modular & avoid global pollution outside its IIFE.
- `assets/css/style.css`: Global design tokens via `:root` vars, layout components (`.grid-3`, `.two-col`, `.card`, `.location-bar`, pill & badge styles). Extend by reusing existing variables and shadow style (`--shadow`).
- `backend/server.js`: Express API endpoints; all responses follow `{ ok: boolean, ... }` pattern with `error` on failure. Contains: `/api/status`, `/api/cities`, `/api/intersections`, `/api/stream` (SSE), `/api/spat/:id`, `/api/metrics`, `/api/health`, `/api/alerts`, `/api/reports`, `/api/contact`.

## Data & Domain Model
- Intersection object shape: `{ id, name, lat, lng, phase, remainingSeconds }`. Phases cycle GREEN → AMBER → RED with differing countdown ranges.
- City lookup: Geocoded via Nominatim (center lat/lng + generated intersections). Cached for 60s in `cityCache`. Maintain short TTL if adding ML scoring.
- City suggestions: Remote Nominatim results (display_name array) OR fallback list (front-end) when API/network fails.

## Backend Conventions
- Always return top-level `{ ok }`; on errors include `{ ok: false, error: 'message' }` (keep messages succinct; caller logic uses truthiness).
- Performance logging: Custom middleware prints method + ms; retain when adding new routes.
- Phase updates driven by `setInterval` tick every 1000ms; if introducing persistence, preserve rotation so front-end timers remain plausible.
- Streaming: `/api/stream` uses Server-Sent Events with `event:update` and JSON payload; do not rename the event unless you also update consumers.
- Contact: Optional SMTP via `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `CONTACT_TO`. Preserve mailResult states (`sent|skipped|error`).

## Front-End Patterns
- Progressive enhancement: write code so absence of backend returns silent fallback rather than hard error. Example: suggestions default to in-memory Indian cities list.
- Inline script in `index.html` encapsulates map logic inside an IIFE; if extracting, keep same public behavior & ARIA attributes.
- UI feedback uses `.loading` with `.spinner` child; hide with `hidden` attribute after short timeout. Reuse class rather than duplicating spinner markup.
- Dynamic content inserts rely on `innerHTML` with sanitized structured strings; avoid introducing user-controlled content without escaping.

## Styling & Layout Rules
- Use existing CSS variables (`--bg`, `--border`, `--brand`, etc.). Avoid hard-coded colors unless adding a new semantic token.
- Radius & elevation: Cards/panels typically `border-radius:14-16px` + `box-shadow: var(--shadow)`. Match for visual consistency.
- Responsive grids: Favor existing utility patterns (`grid-template-columns: repeat(auto-fit, minmax(Xpx,1fr))`) for new metric panels.

## Workflows
- Dev front-end: `py -3 -m http.server 8080` OR `npx serve -l 8080` from project root.
- Dev backend: `Push-Location backend; npm install; npm start` (port 4000). Front-end expects this port; adjust only if updating fetch URLs.
- Test changes manually by loading `index.html` and verifying map fallback, city search (suggestions + selection), and contact form API fallback.

## Adding Features Safely
- New API route: Prefix with `/api/`, include `{ ok }`, mount before `/api` 404 handler. Keep JSON shape consistent to simplify front-end integration.
- ML-based ranking/autocomplete: Introduce endpoint like `/api/city-rank?query=...`; return array of `{ name, score }` while still supporting legacy string list; front-end can detect object form for richer UI.
- Refactors: If moving inline map script to `assets/js/`, export a single init function called after `DOMContentLoaded`; maintain same element IDs (`mini-map`, `mini-city`, `mini-suggest`).

## Guardrails
- Do not introduce heavy frameworks; keep vanilla JS + Express footprint.
- Avoid breaking the `{ ok: true, meta, intersections }` contract of `/api/intersections` since multiple UI blocks rely on `meta` metrics.
- Preserve 1s update cadence (setInterval 1000) for synchronized UI timers.
- Keep caching duration short (≤ 60s) to avoid stale phase data illusions.

## Quick Reference
| Concern | Location |
|---------|----------|
| Navigation & Footer | `assets/js/main.js` |
| Map & Search Demo | `index.html` inline script |
| Global Styles | `assets/css/style.css` |
| API Endpoints | `backend/server.js` |
| Blog Sample Data | `assets/data/posts.json` |

Provide focused, incremental changes; avoid aspirational conventions not present in codebase.
