// Sticky nav: a border appears once the hero is scrolled past, and a hairline
// tracks reading progress. One passive scroll listener, rAF-throttled.
export function initNav(nav, progress) {
  if (!nav) return;
  let queued = false;

  const update = () => {
    queued = false;
    const y = window.scrollY;
    nav.classList.toggle("is-stuck", y > 40);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty("--progress", max > 0 ? String(Math.min(1, y / max)) : "0");
    }
  };

  window.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );
  update();
}
