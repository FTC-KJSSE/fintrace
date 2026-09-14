const EARTH_RADIUS_KM = 6371;

/**
 * Calculates the great-circle distance between two geographic coordinates
 * using the Haversine formula.
 *
 * NOTE: This represents the approximate geographic distance between geolocated
 * hop coordinates, NOT the actual physical fiber-optic cable route length.
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c);
}

/**
 * Derives quantitative metrics strictly from measured hop data.
 */
export function deriveRouteMetrics(hops, endpoint = null) {
  if (!hops || hops.length === 0) {
    return {
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
    };
  }

  const totalHops = hops.length;
  const respondingHops = hops.filter((h) => h.rttMs != null);
  const timedOutCount = hops.filter((h) => h.timedOut || h.rttMs == null).length;
  const timeoutRate = Math.round((timedOutCount / totalHops) * 100);

  const rtts = respondingHops.map((h) => h.rttMs);
  const minRtt = rtts.length ? Math.min(...rtts) : null;
  const maxRtt = rtts.length ? Math.max(...rtts) : null;
  const avgRtt = rtts.length
    ? Math.round((rtts.reduce((a, b) => a + b, 0) / rtts.length) * 10) / 10
    : null;

  const lastResponding = respondingHops[respondingHops.length - 1];
  const destinationRtt = lastResponding ? lastResponding.rttMs : null;

  // Latency tier breakdown
  const tierDistribution = { low: 0, medium: 0, high: 0, timeout: 0 };
  for (const hop of hops) {
    if (hop.rttMs == null || hop.timedOut) {
      tierDistribution.timeout++;
    } else if (hop.rttMs < 50) {
      tierDistribution.low++;
    } else if (hop.rttMs <= 150) {
      tierDistribution.medium++;
    } else {
      tierDistribution.high++;
    }
  }

  // Hop-by-hop RTT deltas (Hop N RTT - Hop N-1 RTT)
  const hopDeltas = [];
  let prevRtt = null;
  for (const hop of hops) {
    if (hop.rttMs != null) {
      const delta = prevRtt != null ? Math.round((hop.rttMs - prevRtt) * 10) / 10 : 0;
      hopDeltas.push({ hopIndex: hop.hopIndex, delta, rttMs: hop.rttMs });
      prevRtt = hop.rttMs;
    } else {
      hopDeltas.push({ hopIndex: hop.hopIndex, delta: null, rttMs: null });
    }
  }

  // Geographic segments & total span
  const geolocatedHops = hops.filter((h) => h.geo && h.geo.lat != null && h.geo.lon != null);
  const geoSegments = [];
  let totalGeoSpanKm = 0;

  for (let i = 0; i < geolocatedHops.length; i++) {
    const current = geolocatedHops[i];
    if (i > 0) {
      const prev = geolocatedHops[i - 1];
      const dist = haversineDistanceKm(prev.geo.lat, prev.geo.lon, current.geo.lat, current.geo.lon);
      if (dist != null) {
        totalGeoSpanKm += dist;
        geoSegments.push({
          fromHop: prev.hopIndex,
          toHop: current.hopIndex,
          distanceKm: dist,
        });
      }
    }
  }

  // Add final segment to destination landmark coordinates if available
  if (endpoint && geolocatedHops.length > 0) {
    const lastGeo = geolocatedHops[geolocatedHops.length - 1];
    const finalDist = haversineDistanceKm(lastGeo.geo.lat, lastGeo.geo.lon, endpoint.lat, endpoint.lon);
    if (finalDist != null && finalDist > 0) {
      totalGeoSpanKm += finalDist;
      geoSegments.push({
        fromHop: lastGeo.hopIndex,
        toHop: "Destination",
        distanceKm: finalDist,
      });
    }
  }

  return {
    totalHops,
    geolocatedCount: geolocatedHops.length,
    timedOutCount,
    timeoutRate,
    minRtt,
    maxRtt,
    avgRtt,
    destinationRtt,
    totalGeoSpanKm: Math.round(totalGeoSpanKm),
    tierDistribution,
    hopDeltas,
    geoSegments,
  };
}
