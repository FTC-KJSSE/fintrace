import { HOPS, TRACE_TARGET, deriveRouteStats } from "../data/hops.js";
import { latencyTier, TIER_COLOR } from "../data/endpoints.js";
import { el, prefersReducedMotion } from "../lib/dom.js";

const MAX_BAR_RTT = 250;

function row(hop, isDest) {
  const tier = latencyTier(hop.rtt);
  const color = TIER_COLOR[tier];
  const timedOut = hop.rtt == null;

  const classes = ["hop-row", "is-pending"];
  if (timedOut) classes.push("is-timeout");
  if (isDest) classes.push("is-dest");

  return el("div", { class: classes.join(" "), role: "row" }, [
    el("div", { class: "col-n", role: "cell", text: String(hop.n) }),
    el("div", { class: "col-ip", role: "cell", text: timedOut ? "* * *" : hop.ip }),
    el("div", { class: "col-rtt", role: "cell", text: timedOut ? "—" : `${hop.rtt} ms` }),
    el("div", {
      class: "col-geo",
      role: "cell",
      text: hop.city ? `${hop.city}, ${hop.country}` : hop.note ?? "—",
    }),
    el("div", { class: "col-tier", role: "cell" }, [
      el("span", { class: "tier-bar" }, [
        el("span", {
          style: `--tier:${color};--fill:${timedOut ? 100 : Math.max(12, Math.min(100, (hop.rtt / MAX_BAR_RTT) * 100))}%`,
        }),
      ]),
    ]),
  ]);
}

export function renderHopTable(mount, { hostLabel, statusLabel } = {}) {
  if (!mount) return;

  if (hostLabel) hostLabel.textContent = TRACE_TARGET.host;

  const head = el("div", { class: "hop-row hop-head", role: "row" }, [
    el("div", { class: "col-n", role: "columnheader", text: "#" }),
    el("div", { class: "col-ip", role: "columnheader", text: "Address" }),
    el("div", { class: "col-rtt", role: "columnheader", text: "RTT" }),
    el("div", { class: "col-geo", role: "columnheader", text: "Location" }),
    el("div", { class: "col-tier", role: "columnheader", text: "Tier" }),
  ]);

  const rows = HOPS.map((hop, i) => row(hop, i === HOPS.length - 1));
  mount.replaceChildren(head, ...rows);

  const revealAll = () => {
    rows.forEach((r) => r.classList.remove("is-pending"));
    if (statusLabel) statusLabel.textContent = "Complete";
  };

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealAll();
    return;
  }

  // Type the trace out line by line the first time the panel scrolls in.
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      let i = 0;
      const step = () => {
        const r = rows[i];
        if (!r) {
          if (statusLabel) statusLabel.textContent = "Complete";
          return;
        }
        r.classList.remove("is-pending");
        r.classList.add("is-live");
        i += 1;
        // A timed-out hop waits out its probe, exactly as tracert does.
        setTimeout(step, HOPS[i - 1]?.rtt == null ? 900 : 220);
      };
      step();
    },
    { threshold: 0.25 }
  );
  io.observe(mount);
}

// The four derived figures, computed from the table above rather than asserted
// so the two can never disagree.
export function renderRouteStats(mount) {
  if (!mount) return;
  const s = deriveRouteStats();

  const cell = (label, value, unit) =>
    el("div", {}, [
      el("dt", { text: label }),
      el("dd", {}, [
        typeof value === "number"
          ? el("span", { "data-count": value, text: value.toLocaleString("en-US") })
          : el("span", { text: value }),
        unit ? el("span", { class: "unit", text: unit }) : null,
      ]),
    ]);

  mount.replaceChildren(
    cell("Destination RTT", s.destination, "ms"),
    cell("Total / geo hops", `${s.totalHops} / ${s.geoHops}`),
    cell("Avg RTT", s.avg, "ms"),
    cell("Approx. geo span", s.spanKm, "km")
  );
}
