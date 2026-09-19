import { STATS } from "../data/release.js";
import { el } from "../lib/dom.js";

export function renderStatStrip(mount) {
  if (!mount) return;
  mount.replaceChildren(...STATS.map((s) => el("li", {}, [el("b", { text: s.value })])));
}
