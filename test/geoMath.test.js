import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { haversineDistanceKm, deriveRouteMetrics } from "../frontend/src/lib/geoMath.js";

describe("Geographic Distance & Route Metrics Math", () => {
  test("haversineDistanceKm calculates accurate great-circle distances", () => {
    // Same coordinate pair
    assert.equal(haversineDistanceKm(19.076, 72.8777, 19.076, 72.8777), 0);

    // Null/undefined values
    assert.equal(haversineDistanceKm(null, 72.8777, 19.076, 72.8777), null);
    assert.equal(haversineDistanceKm(19.076, null, 19.076, 72.8777), null);

    // Mumbai (19.0760, 72.8777) to London (51.5074, -0.1278) ~ 7,190 km
    const mumbaiLondon = haversineDistanceKm(19.076, 72.8777, 51.5074, -0.1278);
    assert.ok(mumbaiLondon >= 7170 && mumbaiLondon <= 7210, `Expected ~7190km, got ${mumbaiLondon}`);

    // New York (40.7128, -74.0060) to Tokyo (35.6762, 139.6503) ~ 10,850 km
    const nyTokyo = haversineDistanceKm(40.7128, -74.006, 35.6762, 139.6503);
    assert.ok(nyTokyo >= 10830 && nyTokyo <= 10870, `Expected ~10850km, got ${nyTokyo}`);
  });

  test("deriveRouteMetrics handles empty and null inputs safely", () => {
    const emptyMetrics = deriveRouteMetrics([]);
    assert.deepEqual(emptyMetrics, {
      totalHops: 0,
      geolocatedCount: 0,
      timedOutCount: 0,
      timeoutRate: 0,
      minRtt: null,
      maxRtt: null,
      avgRtt: null,
      destinationRtt: null,
      totalGeoSpanKm: 0,
      tierDistribution: { low: 0, medium: 0, high: 0, timeout: 0 },
      hopDeltas: [],
      geoSegments: [],
    });
  });

  test("deriveRouteMetrics calculates accurate RTT ranges, tiers, and spans", () => {
    const sampleHops = [
      {
        hopIndex: 1,
        ip: "192.168.1.1",
        rttMs: 2.1,
        timedOut: false,
        geo: null,
      },
      {
        hopIndex: 2,
        ip: "115.112.0.1",
        rttMs: 24.5,
        timedOut: false,
        geo: { lat: 19.076, lon: 72.8777, city: "Mumbai" },
      },
      {
        hopIndex: 3,
        ip: null,
        rttMs: null,
        timedOut: true,
        geo: null,
      },
      {
        hopIndex: 4,
        ip: "182.79.255.4",
        rttMs: 145.0,
        timedOut: false,
        geo: { lat: 51.5074, lon: -0.1278, city: "London" },
      },
    ];

    const endpoint = {
      id: "bloomberg",
      label: "Bloomberg",
      lat: 40.7639,
      lon: -73.97,
    };

    const metrics = deriveRouteMetrics(sampleHops, endpoint);

    assert.equal(metrics.totalHops, 4);
    assert.equal(metrics.geolocatedCount, 2);
    assert.equal(metrics.timedOutCount, 1);
    assert.equal(metrics.timeoutRate, 25);
    assert.equal(metrics.minRtt, 2.1);
    assert.equal(metrics.maxRtt, 145.0);
    assert.equal(metrics.destinationRtt, 145.0);
    assert.equal(metrics.tierDistribution.low, 2);
    assert.equal(metrics.tierDistribution.medium, 1);
    assert.equal(metrics.tierDistribution.high, 0);
    assert.equal(metrics.tierDistribution.timeout, 1);
    assert.ok(metrics.totalGeoSpanKm > 10000, `Expected total geo span > 10000km, got ${metrics.totalGeoSpanKm}`);
    assert.equal(metrics.geoSegments.length, 2, "Expected 2 segments (Mumbai->London and London->Destination)");
  });
});
