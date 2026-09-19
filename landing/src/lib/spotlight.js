import { prefersReducedMotion } from "./dom.js";

// Cursor-tracking card highlight. A single delegated pointermove writes --mx
// and --my onto the hovered card; the CSS does the rest. One listener for the
// whole page, and nothing at all on touch or under reduced motion.
export function initSpotlight(root = document) {
  if (prefersReducedMotion || !matchMedia("(hover: hover)").matches) return;

  let frame = 0;
  let pending = null;

  root.addEventListener(
    "pointermove",
    (event) => {
      const card = event.target.closest?.(".card");
      if (!card) return;
      pending = { card, x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!pending) return;
        const { card: c, x, y } = pending;
        const rect = c.getBoundingClientRect();
        c.style.setProperty("--mx", `${x - rect.left}px`);
        c.style.setProperty("--my", `${y - rect.top}px`);
      });
    },
    { passive: true }
  );
}
