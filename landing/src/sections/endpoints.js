import { ENDPOINTS, SOURCE, latencyTier, TIER_COLOR, routePoints } from "../data/endpoints.js";
import { el, prefersReducedMotion } from "../lib/dom.js";
import { icons } from "../lib/icons.js";

// The cards render immediately; the globe arrives later on a dynamic import,
// so this returns an `attachGlobe` hook rather than owning the renderer.
export function renderEndpointDirectory({ grid, tag, hostDemo }) {
  let globe = null;
  const cards = [];

  if (grid) {
    for (const ep of ENDPOINTS) {
      const tier = latencyTier(ep.sampleRtt);
      const card = el("article", { class: "card endpoint", "data-reveal": true, "data-id": ep.id }, [
        el("div", { class: "endpoint-top" }, [
          el("span", { class: "endpoint-label", text: ep.label }),
          el("span", { class: "endpoint-rtt" }, [
            el("span", { text: `${ep.sampleRtt}ms` }),
            el("span", { class: "dot", style: `--tier:${TIER_COLOR[tier]}` }),
          ]),
        ]),
        el("span", { class: "endpoint-type", text: ep.type }),
        el("span", { class: "endpoint-host", text: ep.host }),
      ]);

      const enter = () => {
        card.classList.add("is-hot");
        globe?.highlight(ep.id);
        if (tag) tag.textContent = ep.label;
        if (globe && !prefersReducedMotion) globe.lookAt(ep.lat, ep.lon);
      };
      const leave = () => {
        card.classList.remove("is-hot");
        globe?.highlight(null);
        if (tag) tag.textContent = "All nine routes";
      };

      card.addEventListener("pointerenter", enter);
      card.addEventListener("pointerleave", leave);
      // Keyboard parity: the same isolation is reachable by tabbing.
      card.tabIndex = 0;
      card.addEventListener("focus", enter);
      card.addEventListener("blur", leave);

      cards.push(card);
    }
    grid.replaceChildren(...cards);
  }

  if (hostDemo && !prefersReducedMotion) cycleHostDemo(hostDemo);

  return {
    attachGlobe(instance) {
      globe = instance;
      globe.setPin("source", SOURCE.lat, SOURCE.lon, "#ffc35c", { radius: 0.9, altitude: 0.02 });
      for (const ep of ENDPOINTS) {
        const color = TIER_COLOR[latencyTier(ep.sampleRtt)];
        globe.setPin(ep.id, ep.lat, ep.lon, color, { radius: 0.55 });
        globe.setRoute(ep.id, color, routePoints(ep), { stroke: 0.55 });
      }
    },
  };
}

// The custom-host field types through a few plausible targets so the
// affordance reads as an input rather than a label.
function cycleHostDemo(node) {
  const samples = ["1.1.1.1", "api.kite.trade", "8.8.8.8", "lse.co.uk", "10.0.0.1"];
  let index = 0;

  const typeOut = async (text) => {
    for (let i = 0; i <= text.length; i += 1) {
      node.textContent = text.slice(0, i);
      await wait(45);
    }
    await wait(2200);
    for (let i = text.length; i >= 0; i -= 1) {
      node.textContent = text.slice(0, i);
      await wait(22);
    }
  };

  (async function loop() {
    while (document.body.contains(node)) {
      await typeOut(samples[index % samples.length]);
      index += 1;
      await wait(300);
    }
  })();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// What was a four-card security section, reduced to four lines. The claims are
// unchanged; only the packaging is quieter.
const GUARANTEES = [
  ["Geolocation is offline", "Hops resolve against a local database. No IP is sent to a third party."],
  ["Localhost only", "The backend binds to <code>127.0.0.1</code> and is never exposed to your network."],
  ["Targets are validated", "Private ranges and reserved domains are rejected before a trace starts."],
  ["Processes are cleaned up", "Every spawned trace runs under a watchdog and is killed on exit."],
];

export function renderTrustRow(mount) {
  if (!mount) return;
  mount.replaceChildren(
    ...GUARANTEES.map(([title, body]) =>
      el("li", {}, [
        el("span", { html: icons.check(15) }),
        el("span", {}, [el("b", { text: title }), el("span", { html: body })]),
      ])
    )
  );
}
