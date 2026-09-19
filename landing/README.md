# FinTrace — landing page

Static marketing site for the FinTrace desktop application. Built on the same
stack as the app itself (Vite + vanilla ES modules + Three.js + three-globe), so
the globe on the page is the application's real renderer rather than a picture
of it.

No backend. No framework. Deploys to any static host.

## Run it locally

From a clean clone, three commands:

```bash
cd landing
npm install      # once — pulls three, three-globe and vite (~48 packages)
npm run dev
```

Open **http://localhost:5174**. Edits to any file under `src/` or to
`index.html` hot-reload without a refresh. Stop the server with `Ctrl-C`.

Requires Node 18 or newer. This folder installs its own dependencies — it does
not share `node_modules` with the Electron app, and running it does not start
the backend or touch the app in any way.

### Showing it to someone on your own network

```bash
npm run dev -- --host
```

Vite then prints a second **Network** URL (something like
`http://192.168.1.14:5174`) that anyone on the same Wi-Fi can open. It stops
working the moment you stop the server, which makes it a good throwaway demo.
For a real link, see **Hosting** below.

### Checking the production build before deploying

`npm run dev` serves unbundled modules; the deployed site is the bundle. To
look at exactly what will ship:

```bash
npm run build     # → dist/
npm run preview   # http://localhost:4173, serving dist/
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :5174 with hot reload |
| `npm run dev -- --host` | Same, also reachable from your LAN |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serves `dist/` on :4173 |

## Sections

Four, in order: **hero**, **how it works** (the argument plus the hop readout and
its derived stats), **endpoints** (the nine targets, custom host, and the four
privacy guarantees as a compact row), and **download**.

## Layout

```
index.html                 all prose and section shells
vercel.json                Vercel build settings + asset cache headers
public/_headers            the same cache rule for Cloudflare Pages
src/
  main.js                  entry point; renders content, then lazy-loads WebGL
  globes.js                every Three.js import lives behind this dynamic import
  globe/landingGlobe.js    adapted from frontend/src/components/globe/globe.js
  data/
    release.js             version, filenames, sizes, download URLs, checksums
    endpoints.js           the nine endpoints, copied from backend/src/endpoints.js
    hops.js                the sample trace + derived-stat helpers
  sections/                one module per section
  lib/                     dom, reveal, spotlight, counters, copy, icons
  styles/                  tokens, base, components, hero, data, download
```

## Editing content

Almost everything factual lives in `src/data/`:

- **`release.js`** — version, the two build filenames, sizes, download URLs, and
  the SHA-256 checksums. The checksums are `null` until the release is public;
  while they are `null`, the copy-to-clipboard row simply doesn't render, because
  an unverifiable hash is worse than none. Generate them on Windows with
  `certutil -hashfile "<file>" SHA256` and paste them in.
- **`endpoints.js`** — labels, categories, hostnames and coordinates are copied
  verbatim from `backend/src/endpoints.js`. Two fields are additions for this
  page and are labelled as such in the UI: `transit` (illustrative intermediate
  waypoints that shape the arc) and `sampleRtt` (a representative RTT).
- **`hops.js`** — the sample `tracert` output. Every number in the analytics
  section is *computed* from these rows at runtime — average, min/max, tier
  composition, great-circle span — so the table and the metrics can never
  disagree.

Prose lives in `index.html`; the feature and guarantee lists live in
`src/sections/features.js` and `src/sections/security.js`.

## Design tokens

`src/styles/tokens.css` inherits the application's palette from
`frontend/src/styles/base.css`, with the background ladder dropped one step
darker and given a cooler undertone. Amber `#f0a830` is the only brand colour.
Latency colours (`#22c55e` / `#f0a830` / `#ef4444`) and the six compare-route
colours are semantic and must never be used decoratively.

## Notes

- **Three WebGL contexts** — hero, modes, and the endpoint directory. Each is
  paused by an `IntersectionObserver` whenever its canvas leaves the viewport,
  and a `ResizeObserver` keeps the canvas matched to its panel. Without WebGL the
  globe panels are removed and every section still reads correctly.
- **Code splitting** — Three.js (~460 kB gzipped) is behind a dynamic import, so
  the critical path is about 11 kB of JS plus 7 kB of CSS.
- **`prefers-reduced-motion`** — honoured throughout: reveals resolve instantly,
  the ticker and countdown hold still, arcs draw once without dash animation,
  and the camera cuts rather than glides.
- **Deploying to a subpath** — `vite.config.js` sets `base: "./"`, and the globe
  texture is loaded via `import.meta.env.BASE_URL`, so relative hosting works
  as-is.

## Hosting

This folder is a self-contained project inside a larger repo. Nothing needs to
be moved out — every host can be pointed at a subdirectory.

### Throwaway preview (no repo connection)

```bash
cd landing
npx vercel login      # once
npx vercel            # preview URL
npx vercel --prod     # promote to the project's main URL
```

`vercel.json` already declares the framework, build command and output
directory, so the CLI asks nothing but the project name.

### Auto-deploy on every push (Vercel)

Import the repo at [vercel.com/new](https://vercel.com/new), then in
**Settings → General** set:

| Field | Value |
| --- | --- |
| Root Directory | `landing` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Root Directory is the important one — it tells Vercel to treat `landing/` as the
project root and ignore the Electron app around it.

### Cloudflare Pages

Same idea, under **Build configuration**:

| Field | Value |
| --- | --- |
| Root directory | `landing` |
| Build command | `npm run build` |
| Build output directory | `dist` |

`public/_headers` carries the asset cache rule, which Pages reads from the build
output automatically.
