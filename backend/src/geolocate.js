import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Reader } from "mmdb-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CACHE_LIMIT = 500;
export const GEO_TIMEOUT_MS = 3000;
export const MIN_INTERVAL_MS = 1400;
export const GEOLOCATION_ATTRIBUTION = "IP Geolocation by DB-IP (https://db-ip.com) under CC BY 4.0 / ip-api.com";

const cache = new Map(); // ip -> geo result. Map preserves insertion order for LRU eviction.

let lastRequestAt = 0;
let queue = Promise.resolve();
let mmdbReaderInstance = null;
let mmdbLoaded = false;

export const PRIVATE_IP_RE =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

/**
 * Searches potential filesystem locations for a bundled or configured MMDB database.
 */
export function findMmdbPath(customDir = null) {
  if (process.env.FINTRACE_MMDB_PATH && fs.existsSync(process.env.FINTRACE_MMDB_PATH)) {
    return process.env.FINTRACE_MMDB_PATH;
  }

  const candidateDirs = [
    customDir,
    path.resolve(__dirname, "../data"),
    path.resolve(__dirname.replace("app.asar", "app.asar.unpacked"), "../data"),
    path.resolve(__dirname, "../../data"),
    path.resolve(__dirname.replace("app.asar", "app.asar.unpacked"), "../../data"),
    typeof process.resourcesPath === "string" ? path.join(process.resourcesPath, "data") : null,
  ].filter(Boolean);

  const candidateFilenames = [
    "dbip-city-lite.mmdb",
    "dbip-country-lite.mmdb",
    "GeoLite2-City.mmdb",
    "GeoLite2-Country.mmdb",
    "city.mmdb",
    "country.mmdb",
  ];

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;

    for (const filename of candidateFilenames) {
      const fullPath = path.join(dir, filename);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    // Fallback: look for any .mmdb file in the directory
    try {
      const files = fs.readdirSync(dir);
      const mmdb = files.find((f) => f.endsWith(".mmdb"));
      if (mmdb) return path.join(dir, mmdb);
    } catch {
      // Ignore read errors
    }
  }

  return null;
}

/**
 * Initializes the offline MMDB reader singleton.
 */
export function initOfflineDatabase(customPath = null) {
  try {
    const dbPath = customPath || findMmdbPath();
    if (!dbPath || !fs.existsSync(dbPath)) {
      mmdbReaderInstance = null;
      mmdbLoaded = false;
      return false;
    }

    const buffer = fs.readFileSync(dbPath);
    mmdbReaderInstance = new Reader(buffer);
    mmdbLoaded = true;
    console.log(`[FinTrace Geo] Loaded offline MMDB database from: ${dbPath}`);
    return true;
  } catch (err) {
    console.warn("[FinTrace Geo] Could not initialize offline MMDB database:", err.message);
    mmdbReaderInstance = null;
    mmdbLoaded = false;
    return false;
  }
}

// Auto-initialize if database is present at startup
initOfflineDatabase();

export function isOfflineDatabaseLoaded() {
  return mmdbLoaded && mmdbReaderInstance !== null;
}

export function setMmdbReader(reader) {
  mmdbReaderInstance = reader;
  mmdbLoaded = reader !== null;
}

function touchCache(ip, value) {
  cache.delete(ip);
  cache.set(ip, value);
  if (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

/**
 * Resolves geolocation synchronously from local MMDB reader.
 */
function lookupLocalMmdb(ip) {
  if (!mmdbReaderInstance) return null;
  try {
    const record = mmdbReaderInstance.get(ip);
    if (!record) return null;

    const lat = record.location?.latitude ?? null;
    const lon = record.location?.longitude ?? null;
    const city = record.city?.names?.en ?? record.country?.names?.en ?? "";
    const country = record.country?.names?.en ?? "";
    const isp =
      record.traits?.isp ??
      record.traits?.organization ??
      record.autonomous_system_organization ??
      record.country?.names?.en ??
      "";

    if (lat != null && lon != null) {
      return { lat, lon, city, isp, country };
    }
    return null;
  } catch {
    return null;
  }
}

async function throttledFetch(ip, { timeoutMs = GEO_TIMEOUT_MS, fetchFn = globalThis.fetch, minIntervalMs = MIN_INTERVAL_MS } = {}) {
  const wait = Math.max(0, minIntervalMs - (Date.now() - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  try {
    const res = await fetchFn(
      `http://ip-api.com/json/${ip}?fields=status,message,lat,lon,city,isp,country,query`,
      { signal: AbortSignal.timeout(timeoutMs) }
    );
    if (!res || !res.ok) return null;
    const data = await res.json();
    if (data?.status !== "success") return null;
    return {
      lat: data.lat,
      lon: data.lon,
      city: data.city || data.country || "",
      isp: data.isp || "",
      country: data.country || "",
    };
  } catch {
    // Gracefully handle timeout, connection resets, DNS failures, or parse errors
    return null;
  }
}

export function geolocate(ip, options = {}) {
  if (!ip || PRIVATE_IP_RE.test(ip)) {
    return Promise.resolve(null);
  }

  // 1. Check in-memory LRU cache
  if (cache.has(ip)) {
    const value = cache.get(ip);
    touchCache(ip, value);
    return Promise.resolve(value);
  }

  // 2. Try offline local MMDB database lookup (instantaneous, zero network delay)
  const localResult = lookupLocalMmdb(ip);
  if (localResult) {
    touchCache(ip, localResult);
    return Promise.resolve(localResult);
  }

  // If offline database is loaded and IP was not found, avoid unnecessary network delay if offlineMode specified
  if (options.offlineOnly) {
    return Promise.resolve(null);
  }

  // 3. Fallback: Chain onto rate-limited remote lookup queue
  const result = queue
    .then(() => throttledFetch(ip, options))
    .catch(() => null);

  queue = result.catch(() => {});
  return result.then((value) => {
    if (value !== null) {
      touchCache(ip, value);
    }
    return value;
  });
}

// Internal helpers exposed for automated testing
export function _clearGeoCache() {
  cache.clear();
  lastRequestAt = 0;
  queue = Promise.resolve();
}

export function _getGeoCacheSize() {
  return cache.size;
}


