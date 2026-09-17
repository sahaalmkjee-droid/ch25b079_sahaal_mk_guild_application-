// Component inspired by Kevin Levron:
// https://x.com/soju22/status/1858925191671271801

import { useEffect, useRef } from 'react';
import {
  Vector3,
  MeshPhysicalMaterial,
  InstancedMesh,
  Timer,
  AmbientLight,
  SphereGeometry,
  ShaderChunk,
  Scene,
  Color,
  Object3D,
  SRGBColorSpace,
  MathUtils,
  PMREMGenerator,
  Vector2,
  WebGLRenderer,
  PerspectiveCamera,
  PointLight,
  ACESFilmicToneMapping,
  Plane,
  Raycaster
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ─────────────────────────────────────────────
// Three.js wrapper (resize / RAF / visibility)
// ─────────────────────────────────────────────
class ThreeApp {
  constructor(opts) {
    this._opts = { ...opts };
    this._isVisible = false;
    this._isAnimating = false;
    this._resizeTimeout = null;
    this._rafId = null;
    this._clock = { elapsed: 0, delta: 0 };
    this._timer = new Timer();
    this.size = { width: 0, height: 0, wWidth: 0, wHeight: 0, ratio: 0, pixelRatio: 0 };
    this.onBeforeRender = () => {};
    this.onAfterRender = () => {};
    this.onAfterResize = () => {};
    this._boundResize = this._onResizeDebounced.bind(this);
    this._boundVisibility = this._onVisibilityChange.bind(this);
    this._initCamera();
    this._initScene();
    this._initRenderer();
    this.resize();
    this._initObservers();
    this._isVisible = true;
    this._startLoop();
  }
  _initCamera() {
    this.camera = new PerspectiveCamera();
    this.cameraFov = this.camera.fov;
    this.cameraMaxAspect = null;
  }
  _initScene() { this.scene = new Scene(); }
  _initRenderer() {
    this.canvas = this._opts.canvas;
    this.canvas.style.display = 'block';
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      powerPreference: 'high-performance',
      ...(this._opts.rendererOptions ?? {})
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
  }
  _initObservers() {
    if (!(this._opts.size instanceof Object)) {
      window.addEventListener('resize', this._boundResize);
    }
    if (this._opts.size === 'parent' && this.canvas.parentNode) {
      this._resizeObs = new ResizeObserver(this._onResizeDebounced.bind(this));
      this._resizeObs.observe(this.canvas.parentNode);
    }
    this._intersectionObs = new IntersectionObserver(
      (entries) => {
        this._isVisible = entries[0].isIntersecting;
        this._isVisible ? this._startLoop() : this._stopLoop();
      },
      { threshold: 0 }
    );
    this._intersectionObs.observe(this.canvas);
    document.addEventListener('visibilitychange', this._boundVisibility);
  }
  _removeObservers() {
    window.removeEventListener('resize', this._boundResize);
    this._resizeObs?.disconnect();
    this._intersectionObs?.disconnect();
    document.removeEventListener('visibilitychange', this._boundVisibility);
  }
  _onVisibilityChange() {
    if (this._isVisible) { document.hidden ? this._stopLoop() : this._startLoop(); }
  }
  _onResizeDebounced() {
    if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
    this._resizeTimeout = setTimeout(() => this.resize(), 100);
  }
  resize() {
    let w, h;
    if (this._opts.size instanceof Object) {
      w = this._opts.size.width; h = this._opts.size.height;
    } else if (this._opts.size === 'parent' && this.canvas.parentNode) {
      w = this.canvas.parentNode.offsetWidth;
      h = this.canvas.parentNode.offsetHeight;
    } else {
      w = window.innerWidth; h = window.innerHeight;
    }
    this.size.width = w; this.size.height = h; this.size.ratio = w / h;
    this._updateCamera(); this._updateRendererSize(); this.onAfterResize(this.size);
  }
  _updateCamera() {
    this.camera.aspect = this.size.width / this.size.height;
    if (this.cameraMaxAspect && this.camera.aspect > this.cameraMaxAspect) {
      const tan = Math.tan(MathUtils.degToRad(this.cameraFov / 2)) / (this.camera.aspect / this.cameraMaxAspect);
      this.camera.fov = 2 * MathUtils.radToDeg(Math.atan(tan));
    } else {
      this.camera.fov = this.cameraFov;
    }
    this.camera.updateProjectionMatrix();
    const fovRad = (this.camera.fov * Math.PI) / 180;
    this.size.wHeight = 2 * Math.tan(fovRad / 2) * this.camera.position.length();
    this.size.wWidth = this.size.wHeight * this.camera.aspect;
  }
  _updateRendererSize() {
    this.renderer.setSize(this.size.width, this.size.height);
    // Cap DPR at 2 — going beyond 2 (e.g. 3× on some phones) gives
    // diminishing visual returns but massively increases GPU fill rate.
    let dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr);
    this.size.pixelRatio = dpr;
  }
  _startLoop() {
    if (this._isAnimating) return;
    this._isAnimating = true;
    this._timer.reset();
    const loop = () => {
      this._rafId = requestAnimationFrame(loop);
      this._timer.update();
      this._clock.delta = this._timer.getDelta();
      this._clock.elapsed += this._clock.delta;
      this.onBeforeRender(this._clock);
      this.renderer.render(this.scene, this.camera);
      this.onAfterRender(this._clock);
    };
    loop();
  }
  _stopLoop() {
    if (this._isAnimating) { cancelAnimationFrame(this._rafId); this._isAnimating = false; }
  }
  clear() {
    this.scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        Object.values(obj.material).forEach((v) => { if (v && typeof v.dispose === 'function') v.dispose(); });
        obj.material.dispose(); obj.geometry.dispose();
      }
    });
    this.scene.clear();
  }
  dispose() {
    this._removeObservers(); this._stopLoop();
    this._timer.dispose?.(); this.clear();
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}

// ─────────────────────────────────────────────
// Global pointer tracker (shared, no leaks)
// ─────────────────────────────────────────────
const _listeners = new Map();
const _cur = new Vector2();
let _attached = false;

function _updateCur(x, y) { _cur.x = x; _cur.y = y; }
function _inRect(rect) {
  return _cur.x >= rect.left && _cur.x <= rect.left + rect.width &&
         _cur.y >= rect.top  && _cur.y <= rect.top  + rect.height;
}
function _project(st, rect) {
  st.position.x = _cur.x - rect.left; st.position.y = _cur.y - rect.top;
  st.nPosition.x = (st.position.x / rect.width)  * 2 - 1;
  st.nPosition.y = (-st.position.y / rect.height) * 2 + 1;
}
function _processAll() {
  for (const [el, st] of _listeners) {
    const rect = el.getBoundingClientRect();
    if (_inRect(rect)) {
      _project(st, rect);
      if (!st.hover) { st.hover = true; st.onEnter(st); }
      st.onMove(st);
    } else if (st.hover && !st.touching) { st.hover = false; st.onLeave(st); }
  }
}
function _onPM(e) { _updateCur(e.clientX, e.clientY); _processAll(); }
function _onPL() { for (const st of _listeners.values()) { if (st.hover) { st.hover = false; st.onLeave(st); } } }
function _onCk(e) {
  _updateCur(e.clientX, e.clientY);
  for (const [el, st] of _listeners) { _project(st, el.getBoundingClientRect()); if (_inRect(el.getBoundingClientRect())) st.onClick(st); }
}
function _onTS(e) {
  if (!e.touches.length) return; e.preventDefault();
  _updateCur(e.touches[0].clientX, e.touches[0].clientY);
  for (const [el, st] of _listeners) {
    const rect = el.getBoundingClientRect();
    if (_inRect(rect)) { st.touching = true; _project(st, rect); if (!st.hover) { st.hover = true; st.onEnter(st); } st.onMove(st); }
  }
}
function _onTM(e) {
  if (!e.touches.length) return; e.preventDefault();
  _updateCur(e.touches[0].clientX, e.touches[0].clientY);
  for (const [el, st] of _listeners) {
    const rect = el.getBoundingClientRect(); _project(st, rect);
    if (_inRect(rect)) { if (!st.hover) { st.hover = true; st.touching = true; st.onEnter(st); } st.onMove(st); }
    else if (st.hover && st.touching) { st.onMove(st); }
  }
}
function _onTE() {
  for (const st of _listeners.values()) { if (st.touching) { st.touching = false; if (st.hover) { st.hover = false; st.onLeave(st); } } }
}
function createPointerTracker({ domElement, onEnter, onMove, onLeave, onClick }) {
  const st = {
    position: new Vector2(), nPosition: new Vector2(),
    hover: false, touching: false,
    onEnter: onEnter ?? (() => {}), onMove: onMove ?? (() => {}),
    onLeave: onLeave ?? (() => {}), onClick: onClick ?? (() => {})
  };
  _listeners.set(domElement, st);
  if (!_attached) {
    document.body.addEventListener('pointermove', _onPM);
    document.body.addEventListener('pointerleave', _onPL);
    document.body.addEventListener('click', _onCk);
    document.body.addEventListener('touchstart', _onTS, { passive: false });
    document.body.addEventListener('touchmove',  _onTM, { passive: false });
    document.body.addEventListener('touchend',   _onTE, { passive: false });
    document.body.addEventListener('touchcancel',_onTE, { passive: false });
    _attached = true;
  }
  st.dispose = () => {
    _listeners.delete(domElement);
    if (_listeners.size === 0) {
      document.body.removeEventListener('pointermove', _onPM);
      document.body.removeEventListener('pointerleave', _onPL);
      document.body.removeEventListener('click', _onCk);
      document.body.removeEventListener('touchstart', _onTS);
      document.body.removeEventListener('touchmove',  _onTM);
      document.body.removeEventListener('touchend',   _onTE);
      document.body.removeEventListener('touchcancel',_onTE);
      _attached = false;
    }
  };
  return st;
}

// ─────────────────────────────────────────────
// Physics
// ─────────────────────────────────────────────
const { randFloat, randFloatSpread } = MathUtils;
const _pA = new Vector3(), _pB = new Vector3(), _pC = new Vector3();
const _vA = new Vector3(), _vB = new Vector3();
const _sep = new Vector3(), _push = new Vector3(), _impA = new Vector3(), _impB = new Vector3();
const _c3 = new Vector3();

class BallPhysics {
  constructor(cfg) {
    this.config = cfg;
    this.positionData = new Float32Array(3 * cfg.count).fill(0);
    this.velocityData = new Float32Array(3 * cfg.count).fill(0);
    this.sizeData     = new Float32Array(cfg.count).fill(1);
    this.center       = new Vector3();
    this._initPositions(); this.setSizes();
  }
  _initPositions() {
    const { config: cfg, positionData: pos, velocityData: vel } = this;
    this.center.toArray(pos, 0);
    for (let i = 1; i < cfg.count; i++) {
      const b = 3 * i;
      pos[b]   = randFloatSpread(2 * cfg.maxX);
      pos[b+1] = randFloatSpread(2 * cfg.maxY);
      pos[b+2] = randFloatSpread(2 * cfg.maxZ);
      vel[b]   = randFloatSpread(0.04);
      vel[b+1] = randFloatSpread(0.04);
      vel[b+2] = randFloatSpread(0.02);
    }
  }
  setSizes() {
    const { config: cfg, sizeData: sz } = this;
    sz[0] = cfg.size0;
    for (let i = 1; i < cfg.count; i++) sz[i] = randFloat(cfg.minSize, cfg.maxSize);
  }
  update({ delta }) {
    const { config: cfg, positionData: pos, velocityData: vel, sizeData: sz } = this;
    const start = cfg.controlSphere0 ? 1 : 0;
    if (cfg.controlSphere0) {
      _pA.fromArray(pos, 0).lerp(this.center, 0.1).toArray(pos, 0);
      _vA.set(0,0,0).toArray(vel, 0);
    }
    for (let i = start; i < cfg.count; i++) {
      const b = 3 * i;
      _pA.fromArray(pos, b); _vA.fromArray(vel, b);
      _vA.y -= delta * cfg.gravity * sz[i];
      _vA.multiplyScalar(cfg.friction).clampLength(0, cfg.maxVelocity);
      _pA.add(_vA).toArray(pos, b); _vA.toArray(vel, b);
    }
    for (let i = start; i < cfg.count; i++) {
      const bi = 3 * i; _pA.fromArray(pos, bi); _vA.fromArray(vel, bi); const ri = sz[i];
      for (let j = i + 1; j < cfg.count; j++) {
        const bj = 3 * j; _pB.fromArray(pos, bj); _vB.fromArray(vel, bj); const rj = sz[j];
        _sep.copy(_pB).sub(_pA);
        const dist = _sep.length(), sumR = ri + rj;
        if (dist < sumR) {
          const ov = sumR - dist;
          _push.copy(_sep).normalize().multiplyScalar(0.5 * ov);
          _impA.copy(_push).multiplyScalar(Math.max(_vA.length(), 1));
          _impB.copy(_push).multiplyScalar(Math.max(_vB.length(), 1));
          _pA.sub(_push); _vA.sub(_impA); _pA.toArray(pos, bi); _vA.toArray(vel, bi);
          _pB.add(_push); _vB.add(_impB); _pB.toArray(pos, bj); _vB.toArray(vel, bj);
        }
      }
      if (cfg.controlSphere0) {
        _c3.fromArray(pos, 0); _sep.copy(_c3).sub(_pA);
        const d0 = _sep.length(), sr0 = ri + sz[0];
        if (d0 < sr0) {
          const diff = sr0 - d0;
          _push.copy(_sep.normalize()).multiplyScalar(diff);
          _impA.copy(_push).multiplyScalar(Math.max(_vA.length(), 2));
          _pA.sub(_push); _vA.sub(_impA);
        }
      }
      if (Math.abs(_pA.x) + ri > cfg.maxX) { _pA.x = Math.sign(_pA.x) * (cfg.maxX - ri); _vA.x = -_vA.x * cfg.wallBounce; }
      if (Math.abs(_pA.y) + ri > cfg.maxY) { _pA.y = Math.sign(_pA.y) * (cfg.maxY - ri); _vA.y = -_vA.y * cfg.wallBounce; }
      const mb = Math.max(cfg.maxZ, cfg.maxSize);
      if (Math.abs(_pA.z) + ri > mb) { _pA.z = Math.sign(_pA.z) * (cfg.maxZ - ri); _vA.z = -_vA.z * cfg.wallBounce; }
      _pA.toArray(pos, bi); _vA.toArray(vel, bi);
    }
  }
}

// ─────────────────────────────────────────────
// SSS Material
// ─────────────────────────────────────────────
class SubsurfaceMaterial extends MeshPhysicalMaterial {
  constructor(params) {
    super(params);
    this.uniforms = {
      thicknessDistortion:  { value: 0.1 },
      thicknessAmbient:     { value: 0 },
      thicknessAttenuation: { value: 0.1 },
      thicknessPower:       { value: 2 },
      thicknessScale:       { value: 10 }
    };
    this.defines.USE_UV = '';
    this.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.fragmentShader = `
        uniform float thicknessPower;
        uniform float thicknessScale;
        uniform float thicknessDistortion;
        uniform float thicknessAmbient;
        uniform float thicknessAttenuation;
      ` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('void main() {',
        `void RE_Direct_Scattering(const in IncidentLight directLight,const in vec2 uv,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,inout ReflectedLight reflectedLight){
          vec3 sh=normalize(directLight.direction+(geometryNormal*thicknessDistortion));
          float sd=pow(saturate(dot(geometryViewDir,-sh)),thicknessPower)*thicknessScale;
          #ifdef USE_COLOR
            vec3 si=(sd+thicknessAmbient)*vColor;
          #else
            vec3 si=(sd+thicknessAmbient)*diffuse;
          #endif
          reflectedLight.directDiffuse+=si*thicknessAttenuation*directLight.color;
        }
        void main(){`
      );
      const patched = ShaderChunk.lights_fragment_begin.replaceAll(
        'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
        `RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
          RE_Direct_Scattering(directLight,vUv,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,reflectedLight);`
      );
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', patched);
    };
  }
}

// ─────────────────────────────────────────────
// Color lerper helper
// ─────────────────────────────────────────────
function buildColorLerper(colors) {
  const palette = colors.map((c) => new Color(c));
  return {
    getColorAt(ratio, out = new Color()) {
      const scaled = Math.max(0, Math.min(1, ratio)) * (colors.length - 1);
      const idx    = Math.floor(scaled);
      const start  = palette[idx];
      if (idx >= colors.length - 1) return start.clone();
      const alpha = scaled - idx;
      const end   = palette[idx + 1];
      out.r = start.r + alpha * (end.r - start.r);
      out.g = start.g + alpha * (end.g - start.g);
      out.b = start.b + alpha * (end.b - start.b);
      return out;
    }
  };
}

// ─────────────────────────────────────────────
// Default config
// ─────────────────────────────────────────────
const DEFAULT_CONFIG = {
  count: 200,
  colors: [0x4488ff, 0x2255cc, 0x66aaff],
  ambientColor: 0xffffff,
  ambientIntensity: 1,
  lightIntensity: 200,
  materialParams: { metalness: 0.5, roughness: 0.5, clearcoat: 1, clearcoatRoughness: 0.15 },
  minSize: 0.5,
  maxSize: 1,
  size0: 1,
  gravity: 0.5,
  friction: 0.9975,
  wallBounce: 0.95,
  maxVelocity: 0.15,
  maxX: 5,
  maxY: 5,
  maxZ: 2,
  controlSphere0: false,
  followCursor: true
};

// ─────────────────────────────────────────────
// InstancedMesh of spheres
// ─────────────────────────────────────────────
const _dummy = new Object3D();

class BallSpheres extends InstancedMesh {
  constructor(renderer, opts = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...opts };
    const env    = new RoomEnvironment();
    const envMap = new PMREMGenerator(renderer, 0.04).fromScene(env).texture;
    const geo = new SphereGeometry();
    const mat = new SubsurfaceMaterial({ envMap, ...cfg.materialParams });
    mat.envMapRotation.x = -Math.PI / 2;
    super(geo, mat, cfg.count);
    this.config  = cfg;
    this.physics = new BallPhysics(cfg);
    this.ambientLight = new AmbientLight(cfg.ambientColor, cfg.ambientIntensity);
    this.add(this.ambientLight);
    this.light = new PointLight(cfg.colors[0], cfg.lightIntensity);
    this.add(this.light);
    this.setColors(cfg.colors);
  }
  setColors(colors) {
    if (!Array.isArray(colors) || colors.length < 2) return;
    const lerper = buildColorLerper(colors);
    for (let i = 0; i < this.count; i++) {
      const col = lerper.getColorAt(i / this.count);
      this.setColorAt(i, col);
      if (i === 0) this.light.color.copy(col);
    }
    if (this.instanceColor) this.instanceColor.needsUpdate = true;
  }
  update(clock) {
    this.physics.update(clock);
    for (let i = 0; i < this.count; i++) {
      _dummy.position.fromArray(this.physics.positionData, 3 * i);
      _dummy.scale.setScalar(i === 0 && !this.config.followCursor ? 0 : this.physics.sizeData[i]);
      _dummy.updateMatrix();
      this.setMatrixAt(i, _dummy.matrix);
      if (i === 0) this.light.position.copy(_dummy.position);
    }
    this.instanceMatrix.needsUpdate = true;
  }
}

// ─────────────────────────────────────────────
// createBallpit factory
// ─────────────────────────────────────────────
function createBallpit(canvas, opts = {}) {
  const app = new ThreeApp({ canvas, size: 'parent', rendererOptions: { antialias: true, alpha: true } });
  app.renderer.toneMapping = ACESFilmicToneMapping;
  app.camera.position.set(0, 0, 20);
  app.camera.lookAt(0, 0, 0);
  app.cameraMaxAspect = 1.5;
  app.resize();

  let spheres;
  let paused = false;
  const raycaster = new Raycaster();
  const plane     = new Plane(new Vector3(0, 0, 1), 0);
  const hitPoint  = new Vector3();

  canvas.style.touchAction = 'none';
  canvas.style.userSelect  = 'none';

  const pointer = createPointerTracker({
    domElement: canvas,
    onMove() {
      raycaster.setFromCamera(pointer.nPosition, app.camera);
      app.camera.getWorldDirection(plane.normal);
      raycaster.ray.intersectPlane(plane, hitPoint);
      spheres.physics.center.copy(hitPoint);
      spheres.config.controlSphere0 = true;
    },
    onLeave() { spheres.config.controlSphere0 = false; }
  });

  function initialize(config) {
    if (spheres) { app.clear(); app.scene.remove(spheres); }
    spheres = new BallSpheres(app.renderer, config);
    app.scene.add(spheres);
  }

  function initialize(config) {
    if (spheres) { app.clear(); app.scene.remove(spheres); }
    spheres = new BallSpheres(app.renderer, config);
    app.scene.add(spheres);
  }

  app.onBeforeRender = (clock) => { if (!paused && spheres) spheres.update(clock); };
  app.onAfterResize  = (size)  => {
    if (spheres) {
      spheres.config.maxX = size.wWidth / 2;
      spheres.config.maxY = size.wHeight / 2;
    }
  };

  initialize(opts);
  app.resize();

  return {
    three: app,
    get spheres() { return spheres; },
    setCount(n) { initialize({ ...spheres.config, count: n }); },
    updateConfig(newProps) {
      if (newProps.count !== undefined && newProps.count !== spheres.config.count) {
        initialize({ ...spheres.config, ...newProps });
      } else {
        Object.assign(spheres.config, newProps);
        if (newProps.colors) spheres.setColors(spheres.config.colors);
        if (newProps.minSize !== undefined || newProps.maxSize !== undefined || newProps.size0 !== undefined) {
          spheres.physics.setSizes();
        }
      }
    },
    togglePause() { paused = !paused; },
    dispose() { pointer.dispose(); app.dispose(); }
  };
}

// ─────────────────────────────────────────────
// React component
// ─────────────────────────────────────────────
const Ballpit = ({ className = '', followCursor = true, ...props }) => {
  const canvasRef   = useRef(null);
  const instanceRef = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rafId = requestAnimationFrame(() => {
      instanceRef.current = createBallpit(canvas, { followCursor, ...props });
    });
    return () => {
      cancelAnimationFrame(rafId);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    instanceRef.current?.updateConfig({ followCursor, ...props });
  }, [props, followCursor]);

  return (
    <canvas
      className={className}
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

export default Ballpit;
