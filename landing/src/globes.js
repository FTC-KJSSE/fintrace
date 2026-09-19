// Every Three.js import lives behind this module so the ~1.5 MB renderer is
// fetched as its own chunk after the page has painted, never before it.

import { $ } from "./lib/dom.js";
import { LandingGlobe } from "./globe/landingGlobe.js";
import { initHeroGlobe } from "./sections/hero.js";

export function initGlobes({ directory }) {
  initHeroGlobe($("#hero-globe"));

  // The directory globe is dropped below 720px rather than shrunk into
  // uselessness — the CSS hides its panel, so there is nothing to render into.
  const mount = $("#dir-globe");
  if (mount && window.matchMedia("(min-width: 721px)").matches) {
    directory?.attachGlobe(new LandingGlobe(mount, { interactive: true, autoRotateSpeed: 0.2, distance: 300 }));
  }
}
