import { ENDPOINTS, latencyTier, TIER_COLOR } from "../data/endpoints.js";
import { el, prefersReducedMotion } from "../lib/dom.js";

// The ticker duplicates its item list so the CSS translate(-50%) loop is
// seamless. RTT values drift by a few milliseconds on a slow interval, the way
// the app's own strip does when a live trace is running.
export function initTicker(track) {
  if (!track) return;

  const state = ENDPOINTS.map((e) => ({ ...e, rtt: e.sampleRtt }));

  const render = () => {
    track.replaceChildren();
    for (let pass = 0; pass < 2; pass += 1) {
      for (const item of state) {
        const tier = latencyTier(item.rtt);
        track.append(
          el("span", { class: "ticker-item" }, [
            el("b", { text: item.label }),
            el("span", { class: "rtt", text: `${item.rtt}ms` }),
            el("span", { class: "dot", style: `--tier:${TIER_COLOR[tier]}` }),
          ])
        );
      }
    }
  };

  render();
  if (prefersReducedMotion) return;

  // Jitter within a plausible band around the sample value, never below 1ms.
  setInterval(() => {
    for (const item of state) {
      const drift = Math.round((Math.random() - 0.5) * Math.max(2, item.sampleRtt * 0.12));
      item.rtt = Math.max(1, item.sampleRtt + drift);
    }
    render();
  }, 3200);
}
