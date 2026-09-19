// ---------------------------------------------------------------------------
// The landing page's globe.
//
// This is the application's own GlobeView (frontend/src/components/globe/globe.js)
// adapted for marketing use: same three-globe version, same earth-dark texture,
// same #38bdf8 atmosphere, same dashed animated arcs. The page shows the real
// renderer rather than a picture of it.
//
// Differences from the app: routes are driven by baked-in waypoints instead of
// a live SSE stream, rendering pauses whenever the canvas is off-screen, and
// the whole thing degrades to a still frame under prefers-reduced-motion.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import ThreeGlobe from "three-globe";

const GLOBE_IMAGE = `${import.meta.env.BASE_URL}textures/earth-dark.jpg`;
const DIM = "rgba(120, 132, 148, 0.18)";

const reduceMotion =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Rough great-circle separation in degrees, used to scale arc altitude so short
// domestic hops stay flat and transatlantic ones bow properly.
function separation(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return (2 * Math.asin(Math.sqrt(h)) * 180) / Math.PI;
}

export class LandingGlobe {
  constructor(container, options = {}) {
    const { interactive = false, autoRotateSpeed = 0.28, distance = 340 } = options;

    this.container = container;
    this.routes = new Map(); // id -> { id, color, segments: [], visible }
    this.rings = [];
    this.pins = new Map();
    this.highlighted = null;
    this.running = false;
    this.disposed = false;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2500);
    this.camera.position.set(0, 90, distance);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.enableRotate = interactive;
    this.controls.autoRotate = !reduceMotion;
    this.controls.autoRotateSpeed = autoRotateSpeed;
    this.controls.minDistance = 190;
    this.controls.maxDistance = 620;
    if (!interactive) this.renderer.domElement.style.pointerEvents = "none";

    this._initStarfield();
    this._initGlobe();
    this._initLights();

    this._onResize = () => this._resize();
    window.addEventListener("resize", this._onResize, { passive: true });

    // The panel can change height without the window resizing — switching to
    // compare mode makes the sibling panel taller, for instance — so watch the
    // container itself rather than relying on window resize events.
    if ("ResizeObserver" in window) {
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(container);
    }

    this._resize();

    // Only burn frames while the canvas is actually on screen.
    this._io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? this.resume() : this.pause()),
      { threshold: 0.01 }
    );
    this._io.observe(container);
  }

  _initStarfield() {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // Uniform points on a large shell, well outside the camera's far range.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 900 + Math.random() * 500;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0x9fb3cc, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.55 })
    );
    this.scene.add(this.stars);
  }

  _initGlobe() {
    this.globe = new ThreeGlobe()
      .globeImageUrl(GLOBE_IMAGE)
      .showAtmosphere(true)
      .atmosphereColor("#38bdf8")
      .atmosphereAltitude(0.22)
      .arcColor((d) => d.color)
      .arcAltitude((d) => d.altitude)
      .arcStroke((d) => d.stroke)
      .arcDashLength(reduceMotion ? 1 : 0.55)
      .arcDashGap(reduceMotion ? 0 : 0.14)
      .arcDashInitialGap((d) => d.initialGap ?? 0)
      .arcDashAnimateTime(reduceMotion ? 0 : (d) => d.animateTime ?? 2200)
      .pointColor((d) => d.color)
      .pointAltitude((d) => d.altitude ?? 0.015)
      .pointRadius((d) => d.radius ?? 0.6)
      .ringsData([])
      .ringColor((d) => (t) => hexToRgba(d.color, Math.max(0, 1 - t)))
      .ringMaxRadius(4.5)
      .ringPropagationSpeed(2.2)
      .ringRepeatPeriod(900);

    // Matches the app's material tuning: luminous navy-slate landmass with a
    // cool specular glint on the oceans.
    const mat = this.globe.globeMaterial();
    if (mat) {
      mat.color = new THREE.Color(0xdfe6f0);
      mat.emissive = new THREE.Color(0x16253a);
      mat.emissiveIntensity = 1.05;
      mat.specular = new THREE.Color(0x2f4466);
      mat.shininess = 22;
    }

    this.scene.add(this.globe);
  }

  _initLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x14202f, 1.7));
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.25));

    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(1.5, 1.2, 1.8);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x8fa6c0, 0.9);
    fill.position.set(-1.8, 0.6, 1.2);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rim.position.set(-1.2, -0.8, -1.6);
    this.scene.add(rim);
  }

  _resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _frame = () => {
    if (!this.running || this.disposed) return;
    this._raf = requestAnimationFrame(this._frame);
    this.controls.update();
    if (this.stars) this.stars.rotation.y += 0.00016;
    this.renderer.render(this.scene, this.camera);
  };

  resume() {
    if (this.running || this.disposed) return;
    this.running = true;
    this._resize();
    this._raf = requestAnimationFrame(this._frame);
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  // --- Route management ----------------------------------------------------

  /** Register (or replace) a route. Segments are drawn as they are added. */
  setRoute(id, color, points, { stroke = 0.7, visible = true } = {}) {
    const segments = [];
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const gap = separation(a, b);
      segments.push({
        startLat: a[0],
        startLng: a[1],
        endLat: b[0],
        endLng: b[1],
        color,
        stroke,
        altitude: Math.min(0.3, 0.035 + gap / 320),
        animateTime: 1400 + gap * 6,
      });
    }
    this.routes.set(id, { id, color, segments, shown: visible ? segments.length : 0 });
    this._syncArcs();
    return segments.length;
  }

  /** Reveal a route one hop at a time, pulsing a ring at each arrival. */
  revealRoute(id, { hopDelay = 420, onSegment } = {}) {
    const route = this.routes.get(id);
    if (!route) return Promise.resolve();
    if (reduceMotion) {
      route.shown = route.segments.length;
      this._syncArcs();
      route.segments.forEach((s, i) => onSegment?.(i, s));
      return Promise.resolve();
    }

    route.shown = 0;
    this._syncArcs();

    return new Promise((resolve) => {
      let i = 0;
      const step = () => {
        if (this.disposed || !this.routes.has(id)) return resolve();
        route.shown = i + 1;
        this._syncArcs();
        const seg = route.segments[i];
        if (seg) {
          this.pulse(seg.endLat, seg.endLng, route.color);
          onSegment?.(i, seg);
        }
        i += 1;
        if (i < route.segments.length) this._timer = setTimeout(step, hopDelay);
        else resolve();
      };
      step();
    });
  }

  removeRoute(id) {
    this.routes.delete(id);
    this._syncArcs();
  }

  clearRoutes() {
    clearTimeout(this._timer);
    this.routes.clear();
    this.highlighted = null;
    this._syncArcs();
  }

  /** Dim every route except one. Pass null to restore all of them. */
  highlight(id) {
    this.highlighted = id;
    this._syncArcs();
  }

  _syncArcs() {
    const arcs = [];
    for (const route of this.routes.values()) {
      const dimmed = this.highlighted != null && this.highlighted !== route.id;
      for (let i = 0; i < route.shown; i += 1) {
        const seg = route.segments[i];
        arcs.push({
          ...seg,
          color: dimmed ? DIM : seg.color,
          stroke: dimmed ? seg.stroke * 0.6 : seg.stroke,
        });
      }
    }
    this.globe.arcsData(arcs);
  }

  // --- Pins and rings ------------------------------------------------------

  setPin(key, lat, lon, color, { radius = 0.6, altitude = 0.015 } = {}) {
    this.pins.set(key, { lat, lng: lon, color, radius, altitude });
    this.globe.pointsData([...this.pins.values()]);
  }

  removePin(key) {
    this.pins.delete(key);
    this.globe.pointsData([...this.pins.values()]);
  }

  clearPins() {
    this.pins.clear();
    this.globe.pointsData([]);
  }

  pulse(lat, lon, color = "#22c55e", ttl = 1600) {
    if (reduceMotion) return;
    const ring = { lat, lng: lon, color };
    this.rings.push(ring);
    this.globe.ringsData([...this.rings]);
    setTimeout(() => {
      this.rings = this.rings.filter((r) => r !== ring);
      if (!this.disposed) this.globe.ringsData([...this.rings]);
    }, ttl);
  }

  // --- Camera --------------------------------------------------------------

  /**
   * Rotate the globe so a coordinate faces the camera.
   * Uses three-globe's own polar-to-cartesian convention (theta measured from
   * 90°, not from 180°) so the camera lands on the longitude it was given.
   */
  lookAt(lat, lon, distance = this.camera.position.length()) {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((90 - lon) * Math.PI) / 180;
    const target = new THREE.Vector3(
      distance * Math.sin(phi) * Math.cos(theta),
      distance * Math.cos(phi),
      distance * Math.sin(phi) * Math.sin(theta)
    );
    this._glide(target);
  }

  _glide(target, duration = 1100) {
    if (reduceMotion) {
      this.camera.position.copy(target);
      return;
    }
    const from = this.camera.position.clone();
    const start = performance.now();
    const tick = (now) => {
      if (this.disposed) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(from, target, eased);
      this.camera.lookAt(0, 0, 0);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  destroy() {
    this.disposed = true;
    this.pause();
    clearTimeout(this._timer);
    this._io?.disconnect();
    this._ro?.disconnect();
    window.removeEventListener("resize", this._onResize);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export { reduceMotion };
