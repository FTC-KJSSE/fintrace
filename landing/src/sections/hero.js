import { ENDPOINTS, SOURCE, latencyTier, TIER_COLOR, routePoints } from "../data/endpoints.js";
import { LandingGlobe, reduceMotion } from "../globe/landingGlobe.js";

// The hero globe fires a chain of arcs to all nine endpoints in sequence, ring
// pulsing at each arrival, then loops. Under reduced motion it draws every
// route once and holds still.
export function initHeroGlobe(mount) {
  if (!mount) return null;

  const globe = new LandingGlobe(mount, { interactive: false, autoRotateSpeed: 0.3, distance: 360 });
  globe.setPin("source", SOURCE.lat, SOURCE.lon, "#ffc35c", { radius: 0.9, altitude: 0.02 });

  for (const ep of ENDPOINTS) {
    globe.setPin(ep.id, ep.lat, ep.lon, TIER_COLOR[latencyTier(ep.sampleRtt)], { radius: 0.55 });
  }

  const colorFor = (ep) => TIER_COLOR[latencyTier(ep.sampleRtt)];

  if (reduceMotion) {
    for (const ep of ENDPOINTS) globe.setRoute(ep.id, colorFor(ep), routePoints(ep));
    return globe;
  }

  let cancelled = false;
  (async function loop() {
    while (!cancelled && !globe.disposed) {
      globe.clearRoutes();
      for (const ep of ENDPOINTS) {
        if (cancelled || globe.disposed) return;
        globe.setRoute(ep.id, colorFor(ep), routePoints(ep));
        await globe.revealRoute(ep.id, { hopDelay: 340 });
        await wait(260);
      }
      await wait(4200);
    }
  })();

  const original = globe.destroy.bind(globe);
  globe.destroy = () => {
    cancelled = true;
    original();
  };

  return globe;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
