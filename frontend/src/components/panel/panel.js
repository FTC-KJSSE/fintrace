import { latencyTier, TIER_COLOR } from "../../lib/latency.js";
import { renderSparkline } from "../../lib/sparkline.js";
import { haversineDistanceKm } from "../../lib/geoMath.js";
import { formatCompareStatus } from "../compare/compare.js";

export class HopPanel {
  constructor(tableEl, titleEl, subtitleEl = null) {
    this.tableEl = tableEl;
    this.titleEl = titleEl;
    this.subtitleEl = subtitleEl;
    this.rows = new Map(); // hopIndex -> { el, history, hopData }
    this.lastGeoHop = null;
  }

  reset(title, subtitle = "") {
    this.tableEl.innerHTML = "";
    this.rows.clear();
    this.lastGeoHop = null;
    if (this.titleEl) this.titleEl.textContent = title;
    if (this.subtitleEl) this.subtitleEl.textContent = subtitle;
  }

  upsertHop(hop) {
    let entry = this.rows.get(hop.hopIndex);
    const tier = latencyTier(hop.rttMs);

    if (!entry) {
      const el = document.createElement("div");
      el.className = "hop-row reveal";
      el.dataset.hopIndex = String(hop.hopIndex);
      el.innerHTML = `
        <span class="hop-index">${hop.hopIndex}</span>
        <div class="hop-meta">
          <div class="hop-ip-line">
            <span class="hop-ip">${hop.ip ?? "* * *"}</span>
            <span class="hop-dist"></span>
          </div>
          <span class="hop-location"></span>
        </div>
        <div class="hop-rtt-wrap">
          <span class="hop-rtt"></span>
        </div>
      `;

      // Insert by hop index order
      const nextSibling = [...this.tableEl.children].find(
        (child) => Number(child.dataset.hopIndex) > hop.hopIndex
      );
      this.tableEl.insertBefore(el, nextSibling ?? null);

      requestAnimationFrame(() => el.classList.add("visible"));
      entry = { el, history: [], hopData: hop };
      this.rows.set(hop.hopIndex, entry);
    }

    entry.hopData = hop;
    const { el, history } = entry;
    const ipEl = el.querySelector(".hop-ip");
    const distEl = el.querySelector(".hop-dist");
    const locationEl = el.querySelector(".hop-location");
    const rttEl = el.querySelector(".hop-rtt");
    const rttWrap = el.querySelector(".hop-rtt-wrap");

    ipEl.textContent = hop.ip ?? "* * *";
    
    // Check geographic distance from previous geolocated hop
    if (hop.geo && hop.geo.lat != null && hop.geo.lon != null) {
      let prevGeo = null;
      for (let i = hop.hopIndex - 1; i >= 1; i--) {
        const prev = this.rows.get(i);
        if (prev?.hopData?.geo?.lat != null) {
          prevGeo = prev.hopData.geo;
          break;
        }
      }
      if (prevGeo) {
        const distKm = Math.round(haversineDistanceKm(prevGeo.lat, prevGeo.lon, hop.geo.lat, hop.geo.lon));
        distEl.textContent = `~${distKm.toLocaleString()} km`;
        distEl.title = `Approx. great-circle distance from Hop #${prevGeo.hopIndex ?? "prev"}`;
      } else {
        distEl.textContent = "";
      }
      locationEl.textContent = `${hop.geo.city || "—"}${hop.geo.country ? `, ${hop.geo.country}` : ""} · ${hop.geo.isp || ""}`;
    } else {
      distEl.textContent = "";
      locationEl.textContent = hop.timedOut ? "no response" : "—";
    }

    // RTT delta calculation with previous hop
    let deltaBadge = "";
    if (hop.hopIndex > 1 && hop.rttMs != null) {
      const prev = this.rows.get(hop.hopIndex - 1);
      if (prev?.hopData?.rttMs != null) {
        const delta = Math.round((hop.rttMs - prev.hopData.rttMs) * 10) / 10;
        if (delta > 10) {
          deltaBadge = ` <span class="hop-rtt-jump" title="RTT increase from previous hop">+${delta}ms</span>`;
        }
      }
    }

    rttEl.innerHTML = hop.rttMs != null ? `${hop.rttMs} ms${deltaBadge}` : "timeout";
    rttEl.className = `hop-rtt ${tier === "timeout" ? "timeout" : tier}`;

    if (hop.rttMs != null) {
      history.push(hop.rttMs);
      if (history.length > 20) {
        history.shift();
      }
      const oldSpark = rttWrap.querySelector(".hop-sparkline");
      if (oldSpark) oldSpark.remove();
      if (history.length > 1) {
        rttWrap.appendChild(renderSparkline(history, { color: TIER_COLOR[tier] }));
      }
    }
  }

  showCompareSummary(entries) {
    // Sort completed entries to determine 1st, 2nd, 3rd ranking
    const sorted = [...entries].sort((a, b) => {
      if (a.rttMs == null) return 1;
      if (b.rttMs == null) return -1;
      return a.rttMs - b.rttMs;
    });

    const rankMap = new Map();
    let currentRank = 1;
    sorted.forEach((e, idx) => {
      if (e.rttMs != null) {
        if (idx > 0 && sorted[idx - 1].rttMs === e.rttMs) {
          rankMap.set(e.id, rankMap.get(sorted[idx - 1].id));
        } else {
          rankMap.set(e.id, `${currentRank}`);
          currentRank++;
        }
      }
    });

    this.tableEl.innerHTML = entries
      .map((entry) => {
        const rank = rankMap.get(entry.id);
        const rankBadge = rank ? `<span class="compare-rank-badge rank-${rank}">#${rank}</span>` : "";
        const displayStatus = formatCompareStatus(entry.status);
        const statusClass = `status-${displayStatus.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
        const statusBadge = `<span class="compare-status-badge ${statusClass}">${displayStatus}</span>`;
        const rttLabel = entry.rttMs != null ? `${entry.rttMs} ms` : (displayStatus === "WAITING" ? "—" : displayStatus);
        const tier = entry.rttMs != null ? latencyTier(entry.rttMs) : "timeout";

        return `
          <div class="hop-row compare-row reveal visible">
            <span class="hop-index">${rankBadge}</span>
            <div class="hop-meta">
              <div class="hop-ip-line">
                <span class="hop-ip" style="color:${entry.color}">${entry.label}</span>
                ${statusBadge}
              </div>
              <span class="hop-location">${entry.host}</span>
            </div>
            <div class="hop-rtt-wrap">
              <span class="hop-rtt ${tier}" style="color:${entry.color}">${rttLabel}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }
}
