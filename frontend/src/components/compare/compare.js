import { latencyTier, TIER_COLOR } from "../../lib/latency.js";
import { renderSparkline } from "../../lib/sparkline.js";

export const COMPARE_COLORS = ["#38bdf8", "#a78bfa", "#f472b6"];

export function buildCompareSlots(container, endpoints) {
  container.innerHTML = "";
  const selects = [];

  for (let i = 0; i < 3; i++) {
    const select = document.createElement("select");
    select.className = "compare-slot";
    select.dataset.slot = String(i);
    select.style.borderColor = COMPARE_COLORS[i];

    for (const ep of endpoints) {
      const option = document.createElement("option");
      option.value = ep.id;
      option.textContent = ep.label;
      select.appendChild(option);
    }
    select.selectedIndex = Math.min(i, endpoints.length - 1);

    container.appendChild(select);
    selects.push(select);
  }

  return selects;
}

export function renderCompareCards(container, entries) {
  if (!container) return;

  // Rank entries with valid RTTs
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

  const cardsHtml = entries
    .map((e) => {
      const rank = rankMap.get(e.id);
      const rankBadge = rank
        ? `<span class="card-rank-tag rank-${rank}">${rank === "1" ? "1st (Fastest)" : rank === "2" ? "2nd" : "3rd"}</span>`
        : `<span class="card-rank-tag pending">Evaluating…</span>`;
      const rttText = e.rttMs != null ? `${e.rttMs} ms` : e.status ?? "…";
      const tier = e.rttMs != null ? latencyTier(e.rttMs) : "timeout";

      return `
        <div class="compare-card" style="border-top: 3px solid ${e.color}">
          <div class="compare-card-header">
            <span class="compare-card-label" style="color: ${e.color}">${e.label}</span>
            ${rankBadge}
          </div>
          <div class="compare-card-body">
            <span class="compare-card-rtt ${tier}">${rttText}</span>
            <span class="compare-card-host">${e.host}</span>
          </div>
          <div class="compare-card-spark-wrap" id="compare-spark-${e.id}">
            <!-- sparkline rendered dynamically -->
          </div>
          <div class="compare-card-footer">
            <span>Hops: ${e.hopCount ?? 0}</span>
            <span>Status: ${e.status ?? "idle"}</span>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="compare-cards-grid">
      ${cardsHtml}
    </div>
  `;

  // Render sparklines for entries with history
  entries.forEach((e) => {
    if (e.history && e.history.length > 1) {
      const sparkWrap = container.querySelector(`#compare-spark-${e.id}`);
      if (sparkWrap) {
        sparkWrap.innerHTML = "";
        sparkWrap.appendChild(renderSparkline(e.history, { color: e.color, width: 140, height: 24 }));
      }
    }
  });
}
