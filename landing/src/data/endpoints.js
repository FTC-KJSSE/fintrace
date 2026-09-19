// ---------------------------------------------------------------------------
// The nine endpoints FinTrace ships with. Labels, categories, hostnames and
// coordinates are copied verbatim from backend/src/endpoints.js.
//
// Two fields are additions for this page and are marked as such in the UI:
//   `transit`   — plausible intermediate landing points used to shape the arc
//                 on the globe. Illustrative, not measured.
//   `sampleRtt` — a representative round-trip time used by the ticker and the
//                 demo trace. Labelled "sample" everywhere it appears.
// As in the app, destination coordinates are approximate landmark locations,
// not literal server-rack coordinates, which aren't public.
// ---------------------------------------------------------------------------

const MARSEILLE = [43.2965, 5.3698];
const LONDON = [51.5074, -0.1278];
const FRANKFURT = [50.1109, 8.6821];
const CHENNAI = [13.0827, 80.2707];
const SINGAPORE = [1.3521, 103.8198];

export const SOURCE = { label: "Your machine", city: "Mumbai, IN", lat: 19.076, lon: 72.8777 };

export const ENDPOINTS = [
  {
    id: "nse",
    label: "NSE India",
    type: "Stock exchange",
    host: "www.nseindia.com",
    lat: 19.0662,
    lon: 72.8697,
    transit: [],
    sampleRtt: 14,
  },
  {
    id: "bse",
    label: "BSE India",
    type: "Stock exchange",
    host: "www.bseindia.com",
    lat: 18.9281,
    lon: 72.8319,
    transit: [],
    sampleRtt: 21,
  },
  {
    id: "nyse",
    label: "NYSE",
    type: "Stock exchange",
    host: "www.nyse.com",
    lat: 40.7069,
    lon: -74.0113,
    transit: [MARSEILLE, LONDON],
    sampleRtt: 218,
  },
  {
    id: "nasdaq",
    label: "Nasdaq",
    type: "Stock exchange",
    host: "www.nasdaq.com",
    lat: 40.7561,
    lon: -73.9863,
    transit: [MARSEILLE, FRANKFURT],
    sampleRtt: 231,
  },
  {
    id: "binance",
    label: "Binance API",
    type: "Crypto exchange",
    host: "api.binance.com",
    lat: 35.6762,
    lon: 139.6503,
    transit: [CHENNAI, SINGAPORE],
    sampleRtt: 137,
  },
  {
    id: "aws-ap-south-1",
    label: "AWS ap-south-1",
    type: "Cloud region (HFT infra)",
    host: "ec2.ap-south-1.amazonaws.com",
    lat: 19.076,
    lon: 72.8777,
    transit: [],
    sampleRtt: 9,
  },
  {
    id: "aws-us-east-1",
    label: "AWS us-east-1",
    type: "Cloud region (HFT infra)",
    host: "ec2.us-east-1.amazonaws.com",
    lat: 38.994,
    lon: -77.4524,
    transit: [MARSEILLE, LONDON],
    sampleRtt: 204,
  },
  {
    id: "bloomberg",
    label: "Bloomberg",
    type: "Market data provider",
    host: "www.bloomberg.com",
    lat: 40.7639,
    lon: -73.97,
    transit: [MARSEILLE, LONDON],
    sampleRtt: 226,
  },
  {
    id: "reuters",
    label: "Reuters",
    type: "Market data provider",
    host: "www.reuters.com",
    lat: 51.5054,
    lon: -0.0235,
    transit: [MARSEILLE],
    sampleRtt: 152,
  },
];

// Identical thresholds to frontend/src/lib/latency.js — the semantics of the
// latency scale must not drift between the app and the page that sells it.
export function latencyTier(rttMs) {
  if (rttMs == null) return "timeout";
  if (rttMs < 50) return "low";
  if (rttMs <= 150) return "medium";
  return "high";
}

export const TIER_COLOR = {
  low: "#22c55e",
  medium: "#f0a830",
  high: "#ef4444",
  timeout: "#8e959d",
};

// Compare-mode route identity colours, in the order the app assigns them.
export const COMPARE_COLORS = ["#38bdf8", "#a78bfa", "#f472b6", "#f0a830", "#34d399", "#fb923c"];

export function findEndpoint(id) {
  return ENDPOINTS.find((e) => e.id === id);
}

// Full waypoint chain for an endpoint: source → transit… → destination.
export function routePoints(endpoint) {
  return [
    [SOURCE.lat, SOURCE.lon],
    ...endpoint.transit,
    [endpoint.lat, endpoint.lon],
  ];
}
