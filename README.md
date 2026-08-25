# FinTrace

Live network-latency globe for financial infrastructure. Traces the route from your machine to a curated set of exchanges, crypto APIs, and cloud HFT regions, and renders each hop as an animated arc on a 3D globe with a live terminal-style data panel.

## Stack

- **Frontend**: Vanilla JS (ES Modules) + Vite, Three.js, three-globe, OrbitControls
- **Backend**: Node.js, Express, `child_process` traceroute spawner, Server-Sent Events
- **Data**: ip-api.com geolocation with an in-memory cache + rate limiter

## Setup

Requires Node 18+ (uses the built-in `fetch`).

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Run

Two terminals:

```bash
cd backend && npm start      # http://localhost:3001
cd frontend && npm run dev   # http://localhost:5173
```

Open `http://localhost:5173`.

## Platform notes

- **Windows**: uses `tracert -d`, no admin privileges required.
- **macOS**: uses `traceroute -n`. Worked un-elevated in testing on this machine — no `sudo`/`setcap` needed. If your `traceroute` binary requires elevated privileges to open a raw socket, run the backend with `sudo npm start`.
- **Linux**: uses `traceroute -n`. If you hit a permissions error creating a raw socket, either run the backend with `sudo` or grant the capability once: `sudo setcap cap_net_raw+ep $(which traceroute)`.

## Notes on data

- Endpoint destination coordinates (for the globe pin) are approximate landmark locations, not literal server-rack coordinates, since those aren't public.
- ip-api.com's free tier is rate-limited (45 req/min); the backend throttles and caches lookups in memory, so repeated hops/endpoints resolve instantly after the first lookup.
- Private/reserved IPs (home router, ISP-internal hops) aren't geolocated — ip-api.com can't place them, so they show in the hop table without a location and don't appear on the globe.
