import { latencyTier, TIER_COLOR } from "../../lib/latency.js";
import { renderSparkline } from "../../lib/sparkline.js";

export const COMPARE_COLORS = [
  "#38bdf8", // 1. Sky Blue / Cyan
  "#a78bfa", // 2. Violet / Purple
  "#f472b6", // 3. Pink / Rose
  "#f0a830", // 4. Amber / Gold
  "#34d399", // 5. Emerald / Mint
  "#fb923c", // 6. Orange / Coral
];

export const MIN_COMPARE_TARGETS = 2;
export const MAX_COMPARE_TARGETS = 6;

/**
 * Validates an array of compare target IDs or hosts.
 * Enforces 2-6 target bounds and prevents duplicate selections.
 */
export function validateCompareTargets(targets) {
  if (!Array.isArray(targets)) {
    return { valid: false, error: "Targets must be an array" };
  }
  const cleanTargets = targets
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0);

  if (cleanTargets.length < MIN_COMPARE_TARGETS) {
    return {
      valid: false,
      error: `At least ${MIN_COMPARE_TARGETS} endpoints are required for comparison (received ${cleanTargets.length})`,
    };
  }
  if (cleanTargets.length > MAX_COMPARE_TARGETS) {
    return {
      valid: false,
      error: `A maximum of ${MAX_COMPARE_TARGETS} endpoints can be compared simultaneously (received ${cleanTargets.length})`,
    };
  }

  const uniqueSet = new Set(cleanTargets);
  if (uniqueSet.size !== cleanTargets.length) {
    return {
      valid: false,
      error: "Duplicate endpoints detected. Each comparison target must be unique.",
    };
  }

  return { valid: true, targets: cleanTargets };
}

/**
 * Calculates ordinal ranks for completed/active compare entries.
 * Returns a Map of entryId -> rankString ('1', '2', ..., '6').
 */
export function calculateCompareRanks(entries) {
  if (!Array.isArray(entries)) return new Map();

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

  return rankMap;
}

export function formatRankLabel(rank) {
  if (!rank) return "Evaluating…";
  if (rank === "1") return "1st (Fastest)";
  if (rank === "2") return "2nd";
  if (rank === "3") return "3rd";
  if (rank === "4") return "4th";
  if (rank === "5") return "5th";
  if (rank === "6") return "6th";
  return `#${rank}`;
}

/**
 * Builds interactive compare slot selectors (2 to 6 slots) with duplicate prevention.
 */
export function buildCompareSlots(container, endpoints, initialCount = 3) {
  if (!container || !endpoints || endpoints.length === 0) return [];

  // Seed default unique endpoints up to initialCount
  const currentSelections = [];
  for (let i = 0; i < Math.min(initialCount, endpoints.length, MAX_COMPARE_TARGETS); i++) {
    currentSelections.push(endpoints[i].id);
  }

  function syncOptionDisabledStates() {
    const selects = container.querySelectorAll(".compare-slot");
    const chosenValues = Array.from(selects).map((s) => s.value);

    selects.forEach((select) => {
      const currentVal = select.value;
      Array.from(select.options).forEach((opt) => {
        // Disable option if selected in another slot
        opt.disabled = opt.value !== currentVal && chosenValues.includes(opt.value);
      });
    });
  }

  function renderSlots() {
    container.innerHTML = "";

    const slotsRow = document.createElement("div");
    slotsRow.className = "compare-slots-row";

    currentSelections.forEach((selectedId, idx) => {
      const wrapper = document.createElement("div");
      wrapper.className = "compare-slot-wrapper";

      const select = document.createElement("select");
      select.className = "compare-slot";
      select.dataset.slot = String(idx);
      select.style.borderColor = COMPARE_COLORS[idx] || "#8e959d";

      endpoints.forEach((ep) => {
        const opt = document.createElement("option");
        opt.value = ep.id;
        opt.textContent = `${ep.label}`;
        if (ep.id === selectedId) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener("change", (e) => {
        currentSelections[idx] = e.target.value;
        syncOptionDisabledStates();
      });

      wrapper.appendChild(select);

      // Remove button if count > MIN_COMPARE_TARGETS
      if (currentSelections.length > MIN_COMPARE_TARGETS) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "slot-remove-btn";
        removeBtn.title = `Remove slot ${idx + 1}`;
        removeBtn.innerHTML = "&times;";
        removeBtn.addEventListener("click", () => {
          currentSelections.splice(idx, 1);
          renderSlots();
        });
        wrapper.appendChild(removeBtn);
      }

      slotsRow.appendChild(wrapper);
    });

    // Add Target button if count < MAX_COMPARE_TARGETS
    if (currentSelections.length < MAX_COMPARE_TARGETS && currentSelections.length < endpoints.length) {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "slot-add-btn";
      addBtn.id = "compare-add-slot-btn";
      addBtn.title = `Add target (${currentSelections.length + 1}/${MAX_COMPARE_TARGETS})`;
      addBtn.innerHTML = `<span>+ Add Target</span> <span class="slot-count-tag">${currentSelections.length}/${MAX_COMPARE_TARGETS}</span>`;
      addBtn.addEventListener("click", () => {
        // Find first endpoint not currently selected
        const nextEndpoint = endpoints.find((ep) => !currentSelections.includes(ep.id));
        if (nextEndpoint) {
          currentSelections.push(nextEndpoint.id);
          renderSlots();
        }
      });
      slotsRow.appendChild(addBtn);
    }

    container.appendChild(slotsRow);
    syncOptionDisabledStates();
  }

  renderSlots();

  // Attach helper to read current slot values
  container.getSelectedIds = () => {
    const selects = container.querySelectorAll(".compare-slot");
    return Array.from(selects).map((s) => s.value);
  };

  return Array.from(container.querySelectorAll(".compare-slot"));
}

export function renderCompareCards(container, entries) {
  if (!container) return;

  const rankMap = calculateCompareRanks(entries);

  const cardsHtml = entries
    .map((e) => {
      const rank = rankMap.get(e.id);
      const rankBadge = rank
        ? `<span class="card-rank-tag rank-${rank}">${formatRankLabel(rank)}</span>`
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
            <span class="compare-card-host" title="${e.host}">${e.host}</span>
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
    <div class="compare-cards-grid count-${entries.length}">
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
