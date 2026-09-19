// ---------------------------------------------------------------------------
// A representative `tracert -d www.nyse.com` result, used to drive the hop
// readout and the analytics preview. It is labelled as a sample trace in the
// UI — it is not a live measurement taken in your browser, because a browser
// cannot take one. That is the whole point of the section above it.
//
// Every derived figure on this page (average, min/max, geographic span, tier
// composition) is computed from these rows at runtime rather than asserted,
// so the numbers can never drift out of agreement with the table.
// ---------------------------------------------------------------------------

export const TRACE_TARGET = { host: "www.nyse.com", label: "NYSE" };

export const HOPS = [
  { n: 1, ip: "192.168.1.1", rtt: 1, city: null, country: null, note: "private range" },
  { n: 2, ip: "10.14.0.1", rtt: 4, city: null, country: null, note: "carrier-grade NAT" },
  { n: 3, ip: "49.44.112.1", rtt: 9, city: "Mumbai", country: "IN", lat: 19.076, lon: 72.878 },
  { n: 4, ip: "182.79.238.65", rtt: 12, city: "Mumbai", country: "IN", lat: 19.076, lon: 72.878 },
  { n: 5, ip: null, rtt: null, city: null, country: null, note: "request timed out" },
  { n: 6, ip: "62.115.118.12", rtt: 96, city: "Marseille", country: "FR", lat: 43.2965, lon: 5.3698 },
  { n: 7, ip: "62.115.125.132", rtt: 131, city: "London", country: "GB", lat: 51.5074, lon: -0.1278 },
  { n: 8, ip: "213.155.135.79", rtt: 178, city: "London", country: "GB", lat: 51.5074, lon: -0.1278 },
  { n: 9, ip: "80.239.192.44", rtt: 201, city: "New York", country: "US", lat: 40.7128, lon: -74.006 },
  { n: 10, ip: "4.35.156.2", rtt: 209, city: "New York", country: "US", lat: 40.7128, lon: -74.006 },
  { n: 11, ip: "104.18.32.47", rtt: 214, city: "New York", country: "US", lat: 40.7069, lon: -74.0113 },
  { n: 12, ip: "104.18.33.47", rtt: 218, city: "New York", country: "US", lat: 40.7069, lon: -74.0113 },
];

const EARTH_RADIUS_KM = 6371;

// Same great-circle formula the app uses in frontend/src/lib/geoMath.js.
function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function deriveRouteStats(hops = HOPS) {
  const timed = hops.filter((h) => h.rtt != null);
  const located = hops.filter((h) => h.lat != null);

  const rtts = timed.map((h) => h.rtt);
  const destination = rtts.length ? rtts[rtts.length - 1] : null;
  const avg = rtts.length ? Math.round(rtts.reduce((s, v) => s + v, 0) / rtts.length) : null;

  let spanKm = 0;
  for (let i = 1; i < located.length; i += 1) spanKm += haversineKm(located[i - 1], located[i]);

  const tiers = { low: 0, medium: 0, high: 0, timeout: 0 };
  for (const h of hops) {
    if (h.rtt == null) tiers.timeout += 1;
    else if (h.rtt < 50) tiers.low += 1;
    else if (h.rtt <= 150) tiers.medium += 1;
    else tiers.high += 1;
  }

  return {
    destination,
    totalHops: hops.length,
    geoHops: located.length,
    avg,
    min: rtts.length ? Math.min(...rtts) : null,
    max: rtts.length ? Math.max(...rtts) : null,
    spanKm: Math.round(spanKm),
    tiers,
  };
}
