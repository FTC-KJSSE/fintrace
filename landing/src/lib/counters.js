import { $$, prefersReducedMotion } from "./dom.js";

// Count numeric values up when they scroll into view. The final value is
// already rendered in the DOM, so if this never runs — reduced motion, no
// IntersectionObserver — the correct number is simply shown straight away.
export function initCounters() {
  const targets = $$("[data-count]");
  if (!targets.length) return;
  if (prefersReducedMotion || !("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        run(entry.target);
      }
    },
    { threshold: 0.5 }
  );
  targets.forEach((t) => io.observe(t));

  function run(node) {
    const to = Number(node.dataset.count);
    if (!Number.isFinite(to)) return;
    const duration = 1000;
    const start = performance.now();
    const format = (v) => Math.round(v).toLocaleString("en-US");
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      node.textContent = t < 1 ? format(to * (1 - Math.pow(1 - t, 3))) : format(to);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
