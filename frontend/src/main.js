import { fetchEndpoints } from "./config/endpoints.js";
import { openTrace } from "./lib/sseClient.js";
import { latencyTier, TIER_COLOR } from "./lib/latency.js";
import { GlobeView } from "./components/globe/globe.js";
import { HopPanel } from "./components/panel/panel.js";
import { TickerBar } from "./components/ticker/ticker.js";
import {
  buildCompareSlots,
  renderCompareCards,
  validateCompareTargets,
  calculateCompareProgress,
  formatCompareStatus,
  COMPARE_COLORS,
} from "./components/compare/compare.js";
import { deriveRouteMetrics } from "./lib/geoMath.js";
import { AnalyticsSuite } from "./components/analytics/analytics.js";

const LIVE_INTERVAL_MS = 30_000;

const els = {
  globe: document.getElementById("globe"),
  hopTable: document.getElementById("hop-table"),
  panelTitle: document.getElementById("panel-title"),
  panelRttBadge: document.getElementById("panel-rtt-badge"),
  tickerTrack: document.getElementById("ticker-track"),
  endpointSelect: document.getElementById("endpoint-select"),
  endpointList: document.getElementById("endpoint-list"),
  hostInput: document.getElementById("host-input"),
  runBtn: document.getElementById("run-btn"),
  singleControls: document.getElementById("single-controls"),
  compareControls: document.getElementById("compare-controls"),
  compareSlots: document.getElementById("compare-slots"),
  compareRunBtn: document.getElementById("compare-run-btn"),
  liveStatusBadge: document.getElementById("live-status-badge"),
  liveStatusText: document.getElementById("live-status-text"),
  liveTimerCountdown: document.getElementById("live-timer-countdown"),
  modeBtns: document.querySelectorAll(".mode-btn"),
  routeSummary: document.getElementById("route-summary"),
  tierDistChart: document.getElementById("tier-dist-chart"),
  timeSeriesChart: document.getElementById("time-series-chart"),
  hopRttChart: document.getElementById("hop-rtt-chart"),
  compareCardsContainer: document.getElementById("compare-cards-container"),
  footerSourceIp: document.getElementById("footer-source-ip"),
};

let endpoints = [];
let mode = "single";
let liveTimer = null;
let countdownTimer = null;
let secondsUntilNextTrace = 30;
let activeSources = [];

const globe = new GlobeView(els.globe);
const panel = new HopPanel(els.hopTable, els.panelTitle, els.panelRttBadge);
const ticker = new TickerBar(els.tickerTrack);
const analytics = new AnalyticsSuite({
  rttChart: els.hopRttChart,
  timeSeries: els.timeSeriesChart,
  tierDist: els.tierDistChart,
  summary: els.routeSummary,
});

/**
 * RouteTracker maintains separate, ordered route telemetry state per endpoint.
 * Ensures zero fabricated hops while reconstructing true sequential geolocated segments.
 */
class RouteTracker {
  constructor() {
    this.routes = new Map();
  }

  reset() {
    this.routes.clear();
  }

  initRoute(targetId, endpoint, color, slotIndex = 0) {
    this.routes.set(targetId, {
      id: targetId,
      endpoint,
      color,
      slotIndex,
      hops: [],
      geoSequence: [],
      arcs: [],
      isFinalized: false,
    });
  }

  addHop(targetId, hop) {
    const route = this.routes.get(targetId);
    if (!route) return;

    // Upsert hop by hopIndex
    const existingIdx = route.hops.findIndex((h) => h.hopIndex === hop.hopIndex);
    if (existingIdx >= 0) {
      route.hops[existingIdx] = hop;
    } else {
      route.hops.push(hop);
      route.hops.sort((a, b) => a.hopIndex - b.hopIndex);
    }

    this._rebuildRouteData(targetId);
  }

  finalizeRoute(targetId) {
    const route = this.routes.get(targetId);
    if (!route) return;
    route.isFinalized = true;
    this._rebuildRouteData(targetId);
  }

  _rebuildRouteData(targetId) {
    const route = this.routes.get(targetId);
    if (!route) return;

    // Build ordered list of valid geolocated points
    const geoSeq = [];
    route.hops.forEach((h) => {
      if (h.geo && h.geo.lat != null && h.geo.lon != null) {
        geoSeq.push({
          hopIndex: h.hopIndex,
          lat: h.geo.lat,
          lon: h.geo.lon,
          city: h.geo.city || "",
          isp: h.geo.isp || "",
          ip: h.ip,
          rttMs: h.rttMs,
          isDestination: false,
        });
      }
    });

    // If route is finalized and target endpoint has configured coordinates, append destination
    if (route.isFinalized && route.endpoint && route.endpoint.lat != null && route.endpoint.lon != null) {
      const destPoint = {
        hopIndex: 999,
        lat: route.endpoint.lat,
        lon: route.endpoint.lon,
        city: route.endpoint.label,
        isp: route.endpoint.label,
        ip: route.endpoint.host,
        rttMs: route.hops[route.hops.length - 1]?.rttMs ?? null,
        isDestination: true,
      };

      const last = geoSeq[geoSeq.length - 1];
      if (!last || Math.hypot(last.lat - destPoint.lat, last.lon - destPoint.lon) > 0.001) {
        geoSeq.push(destPoint);
      }
    }

    route.geoSequence = geoSeq;

    // Reconstruct sequential arcs between consecutive unique geographic points
    const arcs = [];
    for (let i = 0; i < geoSeq.length - 1; i++) {
      const from = geoSeq[i];
      const to = geoSeq[i + 1];
      const distDeg = Math.hypot(to.lat - from.lat, to.lon - from.lon);

      // Render arc if points are distinct
      if (distDeg > 0.001) {
        // Natural altitude scaling: short hops stay close, long transoceanic hops curve comfortably
        const segAltitude = Math.max(0.04, Math.min(0.24, (distDeg / 90) * 0.20)) + route.slotIndex * 0.025;
        const segColor = route.color || TIER_COLOR[latencyTier(to.rttMs)] || "#f0a830";

        arcs.push({
          startLat: from.lat,
          startLng: from.lon,
          endLat: to.lat,
          endLng: to.lon,
          color: segColor,
          altitude: segAltitude,
          stroke: 0.85,
          dashLength: 0.55,
          dashGap: 0.12,
          animateTime: 2000,
          fromHop: from.hopIndex,
          toHop: to.hopIndex,
          routeId: targetId,
        });
      }
    }
    route.arcs = arcs;
  }

  getAllArcs() {
    const all = [];
    this.routes.forEach((r) => all.push(...r.arcs));
    return all;
  }

  getAllPoints() {
    const pointsMap = new Map();
    this.routes.forEach((r) => {
      r.geoSequence.forEach((p) => {
        const key = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
        const ptColor = p.isDestination ? "#ffffff" : (r.color || TIER_COLOR[latencyTier(p.rttMs)] || "#38bdf8");
        const radius = p.isDestination ? 1.2 : 0.75;
        const altitude = p.isDestination ? 0.024 : 0.016;

        if (!pointsMap.has(key) || p.isDestination) {
          pointsMap.set(key, {
            lat: p.lat,
            lng: p.lon,
            color: ptColor,
            radius,
            altitude,
          });
        }
      });
    });
    return [...pointsMap.values()];
  }

  getAllDestinationRings() {
    const rings = [];
    this.routes.forEach((r) => {
      if (r.endpoint && r.endpoint.lat != null && r.endpoint.lon != null) {
        rings.push({
          lat: r.endpoint.lat,
          lng: r.endpoint.lon,
          color: r.color || "#22c55e",
        });
      }
    });
    return rings;
  }
}

const routeTracker = new RouteTracker();

function closeActiveSources() {
  activeSources.forEach((s) => s.close());
  activeSources = [];
}

function stopLive() {
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  if (els.liveStatusBadge) els.liveStatusBadge.hidden = true;
  els.runBtn.textContent = mode === "live" ? "Start Live →" : "Run Trace →";
  els.runBtn.classList.remove("stop");
}

function endpointById(id) {
  return endpoints.find((e) => e.id === id);
}

function updateDirectoryItemRtt(id, rttMs) {
  const item = document.querySelector(`.endpoint-item[data-id="${id}"]`);
  if (!item) return;
  const tag = item.querySelector(".endpoint-rtt-tag");
  if (!tag) return;

  if (rttMs != null) {
    const tier = latencyTier(rttMs);
    tag.textContent = `${rttMs} ms`;
    tag.className = `endpoint-rtt-tag ${tier}`;
  } else {
    tag.textContent = "—";
    tag.className = "endpoint-rtt-tag";
  }
}

function highlightActiveEndpoint(id) {
  document.querySelectorAll(".endpoint-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });
}

/** Runs one trace and streams hops onto the globe + panel + analytics. */
function runSingleTrace(target, { keepPanelHistory = false } = {}) {
  closeActiveSources();
  const endpoint = endpointById(target);
  const label = endpoint ? endpoint.label : target;
  highlightActiveEndpoint(endpoint ? endpoint.id : "");

  if (!keepPanelHistory) {
    routeTracker.reset();
    routeTracker.initRoute(target, endpoint, null, 0);
    globe.reset();
    if (endpoint) globe.focusOn(endpoint.lat, endpoint.lon, 320);
    panel.reset(`TRACING: ${label.toUpperCase()}`);
    if (els.panelRttBadge) els.panelRttBadge.textContent = "…";
    analytics.reset();
  } else {
    els.panelTitle.textContent = `LIVE TRACE: ${label.toUpperCase()}`;
  }

  let lastRtt = null;

  const source = openTrace(target, {
    onHop: (hop) => {
      routeTracker.addHop(target, hop);
      panel.upsertHop(hop);
      if (hop.rttMs != null) lastRtt = hop.rttMs;

      // Update source IP in footer if detected on early hops
      if (hop.hopIndex <= 2 && hop.ip && !hop.ip.startsWith("10.") && !hop.ip.startsWith("192.168.")) {
        const loc = hop.geo ? ` (${hop.geo.city || ""}, ${hop.geo.country || ""})` : "";
        if (els.footerSourceIp) {
          els.footerSourceIp.innerHTML = `<span>Source: ${hop.ip}${loc}</span>`;
        }
      }

      // Live metrics calculation from actual hop telemetry
      const route = routeTracker.routes.get(target);
      if (route) {
        const metrics = deriveRouteMetrics(route.hops, endpoint);
        analytics.update(metrics, route.hops);
      }

      // Update globe with all sequential arcs and points
      globe.setArcs(routeTracker.getAllArcs());
      globe.setPoints(routeTracker.getAllPoints());
    },
    onDone: () => {
      routeTracker.finalizeRoute(target);
      const finalColor = TIER_COLOR[latencyTier(lastRtt)] ?? "#f0a830";

      // Refresh arcs with final destination segment
      globe.setArcs(routeTracker.getAllArcs());
      globe.setPoints(routeTracker.getAllPoints());
      if (endpoint) {
        globe.setDestinationRing(endpoint.lat, endpoint.lon, finalColor);
        ticker.update(endpoint.id, endpoint.label, lastRtt);
        updateDirectoryItemRtt(endpoint.id, lastRtt);
        analytics.recordHistoryPoint(endpoint.id, endpoint.label, lastRtt, finalColor);
      }

      const route = routeTracker.routes.get(target);
      if (route) {
        const metrics = deriveRouteMetrics(route.hops, endpoint);
        analytics.update(metrics, route.hops);
      }

      els.panelTitle.textContent = `LIVE TRACE: ${label.toUpperCase()}`;
      if (els.panelRttBadge) {
        const tier = latencyTier(lastRtt);
        els.panelRttBadge.textContent = lastRtt != null ? `${lastRtt} ms` : "timeout";
        els.panelRttBadge.className = `panel-rtt-badge ${tier}`;
      }
    },
    onError: (err) => {
      els.panelTitle.textContent = `${label.toUpperCase()} — ERROR: ${err.message ?? "trace failed"}`;
      if (els.panelRttBadge) els.panelRttBadge.textContent = "ERR";
    },
  });

  activeSources.push(source);
}

function runCompareTrace(targetIds) {
  const validation = validateCompareTargets(targetIds);
  if (!validation.valid) {
    els.panelTitle.textContent = validation.error;
    return;
  }

  const validTargets = validation.targets;
  closeActiveSources();
  stopLive();
  globe.reset();
  routeTracker.reset();

  const selectedEndpoints = validTargets.map((id) => endpointById(id));
  globe.frameCompareView(selectedEndpoints);

  const entries = validTargets.map((id, i) => {
    const endpoint = endpointById(id);
    const color = COMPARE_COLORS[i] || "#8e959d";
    routeTracker.initRoute(id, endpoint, color, i);
    return {
      id,
      label: endpoint?.label ?? id,
      host: endpoint?.host ?? id,
      color,
      rttMs: null,
      status: "waiting",
      hopCount: 0,
      history: [],
    };
  });

  function updateCompareUI() {
    const progress = calculateCompareProgress(entries);
    els.panelTitle.textContent = progress.summaryText;
    if (els.panelRttBadge) {
      els.panelRttBadge.textContent = progress.progressBadge;
      els.panelRttBadge.className = `panel-rtt-badge ${progress.isFinished ? "low" : "medium"}`;
    }
    panel.showCompareSummary(entries);
    renderCompareCards(els.compareCardsContainer, entries);
  }

  updateCompareUI();

  validTargets.forEach((id, i) => {
    const source = openTrace(id, {
      onStart: () => {
        entries[i].status = "tracing";
        updateCompareUI();
      },
      onHop: (hop) => {
        entries[i].status = "tracing";
        entries[i].hopCount++;
        if (hop.rttMs != null) {
          entries[i].rttMs = hop.rttMs;
          entries[i].history.push(hop.rttMs);
        }

        routeTracker.addHop(id, hop);
        globe.setArcs(routeTracker.getAllArcs());
        globe.setPoints(routeTracker.getAllPoints());
        globe.setDestinationRings(routeTracker.getAllDestinationRings());

        updateCompareUI();
      },
      onDone: () => {
        routeTracker.finalizeRoute(id);
        globe.setArcs(routeTracker.getAllArcs());
        globe.setPoints(routeTracker.getAllPoints());
        globe.setDestinationRings(routeTracker.getAllDestinationRings());

        entries[i].status = "done";
        if (entries[i].rttMs != null) updateDirectoryItemRtt(id, entries[i].rttMs);
        updateCompareUI();
      },
      onError: (err) => {
        entries[i].status = err.message ?? "error";
        updateCompareUI();
      },
    });
    activeSources.push(source);
  });
}

function currentSingleTarget() {
  const custom = els.hostInput.value.trim();
  return custom || els.endpointSelect.value;
}

function startLiveMode() {
  const target = currentSingleTarget();
  if (!target) return;

  runSingleTrace(target);
  els.runBtn.textContent = "Stop Trace";
  els.runBtn.classList.add("stop");
  if (els.liveStatusBadge) {
    els.liveStatusBadge.hidden = false;
    els.liveStatusText.textContent = "LIVE";
  }

  secondsUntilNextTrace = LIVE_INTERVAL_MS / 1000;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    secondsUntilNextTrace--;
    if (secondsUntilNextTrace <= 0) {
      secondsUntilNextTrace = LIVE_INTERVAL_MS / 1000;
    }
    if (els.liveTimerCountdown) {
      els.liveTimerCountdown.textContent = `Next update in ${secondsUntilNextTrace}s`;
    }
  }, 1000);

  if (liveTimer) clearInterval(liveTimer);
  liveTimer = setInterval(() => {
    runSingleTrace(target, { keepPanelHistory: true });
  }, LIVE_INTERVAL_MS);
}

function setMode(nextMode) {
  mode = nextMode;
  closeActiveSources();
  stopLive();

  els.modeBtns.forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });

  const isCompare = mode === "compare";
  els.singleControls.hidden = isCompare;
  els.compareControls.hidden = !isCompare;
  els.runBtn.hidden = isCompare;
  els.compareRunBtn.hidden = !isCompare;

  if (els.hopRttChart) els.hopRttChart.hidden = isCompare;
  if (els.timeSeriesChart) els.timeSeriesChart.hidden = isCompare;
  if (els.compareCardsContainer) els.compareCardsContainer.hidden = !isCompare;

  if (!isCompare) {
    if (els.compareCardsContainer) els.compareCardsContainer.innerHTML = "";
  }

  els.runBtn.textContent = mode === "live" ? "Start Live →" : "Run Trace →";
  els.runBtn.classList.remove("stop");
}

// Mode button clicks
els.modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    setMode(btn.dataset.mode);
  });
});

els.runBtn.addEventListener("click", () => {
  if (mode === "live") {
    if (liveTimer) {
      stopLive();
      closeActiveSources();
    } else {
      startLiveMode();
    }
    return;
  }
  const target = currentSingleTarget();
  if (target) runSingleTrace(target);
});

els.compareRunBtn.addEventListener("click", () => {
  const ids = typeof els.compareSlots.getSelectedIds === "function"
    ? els.compareSlots.getSelectedIds()
    : [...els.compareSlots.querySelectorAll(".compare-slot")].map((s) => s.value);
  runCompareTrace(ids);
});

// Host input Enter key trigger
els.hostInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const target = currentSingleTarget();
    if (target) runSingleTrace(target);
  }
});

// Dropdown change trigger
els.endpointSelect.addEventListener("change", () => {
  els.hostInput.value = "";
  const target = els.endpointSelect.value;
  if (target) {
    const ep = endpointById(target);
    if (ep) globe.focusOn(ep.lat, ep.lon, 320);
    highlightActiveEndpoint(target);
    if (mode === "live") {
      startLiveMode();
    } else {
      runSingleTrace(target);
    }
  }
});

// Load endpoints & initialize UI
fetchEndpoints()
  .then((data) => {
    endpoints = data;

    // Populate dropdown with clean labels (avoid undefined)
    els.endpointSelect.innerHTML = endpoints
      .map((e) => `<option value="${e.id}">${e.label} (${e.type})</option>`)
      .join("");

    // Populate Left Sidebar Endpoints Directory
    if (els.endpointList) {
      els.endpointList.innerHTML = endpoints
        .map(
          (e) => `
          <div class="endpoint-item" data-id="${e.id}">
            <div class="endpoint-name-group">
              <span class="endpoint-dot"></span>
              <span class="endpoint-label-text">${e.label}</span>
            </div>
            <span class="endpoint-rtt-tag">—</span>
          </div>
        `
        )
        .join("");

      // Add click listener to directory items
      els.endpointList.querySelectorAll(".endpoint-item").forEach((item) => {
        item.addEventListener("click", () => {
          const id = item.dataset.id;
          els.endpointSelect.value = id;
          els.hostInput.value = "";
          const ep = endpointById(id);
          if (ep) globe.focusOn(ep.lat, ep.lon, 320);
          highlightActiveEndpoint(id);
          if (mode === "live") {
            startLiveMode();
          } else {
            runSingleTrace(id);
          }
        });
      });
    }

    buildCompareSlots(els.compareSlots, endpoints);
    ticker.seed(endpoints);

    // Initial highlight & neutral camera framing over the home region
    if (endpoints.length > 0) {
      highlightActiveEndpoint(endpoints[0].id);
      globe.focusOn(endpoints[0].lat, endpoints[0].lon, 320);
    }
  })
  .catch((err) => {
    console.error("Failed to load endpoints:", err);
    els.panelTitle.textContent = "Could not reach FinTrace backend on :3001";
  });
