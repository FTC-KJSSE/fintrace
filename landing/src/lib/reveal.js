import { $$, prefersReducedMotion } from "./dom.js";

// Staggered scroll reveal. Under reduced motion every element is simply marked
// revealed on load, so the page reads as complete with all animation stopped.
export function initReveal() {
  const targets = $$("[data-reveal]");
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    targets.forEach((t) => t.classList.add("is-revealed"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );

  for (const target of targets) {
    // Children of a [data-reveal-group] inherit an incremental delay.
    const group = target.closest("[data-reveal-group]");
    if (group) {
      const siblings = [...group.querySelectorAll("[data-reveal]")];
      target.style.setProperty("--reveal-delay", `${Math.min(siblings.indexOf(target), 8) * 55}ms`);
    }
    io.observe(target);
  }
}
