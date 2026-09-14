import { latencyTier, TIER_COLOR } from "../../lib/latency.js";

const NS = "http://www.w3.org/2000/svg";

export class AnalyticsSuite {
  constructor(elements) {
    this.rttChartEl = elements.rttChart;
    this.timeSeriesEl = elements.timeSeries;
    this.tierDistEl = elements.tierDist;
    this.summaryEl = elements.summary;
    this.history = new Map(); // targetId -> Array<{ timestamp, rttMs, label, color }>
  }

  reset() {
    if (this.rttChartEl) this.rttChartEl.innerHTML = '<div class="chart-empty">Awaiting trace telemetry…</div>';
    if (this.tierDistEl) this.tierDistEl.innerHTML = "";
    if (this.summaryEl) this.summaryEl.innerHTML = "";
  }

  recordHistoryPoint(targetId, label, rttMs, color = "#22c55e") {
    if (!this.history.has(targetId)) {
      this.history.set(targetId, []);
    }
    const series = this.history.get(targetId);
    series.push({
      timestamp: Date.now(),
      rttMs: rttMs != null ? rttMs : null,
      label,
      color,
    });
    // Keep last 30 samples (~15 minutes of 30s live re-traces)
    if (series.length > 30) {
      series.shift();
    }
    this.renderLatencyOverTime();
  }

  update(metrics, activeHops = []) {
    this.renderSummary(metrics);
    this.renderTierDistribution(metrics.tierDistribution, metrics.totalHops);
    this.renderHopRttBars(activeHops, metrics.maxRtt);
  }

  renderSummary(metrics) {
    if (!this.summaryEl) return;
    if (!metrics || metrics.totalHops === 0) {
      this.summaryEl.innerHTML = "";
      return;
    }

    const destRtt = metrics.destinationRtt != null ? `${metrics.destinationRtt} ms` : "—";
    const destTier = metrics.destinationRtt != null ? latencyTier(metrics.destinationRtt) : "timeout";
    const avgRtt = metrics.avgRtt != null ? `${metrics.avgRtt} ms` : "—";
    const minMaxRtt = metrics.minRtt != null ? `${metrics.minRtt} / ${metrics.maxRtt} ms` : "—";
    const geoSpan = metrics.totalGeoSpanKm > 0 ? `~${metrics.totalGeoSpanKm.toLocaleString()} km` : "—";

    this.summaryEl.innerHTML = `
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-label">DESTINATION RTT</span>
          <span class="metric-value ${destTier}">${destRtt}</span>
          <span class="metric-sub">Final responding hop</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">TOTAL / GEO HOPS</span>
          <span class="metric-value amber">${metrics.totalHops} <span class="metric-sub-num">(${metrics.geolocatedCount} located)</span></span>
          <span class="metric-sub">${metrics.timedOutCount} timed out (${metrics.timeoutRate}%)</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">AVG / MIN-MAX RTT</span>
          <span class="metric-value">${avgRtt}</span>
          <span class="metric-sub">Range: ${minMaxRtt}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">APPROX. GEO SPAN</span>
          <span class="metric-value">${geoSpan}</span>
          <span class="metric-sub">Haversine between hops</span>
        </div>
      </div>
    `;
  }

  renderTierDistribution(dist, total) {
    if (!this.tierDistEl || !total) return;

    const lowPct = Math.round((dist.low / total) * 100);
    const medPct = Math.round((dist.medium / total) * 100);
    const highPct = Math.round((dist.high / total) * 100);
    const timeoutPct = Math.round((dist.timeout / total) * 100);

    this.tierDistEl.innerHTML = `
      <div class="tier-dist-header">
        <span class="dist-title">LATENCY TIER COMPOSITION</span>
        <span class="dist-total">${total} total hops</span>
      </div>
      <div class="tier-bar-track">
        ${lowPct > 0 ? `<div class="tier-bar-seg low" style="width:${lowPct}%" title="Low (<50ms): ${dist.low} hops (${lowPct}%)"></div>` : ""}
        ${medPct > 0 ? `<div class="tier-bar-seg medium" style="width:${medPct}%" title="Medium (50-150ms): ${dist.medium} hops (${medPct}%)"></div>` : ""}
        ${highPct > 0 ? `<div class="tier-bar-seg high" style="width:${highPct}%" title="High (>150ms): ${dist.high} hops (${highPct}%)"></div>` : ""}
        ${timeoutPct > 0 ? `<div class="tier-bar-seg timeout" style="width:${timeoutPct}%" title="Timeout: ${dist.timeout} hops (${timeoutPct}%)"></div>` : ""}
      </div>
      <div class="tier-dist-legend">
        <span class="dist-tag low"><span class="dot"></span> &lt;50ms (${dist.low})</span>
        <span class="dist-tag medium"><span class="dot"></span> 50-150ms (${dist.medium})</span>
        <span class="dist-tag high"><span class="dot"></span> &gt;150ms (${dist.high})</span>
        ${dist.timeout > 0 ? `<span class="dist-tag timeout"><span class="dot"></span> Timeout (${dist.timeout})</span>` : ""}
      </div>
    `;
  }

  renderHopRttBars(hops, maxRtt) {
    if (!this.rttChartEl) return;
    if (!hops || hops.length === 0) {
      this.rttChartEl.innerHTML = '<div class="chart-empty">Awaiting trace telemetry…</div>';
      return;
    }

    const maxScale = Math.max(50, Math.ceil((maxRtt || 50) / 25) * 25);
    const rowsHtml = hops
      .map((hop, i) => {
        const tier = latencyTier(hop.rttMs);
        const rttVal = hop.rttMs != null ? `${hop.rttMs} ms` : "timeout";
        const widthPct = hop.rttMs != null ? Math.max(2, Math.min(100, (hop.rttMs / maxScale) * 100)) : 0;
        const prevHop = i > 0 ? hops[i - 1] : null;
        let deltaHtml = "";

        if (hop.rttMs != null && prevHop && prevHop.rttMs != null) {
          const delta = Math.round((hop.rttMs - prevHop.rttMs) * 10) / 10;
          if (delta > 5) {
            deltaHtml = `<span class="hop-delta jump">+${delta} ms</span>`;
          } else if (delta < -5) {
            deltaHtml = `<span class="hop-delta drop">${delta} ms</span>`;
          }
        }

        const locationStr = hop.geo ? `${hop.geo.city || ""}` : hop.ip || "timeout";

        return `
          <div class="hop-bar-row">
            <span class="hop-bar-num">#${hop.hopIndex}</span>
            <div class="hop-bar-track-wrap">
              <div class="hop-bar-fill ${tier}" style="width: ${widthPct}%"></div>
              <span class="hop-bar-val ${tier}">${rttVal}</span>
              ${deltaHtml}
            </div>
            <span class="hop-bar-loc" title="${hop.ip ?? ""}">${locationStr}</span>
          </div>
        `;
      })
      .join("");

    this.rttChartEl.innerHTML = `
      <div class="hop-bars-container">
        <div class="hop-bars-header">
          <span>HOP LATENCY PROFILE</span>
          <span class="scale-label">Scale: 0 – ${maxScale} ms</span>
        </div>
        <div class="hop-bars-list">
          ${rowsHtml}
        </div>
      </div>
    `;
  }

  renderLatencyOverTime() {
    if (!this.timeSeriesEl) return;
    const seriesEntries = [...this.history.entries()].filter(([_, pts]) => pts.length > 0);

    if (seriesEntries.length === 0) {
      this.timeSeriesEl.innerHTML = '<div class="chart-empty">Live latency history will plot here during Live mode…</div>';
      return;
    }

    const width = 540;
    const height = 150;
    const padding = { top: 20, right: 30, bottom: 25, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Determine min/max values
    let allRtts = [];
    seriesEntries.forEach(([_, pts]) => {
      pts.forEach((p) => {
        if (p.rttMs != null) allRtts.push(p.rttMs);
      });
    });

    if (allRtts.length === 0) {
      this.timeSeriesEl.innerHTML = '<div class="chart-empty">No responding latency points recorded yet…</div>';
      return;
    }

    const minVal = Math.max(0, Math.floor(Math.min(...allRtts) * 0.8));
    const maxVal = Math.max(minVal + 20, Math.ceil(Math.max(...allRtts) * 1.15));
    const valRange = maxVal - minVal || 1;

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.classList.add("time-series-svg");

    // Gridlines & Y-Axis labels
    const gridSteps = 3;
    for (let i = 0; i <= gridSteps; i++) {
      const yVal = minVal + (valRange / gridSteps) * i;
      const y = height - padding.bottom - (i / gridSteps) * chartH;

      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", padding.left);
      line.setAttribute("y1", y);
      line.setAttribute("x2", width - padding.right);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "rgba(255, 255, 255, 0.08)");
      line.setAttribute("stroke-dasharray", "3 3");
      svg.appendChild(line);

      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", padding.left - 6);
      text.setAttribute("y", y + 4);
      text.setAttribute("text-anchor", "end");
      text.setAttribute("fill", "#8e959d");
      text.setAttribute("font-size", "10");
      text.setAttribute("font-family", "var(--font-mono)");
      text.textContent = `${Math.round(yVal)}`;
      svg.appendChild(text);
    }

    // Render lines for each target series
    seriesEntries.forEach(([_, points]) => {
      const validPoints = points.filter((p) => p.rttMs != null);
      if (validPoints.length < 1) return;

      const color = validPoints[0].color || "#22c55e";
      const stepX = validPoints.length > 1 ? chartW / (validPoints.length - 1) : chartW / 2;

      const coords = validPoints.map((p, i) => {
        const x = padding.left + (validPoints.length > 1 ? i * stepX : chartW / 2);
        const y = height - padding.bottom - ((p.rttMs - minVal) / valRange) * chartH;
        return { x, y, rttMs: p.rttMs };
      });

      // Area gradient fill
      if (coords.length > 1) {
        const areaPath = document.createElementNS(NS, "path");
        const d = `M ${coords[0].x} ${height - padding.bottom} ` +
          coords.map((c) => `L ${c.x} ${c.y}`).join(" ") +
          ` L ${coords[coords.length - 1].x} ${height - padding.bottom} Z`;
        areaPath.setAttribute("d", d);
        areaPath.setAttribute("fill", color);
        areaPath.setAttribute("fill-opacity", "0.08");
        svg.appendChild(areaPath);
      }

      // Polyline line
      const polyline = document.createElementNS(NS, "polyline");
      const ptsAttr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
      polyline.setAttribute("points", ptsAttr);
      polyline.setAttribute("fill", "none");
      polyline.setAttribute("stroke", color);
      polyline.setAttribute("stroke-width", "2");
      polyline.setAttribute("stroke-linejoin", "round");
      polyline.setAttribute("stroke-linecap", "round");
      svg.appendChild(polyline);

      // Data dots on vertices
      coords.forEach((c) => {
        const circle = document.createElementNS(NS, "circle");
        circle.setAttribute("cx", c.x);
        circle.setAttribute("cy", c.y);
        circle.setAttribute("r", "3");
        circle.setAttribute("fill", color);
        circle.setAttribute("stroke", "#0a0f1a");
        circle.setAttribute("stroke-width", "1.5");
        svg.appendChild(circle);
      });
    });

    // Legend at top right
    const legendHtml = seriesEntries
      .map(([_, pts]) => {
        const last = pts[pts.length - 1];
        const lastVal = last?.rttMs != null ? `${last.rttMs} ms` : "—";
        return `
          <span class="time-legend-tag">
            <span class="legend-swatch" style="background:${last.color}"></span>
            <span class="legend-name">${last.label}:</span>
            <span class="legend-val" style="color:${last.color}">${lastVal}</span>
          </span>
        `;
      })
      .join("");

    this.timeSeriesEl.innerHTML = `
      <div class="time-series-container">
        <div class="time-series-header">
          <span>LATENCY OVER TIME (LIVE DRIFT)</span>
          <div class="time-series-legend">${legendHtml}</div>
        </div>
        <div class="time-series-svg-wrap"></div>
      </div>
    `;

    this.timeSeriesEl.querySelector(".time-series-svg-wrap").appendChild(svg);
  }
}
