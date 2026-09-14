import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  geolocate,
  _clearGeoCache,
  _getGeoCacheSize,
  setMmdbReader,
  isOfflineDatabaseLoaded,
  findMmdbPath,
  GEOLOCATION_ATTRIBUTION,
} from "../backend/src/geolocate.js";

describe("Geolocation Source, Offline MMDB & Privacy Hardening", () => {
  beforeEach(() => {
    _clearGeoCache();
    setMmdbReader(null);
  });

  afterEach(() => {
    setMmdbReader(null);
  });

  test("resolves geolocation instantly from local MMDB reader without network calls", async () => {
    // Mock an MMDB Reader instance matching the DB-IP / MaxMind City structure
    const mockMmdbReader = {
      get(ip) {
        if (ip === "104.26.10.230") {
          return {
            city: { names: { en: "San Francisco" } },
            country: { names: { en: "United States" } },
            location: { latitude: 37.7749, longitude: -122.4194 },
            traits: { isp: "Cloudflare, Inc." },
          };
        }
        return null;
      },
    };

    setMmdbReader(mockMmdbReader);
    assert.equal(isOfflineDatabaseLoaded(), true);

    const startTime = performance.now();
    const result = await geolocate("104.26.10.230");
    const durationMs = performance.now() - startTime;

    assert.deepEqual(result, {
      lat: 37.7749,
      lon: -122.4194,
      city: "San Francisco",
      country: "United States",
      isp: "Cloudflare, Inc.",
    });

    // Local MMDB lookups must be sub-millisecond (instantaneous, zero network delay)
    assert.ok(durationMs < 15, `Local MMDB lookup should be instantaneous (<15ms), took ${durationMs}ms`);
    assert.equal(_getGeoCacheSize(), 1, "Result should be placed in LRU cache");

    // Repeated lookup should hit LRU cache
    const cached = await geolocate("104.26.10.230");
    assert.deepEqual(cached, result);
  });

  test("handles missing local database gracefully and falls back to remote API", async () => {
    setMmdbReader(null);
    assert.equal(isOfflineDatabaseLoaded(), false);

    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        status: "success",
        lat: 19.076,
        lon: 72.8777,
        city: "Mumbai",
        country: "India",
        isp: "Tata Communications",
      }),
    });

    const result = await geolocate("115.112.0.1", { fetchFn: mockFetch, minIntervalMs: 0 });
    assert.equal(result.lat, 19.076);
    assert.equal(result.city, "Mumbai");
  });

  test("rejects and skips private RFC-1918 and loopback IPs synchronously", async () => {
    const testIps = [
      "10.0.0.1",
      "10.255.255.255",
      "192.168.1.1",
      "192.168.0.254",
      "172.16.0.1",
      "172.31.255.255",
      "127.0.0.1",
      "169.254.1.1",
      null,
      "",
    ];

    for (const ip of testIps) {
      const result = await geolocate(ip);
      assert.equal(result, null, `Expected null for private/invalid IP: ${ip}`);
    }

    assert.equal(_getGeoCacheSize(), 0, "Private IPs should never populate the LRU cache");
  });

  test("times out and returns null instead of hanging indefinitely", async () => {
    const mockStallingFetch = async (_url, { signal }) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({ status: "success", lat: 1, lon: 1, city: "Slow", isp: "Stall" }),
          });
        }, 2000);

        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
        });
      });
    };

    const startTime = Date.now();
    const result = await geolocate("198.51.100.5", {
      fetchFn: mockStallingFetch,
      timeoutMs: 60,
      minIntervalMs: 0,
    });
    const elapsed = Date.now() - startTime;

    assert.equal(result, null, "Timed out geolocation lookup must resolve to null");
    assert.ok(elapsed < 1000, `Lookup should abort promptly (elapsed: ${elapsed}ms)`);
  });

  test("handles network and HTTP errors without crashing or throwing", async () => {
    const mockFailingFetch = async () => {
      throw new Error("getaddrinfo ENOTFOUND ip-api.com");
    };

    const result = await geolocate("203.0.113.1", { fetchFn: mockFailingFetch, minIntervalMs: 0 });
    assert.equal(result, null, "Network error must resolve gracefully to null");
  });

  test("handles non-200 HTTP status and upstream failure status", async () => {
    const mockHttp500 = async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const mockApiFail = async () => ({
      ok: true,
      json: async () => ({ status: "fail", message: "reserved range" }),
    });

    const res1 = await geolocate("203.0.113.2", { fetchFn: mockHttp500, minIntervalMs: 0 });
    assert.equal(res1, null, "HTTP 500 must resolve to null");

    const res2 = await geolocate("203.0.113.3", { fetchFn: mockApiFail, minIntervalMs: 0 });
    assert.equal(res2, null, "API status=fail must resolve to null");
  });

  test("supports offline-only mode flag", async () => {
    let networkAttempted = false;
    const mockFetch = async () => {
      networkAttempted = true;
      throw new Error("Should not reach network in offlineOnly mode");
    };

    const res = await geolocate("198.51.100.99", {
      fetchFn: mockFetch,
      offlineOnly: true,
    });

    assert.equal(res, null);
    assert.equal(networkAttempted, false, "offlineOnly mode must never hit network");
  });

  test("provides standard attribution constant", () => {
    assert.ok(GEOLOCATION_ATTRIBUTION.includes("DB-IP"));
    assert.ok(GEOLOCATION_ATTRIBUTION.includes("CC BY 4.0"));
  });
});
