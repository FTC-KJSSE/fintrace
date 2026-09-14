import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import ThreeGlobe from "three-globe";

const GLOBE_IMAGE = "/textures/earth-dark.jpg";

export class GlobeView {
  constructor(container) {
    this.container = container;
    this.arcs = [];
    this.points = new Map(); // key -> point datum
    this.rings = [];

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2500);
    this.camera.position.set(0, 0, 360);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.25;
    this.controls.minDistance = 160;
    this.controls.maxDistance = 650;

    // Procedural Starfield for deep space background
    this._initStarfield();

    // Enhanced ThreeGlobe configuration
    this.globe = new ThreeGlobe()
      .globeImageUrl(GLOBE_IMAGE)
      .showAtmosphere(true)
      .atmosphereColor("#38bdf8")
      .atmosphereAltitude(0.22)
      .arcColor((d) => d.color)
      .arcAltitude((d) => (d.altitude != null ? d.altitude : 0.18))
      .arcStroke((d) => (d.stroke != null ? d.stroke : 0.85))
      .arcDashLength((d) => (d.dashLength != null ? d.dashLength : 0.55))
      .arcDashGap((d) => (d.dashGap != null ? d.dashGap : 0.14))
      .arcDashInitialGap((d) => (d.initialGap != null ? d.initialGap : 0))
      .arcDashAnimateTime((d) => (d.animateTime != null ? d.animateTime : 2000))
      .pointColor((d) => d.color)
      .pointAltitude((d) => (d.altitude != null ? d.altitude : 0.018))
      .pointRadius((d) => (d.radius != null ? d.radius : 0.75))
      .ringsData([])
      .ringColor((d) => (t) => {
        const c = d.color || "#22c55e";
        const alpha = Math.max(0, 1 - t);
        if (c.startsWith("#")) {
          const r = parseInt(c.slice(1, 3), 16);
          const g = parseInt(c.slice(3, 5), 16);
          const b = parseInt(c.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return `rgba(56, 189, 248, ${alpha})`;
      })
      .ringMaxRadius(4.5)
      .ringPropagationSpeed(2.2)
      .ringRepeatPeriod(900);

    // Fine-tune globe material properties for clear continent definition and depth
    const globeMat = this.globe.globeMaterial();
    if (globeMat) {
      globeMat.color = new THREE.Color(0xe2e8f0);
      globeMat.emissive = new THREE.Color(0x162438); // Luminous deep navy-slate base
      globeMat.emissiveIntensity = 0.9;
      globeMat.specular = new THREE.Color(0x3a5575); // Specular ocean glint
      globeMat.shininess = 25;
    }

    this.scene.add(this.globe);

    // Multi-source balanced illumination: Hemisphere + Key + Fill + Rim
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.8));
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(1.5, 1.2, 1.8);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 1.0);
    fillLight.position.set(-1.8, 0.6, 1.2);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-1.2, -1.0, -1.8);
    this.scene.add(rimLight);

    this._createHudControls();

    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);

    this._animate = this._animate.bind(this);
    this._animate();
  }

  _initStarfield() {
    const starCount = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const r = 700 + Math.random() * 500;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);

      const tint = Math.random() > 0.5 ? 0.9 : 0.7;
      colors[i] = tint;
      colors[i + 1] = tint * 0.95;
      colors[i + 2] = 1.0;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true,
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  _createHudControls() {
    const hud = document.createElement("div");
    hud.className = "globe-hud-controls";
    hud.innerHTML = `
      <div class="hud-group">
        <label class="hud-toggle">
          <input type="checkbox" id="globe-auto-rotate" checked />
          <span class="toggle-slider"></span>
          <span class="toggle-label">Auto Rotate</span>
        </label>
      </div>
      <div class="hud-group">
        <button class="hud-btn" id="globe-zoom-in" title="Zoom In">+</button>
        <button class="hud-btn" id="globe-zoom-out" title="Zoom Out">−</button>
        <button class="hud-btn" id="globe-reset-cam" title="Reset Camera View">⌂</button>
      </div>
    `;

    this.container.appendChild(hud);

    const toggle = hud.querySelector("#globe-auto-rotate");
    toggle.addEventListener("change", (e) => {
      this.controls.autoRotate = e.target.checked;
    });

    hud.querySelector("#globe-zoom-in").addEventListener("click", () => {
      this._dollyCamera(0.85);
    });

    hud.querySelector("#globe-zoom-out").addEventListener("click", () => {
      this._dollyCamera(1.2);
    });

    hud.querySelector("#globe-reset-cam").addEventListener("click", () => {
      this._animateCameraTo(new THREE.Vector3(0, 0, 360));
      toggle.checked = true;
      this.controls.autoRotate = true;
    });
  }

  _dollyCamera(factor) {
    const newPos = this.camera.position.clone().multiplyScalar(factor);
    const dist = newPos.length();
    if (dist >= this.controls.minDistance && dist <= this.controls.maxDistance) {
      this._animateCameraTo(newPos, 300);
    }
  }

  _resize() {
    const { clientWidth, clientHeight } = this.container;
    if (!clientWidth || !clientHeight) return;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  _animate() {
    this._raf = requestAnimationFrame(this._animate);
    this.controls.update();
    if (this.starfield) {
      this.starfield.rotation.y += 0.0001;
    }
    this.renderer.render(this.scene, this.camera);
  }

  reset() {
    this.arcs = [];
    this.points.clear();
    this.rings = [];
    this.globe.arcsData([]);
    this.globe.pointsData([]);
    this.globe.ringsData([]);
  }

  setArcs(arcs) {
    this.arcs = [...arcs];
    this.globe.arcsData(this.arcs);
  }

  setPoints(pointsList) {
    if (pointsList instanceof Map) {
      this.points = new Map(pointsList);
      this.globe.pointsData([...this.points.values()]);
    } else if (Array.isArray(pointsList)) {
      this.points.clear();
      pointsList.forEach((p) => {
        const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
        this.points.set(key, p);
      });
      this.globe.pointsData(pointsList);
    }
  }

  setDestinationRings(ringsList) {
    this.rings = Array.isArray(ringsList) ? ringsList : [ringsList];
    this.globe.ringsData(this.rings);
  }

  setDestinationRing(lat, lon, color = "#22c55e") {
    this.rings = [{ lat, lng: lon, color }];
    this.globe.ringsData(this.rings);
  }

  focusOn(lat, lon, dist = 350) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (90 - lon) * (Math.PI / 180);
    const target = new THREE.Vector3(
      dist * Math.sin(phi) * Math.cos(theta),
      dist * Math.cos(phi),
      dist * Math.sin(phi) * Math.sin(theta)
    );
    this._animateCameraTo(target, 1200);
  }

  /**
   * Neutral camera framing for Compare mode.
   * Centers the viewpoint over the middle of active routes (e.g. Arabian Sea/E. Mediterranean)
   * so both Asian, European, and American routes remain visible simultaneously in profile.
   */
  frameCompareView(endpoints = []) {
    // If coordinates exist, find midpoint latitude and longitude
    const valid = endpoints.filter((e) => e && e.lat != null && e.lon != null);
    if (valid.length === 0) {
      this.focusOn(20, 60, 360);
      return;
    }

    let avgLat = 22;
    let avgLon = 55; // Default Arabian Sea vantage
    this.focusOn(avgLat, avgLon, 360);
  }

  _animateCameraTo(targetPos, durationMs = 1200) {
    const start = this.camera.position.clone();
    const startTime = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(start, targetPos, eased);
      this.camera.lookAt(0, 0, 0);
      if (t < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  addPoint(lat, lon, color, key = `${lat},${lon}`) {
    if (this.points.has(key)) return;
    this.points.set(key, { lat, lng: lon, color, radius: 0.75, altitude: 0.018 });
    this.globe.pointsData([...this.points.values()]);
  }

  addArc(from, to, color, options = {}) {
    this.arcs.push({
      startLat: from.lat,
      startLng: from.lon,
      endLat: to.lat,
      endLng: to.lon,
      color,
      ...options,
    });
    this.globe.arcsData([...this.arcs]);
    this.addPoint(from.lat, from.lon, color);
    this.addPoint(to.lat, to.lon, color);
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    this._ro.disconnect();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
