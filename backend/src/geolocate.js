const CACHE_LIMIT = 500;
const cache = new Map(); // ip -> geo result. Map preserves insertion order for LRU eviction.

// ip-api.com free tier allows 45 req/min. Space requests out generously so a
// single trace (usually <30 hops, most already cached after the first run)
// never gets us rate-limited mid-stream.
const MIN_INTERVAL_MS = 1400;
let lastRequestAt = 0;
let queue = Promise.resolve();

const PRIVATE_IP_RE =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

function touchCache(ip, value) {
  cache.delete(ip);
  cache.set(ip, value);
  if (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

async function throttledFetch(ip) {
  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const res = await fetch(
    `http://ip-api.com/json/${ip}?fields=status,message,lat,lon,city,isp,query`
  );
  const data = await res.json();
  if (data.status !== "success") return null;
  return { lat: data.lat, lon: data.lon, city: data.city, isp: data.isp };
}

export function geolocate(ip) {
  if (!ip || PRIVATE_IP_RE.test(ip)) {
    return Promise.resolve(null);
  }
  if (cache.has(ip)) {
    const value = cache.get(ip);
    touchCache(ip, value);
    return Promise.resolve(value);
  }

  // Chain onto the shared queue so concurrent hop lookups (from the same or
  // multiple traces) still respect the single rate limiter.
  const result = queue.then(() => throttledFetch(ip));
  queue = result.catch(() => {});
  return result.then((value) => {
    touchCache(ip, value);
    return value;
  });
}
