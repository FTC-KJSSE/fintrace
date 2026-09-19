// ---------------------------------------------------------------------------
// FinTrace landing page — entry point.
//
// Four sections: hero, how it works, endpoints, download. Two WebGL contexts
// (hero and the endpoint directory), each paused by an IntersectionObserver
// whenever its canvas leaves the viewport. If WebGL is unavailable the globes
// are skipped and every section still reads correctly.
// ---------------------------------------------------------------------------

import { $ } from "./lib/dom.js";
import { brandMark } from "./lib/icons.js";
import { initCounters } from "./lib/counters.js";
import { initReveal } from "./lib/reveal.js";
import { initSpotlight } from "./lib/spotlight.js";

import { renderDownload } from "./sections/download.js";
import { renderEndpointDirectory, renderTrustRow } from "./sections/endpoints.js";
import { renderHopTable, renderRouteStats } from "./sections/hops.js";
import { initNav } from "./sections/nav.js";
import { renderStatStrip } from "./sections/statStrip.js";
import { initTicker } from "./sections/ticker.js";

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function boot() {
  for (const brand of document.querySelectorAll(".brand")) {
    brand.insertAdjacentHTML("afterbegin", brandMark(26));
  }

  // --- Chrome -------------------------------------------------------------
  initTicker($("#ticker-track"));
  initNav($("#nav"), $("#nav-progress"));
  renderStatStrip($("#stat-strip"));

  // --- Content ------------------------------------------------------------
  renderHopTable($("#hop-table"), {
    hostLabel: $("#trace-host"),
    statusLabel: $("#trace-status"),
  });
  renderRouteStats($("#route-stats"));

  const directory = renderEndpointDirectory({
    grid: $("#endpoint-grid"),
    tag: $("#dir-tag"),
    hostDemo: $("#host-demo"),
  });
  renderTrustRow($("#trust-row"));

  renderDownload({
    grid: $("#dl-grid"),
    meta: $("#dl-meta"),
    notice: $("#smartscreen"),
    footerMeta: $("#footer-meta"),
  });

  // --- Globes -------------------------------------------------------------
  // Loaded after first paint. Without WebGL the globe panels are dead weight,
  // so they're removed and the surrounding copy carries the section.
  if (hasWebGL()) {
    import("./globes.js")
      .then(({ initGlobes }) => initGlobes({ directory }))
      .catch(() => document.documentElement.classList.add("no-webgl"));
  } else {
    $("#hero-globe")?.remove();
    $(".directory-globe")?.remove();
    document.documentElement.classList.add("no-webgl");
  }

  // --- Behaviour ----------------------------------------------------------
  // Reveal and counters run last so they observe the nodes the renderers made.
  initReveal();
  initCounters();
  initSpotlight();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
