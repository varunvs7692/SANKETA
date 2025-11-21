# Sanketa – Smarter Signals for a Smarter Bharat

Adaptive, solar-powered, AI traffic signal platform reducing congestion, emissions, and emergency response times.

## Current Pages
- Home (`index.html`) – overview & key benefits
- Vision (`about.html`) – why Bharat needs adaptive signals
- Features (`services.html`) – core capabilities (AI, solar, priority, countdown)
- Impact (`projects.html`) – target outcome metrics
- Technology (`traffic.html`) – deep dive architecture & approach
- Contact (`contact.html`) – deployment inquiry form
- Legal (`privacy.html`, `terms.html`) & `404.html`

## Run Locally (PowerShell)
From the project root `SANKETA` (static front-end + optional backend):

### Option A: Python
```powershell
# If Python is installed via py launcher
py -3 -m http.server 8080
# Or
python -m http.server 8080
```
Then open: http://localhost:8080/

### Option B: Node.js (npx)
```powershell
npx serve -l 8080
# or
npx http-server -p 8080
```

Backend (optional) lives in `backend/` with Express API for contact:
```powershell
Push-Location backend
npm install
node server.js # starts on port 4000
```
Front-end pages still work without backend; contact form falls back to mailto.

## Deploy
- GitHub Pages: push this folder, enable Pages for the branch; ensure `404.html` exists.
- Netlify: drag-and-drop the folder or `netlify deploy`. The contact form has `data-netlify` attributes for basic submissions.

## Customize
- Colors & layout: `assets/css/style.css`
- Navigation: `assets/js/main.js` (routes array)
- Logo: `assets/img/favicon.svg`
- Deep dive content: `traffic.html`

## Structure
```
SANKETA/
  index.html
  about.html
  services.html
  projects.html
  traffic.html
  contact.html
  privacy.html
  terms.html
  404.html
  assets/
    css/style.css
    js/main.js
    img/favicon.svg
    data/posts.json (legacy blog sample; not linked in nav)
  backend/
    package.json
    server.js
```

## License
Provided as-is; customize content & branding as required.
