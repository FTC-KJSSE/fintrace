import { latencyTier } from "../../lib/latency.js";

export class TickerBar {
  constructor(trackEl) {
    this.trackEl = trackEl;
    this.entries = new Map(); // id -> { label, rttMs }
  }

  seed(endpoints) {
    for (const ep of endpoints) {
      this.entries.set(ep.id, { label: ep.label, rttMs: null });
    }
    this._render();
  }

  update(id, label, rttMs) {
    this.entries.set(id, { label, rttMs });
    this._render();
  }

  _render() {
    const items = [...this.entries.values()];
    const html = items
      .map((item) => {
        const tier = latencyTier(item.rttMs);
        const rttLabel = item.rttMs != null ? `${item.rttMs} ms` : "—";
        const rttClass = item.rttMs != null ? tier : "pending";
        return `
          <span class="ticker-item">
            <span class="ticker-name">${item.label}</span>
            <span class="ticker-rtt ${rttClass}">${rttLabel}</span>
          </span>
          <span class="ticker-separator">◆</span>
        `;
      })
      .join("");
    // Duplicate the run so the -50% scroll animation loops seamlessly.
    this.trackEl.innerHTML = html + html;
  }
}
