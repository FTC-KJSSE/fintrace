import { latencyTier } from "../../lib/latency.js";
import { renderSparkline } from "../../lib/sparkline.js";
import { TIER_COLOR } from "../../lib/latency.js";

export class HopPanel {
  constructor(tableEl, titleEl) {
    this.tableEl = tableEl;
    this.titleEl = titleEl;
    this.rows = new Map(); // hopIndex -> { el, history }
  }

  reset(title) {
    this.tableEl.innerHTML = "";
    this.rows.clear();
    this.titleEl.textContent = title;
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
        <span class="hop-meta">
          <span class="hop-ip">${hop.ip ?? "* * *"}</span>
          <span class="hop-location"></span>
        </span>
        <span class="hop-rtt-wrap">
          <span class="hop-rtt"></span>
        </span>
      `;

      // Hop rows can arrive out of order — each server-side geolocation
      // lookup resolves independently (cached IPs are instant, fresh ones
      // wait in a throttled queue) — so insert by hop index rather than
      // arrival order.
      const nextSibling = [...this.tableEl.children].find(
        (child) => Number(child.dataset.hopIndex) > hop.hopIndex
      );
      this.tableEl.insertBefore(el, nextSibling ?? null);

      requestAnimationFrame(() => el.classList.add("visible"));
      entry = { el, history: [] };
      this.rows.set(hop.hopIndex, entry);
    }

    const { el, history } = entry;
    const locationEl = el.querySelector(".hop-location");
    const rttEl = el.querySelector(".hop-rtt");
    const rttWrap = el.querySelector(".hop-rtt-wrap");

    el.querySelector(".hop-ip").textContent = hop.ip ?? "* * *";
    locationEl.textContent = hop.geo ? `${hop.geo.city ?? "—"} · ${hop.geo.isp ?? ""}` : hop.timedOut ? "no response" : "—";

    rttEl.textContent = hop.rttMs != null ? `${hop.rttMs} ms` : "timeout";
    rttEl.className = `hop-rtt ${tier === "timeout" ? "timeout" : tier}`;

    if (hop.rttMs != null) {
      history.push(hop.rttMs);
      const oldSpark = rttWrap.querySelector(".hop-sparkline");
      if (oldSpark) oldSpark.remove();
      if (history.length > 1) {
        rttWrap.appendChild(renderSparkline(history, { color: TIER_COLOR[tier] }));
      }
    }
  }

  showCompareSummary(entries) {
    this.tableEl.innerHTML = entries
      .map((entry) => {
        const rttLabel = entry.rttMs != null ? `${entry.rttMs} ms` : entry.status ?? "…";
        return `
          <div class="hop-row reveal visible">
            <span class="hop-index"></span>
            <span class="hop-meta">
              <span class="hop-ip" style="color:${entry.color}">${entry.label}</span>
              <span class="hop-location">${entry.host}</span>
            </span>
            <span class="hop-rtt-wrap">
              <span class="hop-rtt" style="color:${entry.color}">${rttLabel}</span>
            </span>
          </div>
        `;
      })
      .join("");
  }
}
