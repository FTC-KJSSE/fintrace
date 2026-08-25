import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import ThreeGlobe from "three-globe";

const GLOBE_IMAGE = "/textures/earth-dark.jpg";

export class GlobeView {
  constructor(container) {
    this.container = container;
    this.arcs = [];
    this.points = new Map(); // key -> point datum, keyed by "lat,lon" to dedupe

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    this.camera.position.set(0, 0, 320);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.minDistance = 160;
    this.controls.maxDistance = 600;

    this.globe = new ThreeGlobe()
      .globeImageUrl(GLOBE_IMAGE)
      .showAtmosphere(true)
      .atmosphereColor("#f0a830")
      .atmosphereAltitude(0.18)
      .arcColor((d) => d.color)
      .arcStroke(0.5)
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashInitialGap(() => Math.random())
      .arcDashAnimateTime(2200)
      .arcAltitudeAutoScale(0.35)
      .pointColor((d) => d.color)
      .pointAltitude(0.012)
      .pointRadius(0.35);

    this.scene.add(this.globe);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(1, 1, 1);
    this.scene.add(dirLight);

    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);

    this._animate = this._animate.bind(this);
    this._animate();
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
    this.renderer.render(this.scene, this.camera);
  }

  reset() {
    this.arcs = [];
    this.points.clear();
    this.globe.arcsData(this.arcs);
    this.globe.pointsData([]);
  }

  /** Swings the camera to look at a lat/lon — arcs otherwise sit on the far
   * side of the globe from the default view and only auto-rotate into
   * sight after a couple of minutes. */
  focusOn(lat, lon) {
    // A live trace keeps adding arcs near this point over many seconds;
    // ambient auto-rotate would slowly carry them back out of view, so a
    // real focus request turns it off for good rather than restoring it.
    this.controls.autoRotate = false;
    const dist = this.camera.position.length();
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (90 - lon) * (Math.PI / 180);
    const target = new THREE.Vector3(
      dist * Math.sin(phi) * Math.cos(theta),
      dist * Math.cos(phi),
      dist * Math.sin(phi) * Math.sin(theta)
    );
    this._animateCameraTo(target);
  }

  _animateCameraTo(targetPos, durationMs = 1400) {
    const start = this.camera.position.clone();
    const startTime = performance.now();
    const wasAutoRotate = this.controls.autoRotate;
    this.controls.autoRotate = false;

    const step = (now) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(start, targetPos, eased);
      this.camera.lookAt(0, 0, 0);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        this.controls.autoRotate = wasAutoRotate;
      }
    };
    requestAnimationFrame(step);
  }

  addPoint(lat, lon, color, key = `${lat},${lon}`) {
    if (this.points.has(key)) return;
    this.points.set(key, { lat, lng: lon, color });
    this.globe.pointsData([...this.points.values()]);
  }

  addArc(from, to, color) {
    this.arcs.push({
      startLat: from.lat,
      startLng: from.lon,
      endLat: to.lat,
      endLng: to.lon,
      color,
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
