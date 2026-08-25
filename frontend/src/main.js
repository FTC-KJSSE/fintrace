import { fetchEndpoints } from "./config/endpoints.js";
import { openTrace } from "./lib/sseClient.js";
import { latencyTier, TIER_COLOR } from "./lib/latency.js";
import { GlobeView } from "./components/globe/globe.js";
import { HopPanel } from "./components/panel/panel.js";
import { TickerBar } from "./components/ticker/ticker.js";
import { initNavbar } from "./components/navbar/navbar.js";
import { buildCompareSlots, COMPARE_COLORS } from "./components/compare/compare.js";

const LIVE_INTERVAL_MS = 30_000;

const els = {
  globe: document.getElementById("globe"),
  hopTable: document.getElementById("hop-table"),
  panelTitle: document.getElementById("panel-title"),
  tickerTrack: document.getElementById("ticker-track"),
  endpointSelect: document.getElementById("endpoint-select"),
  hostInput: document.getElementById("host-input"),
  runBtn: document.getElementById("run-btn"),
  singleControls: document.getElementById("single-controls"),
  compareControls: document.getElementById("compare-controls"),
  compareSlots: document.getElementById("compare-slots"),
  compareRunBtn: document.getElementById("compare-run-btn"),
};

let endpoints = [];
let mode = "single";
let liveTimer = null;
let activeSources = [];

const globe = new GlobeView(els.globe);
const panel = new HopPanel(els.hopTable, els.panelTitle);
const ticker = new TickerBar(els.tickerTrack);

function closeActiveSources() {
  activeSources.forEach((s) => s.close());
  activeSources = [];
}

function stopLive() {
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
  els.runBtn.textContent = "Run Trace →";
}

function endpointById(id) {
  return endpoints.find((e) => e.id === id);
}

/** Runs one trace and streams hops onto the globe + panel. */
function runSingleTrace(target, { keepPanelHistory = false } = {}) {
  closeActiveSources();
  const endpoint = endpointById(target);
  const label = endpoint ? endpoint.label : target;

  globe.reset();
  if (endpoint) globe.focusOn(endpoint.lat, endpoint.lon);
  if (!keepPanelHistory) panel.reset(`Tracing → ${label}`);
  else els.panelTitle.textContent = `Tracing → ${label}`;

  let lastGeoPoint = null;
  let lastRtt = null;

  const source = openTrace(target, {
    onHop: (hop) => {
      panel.upsertHop(hop);
      if (hop.rttMs != null) lastRtt = hop.rttMs;

      if (hop.geo) {
        const color = TIER_COLOR[latencyTier(hop.rttMs)];
        const point = { lat: hop.geo.lat, lon: hop.geo.lon };
        if (lastGeoPoint) {
          globe.addArc(lastGeoPoint, point, color);
        } else {
          globe.addPoint(point.lat, point.lon, "#8ab4f8");
        }
        lastGeoPoint = point;
      }
    },
    onDone: () => {
      if (lastGeoPoint && endpoint) {
        globe.addArc(lastGeoPoint, { lat: endpoint.lat, lon: endpoint.lon }, "#f0a830");
      }
      if (endpoint) ticker.update(endpoint.id, endpoint.label, lastRtt);
      els.panelTitle.textContent = `${label} — trace complete`;
    },
    onError: (err) => {
      els.panelTitle.textContent = `${label} — error: ${err.message ?? "trace failed"}`;
    },
  });

  activeSources.push(source);
}

function runCompareTrace(targetIds) {
  closeActiveSources();
  stopLive();
  globe.reset();
  const firstEndpoint = endpointById(targetIds[0]);
  if (firstEndpoint) globe.focusOn(firstEndpoint.lat, firstEndpoint.lon);
  els.panelTitle.textContent = "Comparing endpoints…";

  const entries = targetIds.map((id, i) => ({
    id,
    label: endpointById(id)?.label ?? id,
    host: endpointById(id)?.host ?? id,
    color: COMPARE_COLORS[i],
    rttMs: null,
    status: "tracing…",
  }));
  panel.showCompareSummary(entries);

  targetIds.forEach((id, i) => {
    const endpoint = endpointById(id);
    const color = COMPARE_COLORS[i];
    let lastGeoPoint = null;
    let lastRtt = null;

    const source = openTrace(id, {
      onHop: (hop) => {
        if (hop.rttMs != null) lastRtt = hop.rttMs;
        if (hop.geo) {
          const point = { lat: hop.geo.lat, lon: hop.geo.lon };
          if (lastGeoPoint) globe.addArc(lastGeoPoint, point, color);
          else globe.addPoint(point.lat, point.lon, color);
          lastGeoPoint = point;
        }
        entries[i].rttMs = lastRtt;
        panel.showCompareSummary(entries);
      },
      onDone: () => {
        if (lastGeoPoint && endpoint) {
          globe.addArc(lastGeoPoint, { lat: endpoint.lat, lon: endpoint.lon }, color);
        }
        entries[i].status = "done";
        panel.showCompareSummary(entries);
        checkCompareComplete(entries);
      },
      onError: (err) => {
        entries[i].status = err.message ?? "error";
        panel.showCompareSummary(entries);
        checkCompareComplete(entries);
      },
    });
    activeSources.push(source);
  });
}

function checkCompareComplete(entries) {
  if (entries.every((e) => e.status === "done" || (e.status && e.status !== "tracing…"))) {
    els.panelTitle.textContent = "Comparison complete";
  }
}

function currentSingleTarget() {
  const custom = els.hostInput.value.trim();
  return custom || els.endpointSelect.value;
}

function startLiveMode() {
  const target = currentSingleTarget();
  if (!target) return;

  runSingleTrace(target);
  els.runBtn.textContent = "Stop Live";

  liveTimer = setInterval(() => {
    runSingleTrace(target, { keepPanelHistory: true });
  }, LIVE_INTERVAL_MS);
}

function setMode(nextMode) {
  mode = nextMode;
  closeActiveSources();
  stopLive();

  els.singleControls.hidden = mode === "compare";
  els.compareControls.hidden = mode !== "compare";
  els.runBtn.textContent = mode === "live" ? "Start Live →" : "Run Trace →";
}

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
  const ids = [...els.compareSlots.querySelectorAll(".compare-slot")].map((s) => s.value);
  runCompareTrace(ids);
});

initNavbar(setMode);

fetchEndpoints()
  .then((data) => {
    endpoints = data;
    els.endpointSelect.innerHTML = endpoints
      .map((e) => `<option value="${e.id}">${e.label} — ${e.type}</option>`)
      .join("");
    buildCompareSlots(els.compareSlots, endpoints);
    ticker.seed(endpoints);
  })
  .catch(() => {
    els.panelTitle.textContent = "Could not reach FinTrace backend on :3001";
  });
