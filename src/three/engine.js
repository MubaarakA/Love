import * as THREE from 'three';
import gsap from 'gsap';
import { detectQuality } from './quality';
import { createPetalGeometry } from './geometries';
import { createDustMaterial, createBokehMaterial, createSparkMaterial } from './materials';

const CAM_Z = 12;
const FOV = 45;
const TAN_HALF = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const sign = () => (Math.random() < 0.5 ? -1 : 1);
const palette = (list) => list.map((c) => new THREE.Color(c));

// Muted, filmic tones: dusty rose, ivory and a little deep crimson.
const PETAL_COLORS = palette(['#e3aab3', '#d4919c', '#f1d8d2', '#c47482', '#f5e6df', '#b45a6a', '#e8c0b6', '#dca0a4']);
const SPARK_COLORS = palette(['#fff4e6', '#ffe2c6', '#ffd4d8', '#ffffff', '#ffc9b5']);
const RED_SPARKS = palette(['#ff5a64', '#ff8a8a', '#ffd0d0', '#ffffff', '#e8323f']);
const DUST_COLORS = palette(['#ffeedd', '#ffd9cc', '#ffffff', '#f5c7c0', '#ffd7a8']);
const BOKEH_COLORS = palette(['#ffe6d8', '#ffc4bd', '#f1cdbd', '#e6727c', '#b8323f']);

/**
 * Each stage of the story has a mood. Values are tweened, never snapped, so
 * stages melt into each other. `ambient` is a fraction of the device budget;
 * `speed` time-scales all petal and dust motion; `gather` pulls everything
 * into a vortex at the centre; `glow` is a warm light at the centre.
 */
const MOODS = {
  gift: { dust: 0.4, bokeh: 0.18, ambient: 0.2, speed: 0.8, gather: 0, boost: 0, glow: 0.14, light: 0.9, heroRate: 0 },
  flood: { dust: 0.85, bokeh: 0.35, ambient: 2.2, speed: 1.25, gather: 0, boost: 0.5, glow: 0.35, light: 1.15, heroRate: 0.6 },
  intro: { dust: 0.55, bokeh: 0.22, ambient: 0.75, speed: 1, gather: 0, boost: 0, glow: 0.08, light: 0.9, heroRate: 0.07 },
  confirm: { dust: 0.38, bokeh: 0.16, ambient: 0.5, speed: 0.9, gather: 0, boost: 0, glow: 0.04, light: 0.7, heroRate: 0 },
  transition: { dust: 1, bokeh: 0.08, ambient: 1, speed: 3.2, gather: 0.85, boost: 1, glow: 0.5, light: 1.1, heroRate: 0 },
  afterglow: { dust: 0.42, bokeh: 0.1, ambient: 0.45, speed: 1.1, gather: 0, boost: 0.25, glow: 0.12, light: 0.8, heroRate: 0 },
  loading: { dust: 0.5, bokeh: 0.32, ambient: 0.35, speed: 0.75, gather: 0, boost: 0.15, glow: 0.05, light: 0.65, heroRate: 0 },
  gifts: { dust: 0.45, bokeh: 0.22, ambient: 0.5, speed: 0.6, gather: 0, boost: 0, glow: 0.2, light: 1, heroRate: 0.05 },
  ending: { dust: 0.45, bokeh: 0.2, ambient: 0.4, speed: 0.55, gather: 0, boost: 0, glow: 0.22, light: 1, heroRate: 0.05 },
};

const REST = { dust: 0, bokeh: 0, ambient: 0, speed: 1, gather: 0, boost: 0, glow: 0, light: 0.8, heroRate: 0 };

// ---------------------------------------------------------------------------
// Sparkle pool: structure-of-arrays, swap-remove, one draw call.
// ---------------------------------------------------------------------------
class SparkPool {
  constructor(capacity, material) {
    this.cap = capacity;
    this.count = 0;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.base = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);

    const g = new THREE.BufferGeometry();
    const dyn = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    this.attrs = {
      position: dyn(this.pos, 3),
      aColor: dyn(this.col, 3),
      aSize: dyn(this.size, 1),
      aAlpha: dyn(this.alpha, 1),
    };
    Object.entries(this.attrs).forEach(([k, a]) => g.setAttribute(k, a));
    g.setDrawRange(0, 0);
    this.points = new THREE.Points(g, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  emit(x, y, z, vx, vy, vz, life, size, color, drag = 1.6, grav = 0) {
    if (this.count >= this.cap) return;
    const i = this.count++;
    const i3 = i * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = z;
    this.vel[i3] = vx;
    this.vel[i3 + 1] = vy;
    this.vel[i3 + 2] = vz;
    this.col[i3] = color.r;
    this.col[i3 + 1] = color.g;
    this.col[i3 + 2] = color.b;
    this.life[i] = this.maxLife[i] = life;
    this.base[i] = size;
    this.size[i] = 0;
    this.alpha[i] = 0;
    this.drag[i] = drag;
    this.grav[i] = grav;
  }

  kill(i) {
    const last = --this.count;
    if (i === last) return;
    const i3 = i * 3;
    const l3 = last * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[i3 + k] = this.pos[l3 + k];
      this.vel[i3 + k] = this.vel[l3 + k];
      this.col[i3 + k] = this.col[l3 + k];
    }
    this.size[i] = this.size[last];
    this.alpha[i] = this.alpha[last];
    this.base[i] = this.base[last];
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.drag[i] = this.drag[last];
    this.grav[i] = this.grav[last];
  }

  clear() {
    this.count = 0;
    this.update(0);
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.kill(i);
        continue;
      }
      const i3 = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt;
      this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 10) * (1 - t * t);
      this.size[i] = this.base[i] * (1 - t * 0.45);
      i++;
    }
    this.points.geometry.setDrawRange(0, this.count);
    if (this.count > 0 || this.wasActive) {
      for (const a of Object.values(this.attrs)) a.needsUpdate = true;
    }
    this.wasActive = this.count > 0;
  }
}

// ---------------------------------------------------------------------------
// Instanced petal pool. Live items stay contiguous so mesh.count is exact.
// ---------------------------------------------------------------------------
function makeItem() {
  return {
    kind: '',
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    axis: new THREE.Vector3(0, 1, 0),
    color: new THREE.Color(),
  };
}

function resetItem(p) {
  p.age = 0;
  p.life = Infinity;
  p.fadeIn = 0.6;
  p.s = 0;
  p.size = 0.25;
  p.k = 0.8;
  p.fall = 0.6;
  p.drift = 0;
  p.vzT = 0;
  p.swayAmp = 0.6;
  p.swayFreq = 1;
  p.phase = Math.random() * Math.PI * 2;
  p.spin = 1;
  p.spinBase = 1;
  p.vel.set(0, 0, 0);
  p.axis.randomDirection();
  p.quat.random();
  return p;
}

class InstancedPool {
  constructor(geometry, material, capacity) {
    this.cap = capacity;
    this.items = [];
    this.free = [];
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this._m = new THREE.Matrix4();
    this._s = new THREE.Vector3();
  }

  acquire(kind) {
    if (this.items.length >= this.cap) return null;
    const p = resetItem(this.free.pop() || makeItem());
    p.kind = kind;
    this.items.push(p);
    return p;
  }

  release(i) {
    const p = this.items[i];
    const last = this.items.pop();
    if (p !== last) this.items[i] = last;
    this.free.push(p);
    return p;
  }

  clear() {
    while (this.items.length) this.free.push(this.items.pop());
    this.commit();
  }

  commit() {
    const { items, mesh } = this;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      this._m.compose(p.pos, p.quat, this._s.setScalar(Math.max(p.s, 0.0001)));
      mesh.setMatrixAt(i, this._m);
      mesh.setColorAt(i, p.color);
    }
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------
export class MemoryEngine {
  constructor(container) {
    this.container = container;
    this.q = detectQuality();
    this.motion = this.q.reduced ? 0.55 : 1; // reduced motion: everything drifts slower
    this.budget = 1; // scaled down if frame times are poor
    this.time = 0;
    this.flow = 0; // time-scaled clock that drives drifting motion
    this.anims = [];
    this.ambientCount = 0;
    this.suspended = false;
    this.state = { ...REST };

    this.pointer = { nx: 0, ny: 0, has: false };
    this.ray = new THREE.Raycaster().ray;
    this._ndc = new THREE.Vector2();
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    this._q = new THREE.Quaternion();

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'scene-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.q.antialias,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(this.q.dpr);
    this.dpr = this.q.dpr;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);
    this.camera.position.set(0, 0, CAM_Z);

    this.buildLights();
    this.buildDust();
    this.buildBokeh();
    this.buildPetals();

    this.resize();
    this.bind();
    this.start();
  }

  // ---- construction -------------------------------------------------------

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffe8e2, 0x1a0a10, 1.4);
    this.key = new THREE.DirectionalLight(0xffe2d0, 1.3);
    this.key.position.set(-4, 6, 8);
    this.rim = new THREE.DirectionalLight(0xff9fb0, 0.8);
    this.rim.position.set(5, -3, -4);
    this.glowLight = new THREE.PointLight(0xffc7b0, 0, 16, 1.6);
    this.glowLight.position.set(0, 0, 3);
    this.scene.add(this.hemi, this.key, this.rim, this.glowLight);
  }

  buildPoints(n, material, place, renderOrder, colors) {
    const pos = new Float32Array(n * 3);
    const scale = new Float32Array(n);
    const phase = new Float32Array(n);
    const color = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const [x, y, z, s] = place();
      pos.set([x, y, z], i * 3);
      scale[i] = s;
      phase[i] = Math.random();
      const c = pick(colors);
      color.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    const points = new THREE.Points(g, material);
    points.frustumCulled = false;
    points.renderOrder = renderOrder;
    this.scene.add(points);
    return points;
  }

  buildDust() {
    this.dustMat = createDustMaterial(this.dpr);
    this.buildPoints(
      this.q.dust,
      this.dustMat,
      () => [rand(-1, 1), rand(-1, 1), Math.random() < 0.12 ? rand(2, 7) : rand(-16, 2), 0.4 + Math.pow(Math.random(), 2.2) * 1.8],
      2,
      DUST_COLORS,
    );
  }

  buildBokeh() {
    this.bokehMat = createBokehMaterial(this.dpr);
    this.buildPoints(
      this.q.bokeh,
      this.bokehMat,
      () => {
        const near = Math.random() < 0.2;
        return [rand(-1, 1), rand(-1, 1), near ? rand(4, 7.5) : rand(-24, -8), near ? rand(0.3, 0.55) : rand(0.9, 2.6)];
      },
      0,
      BOKEH_COLORS,
    );
  }

  buildPetals() {
    this.petals = new InstancedPool(
      createPetalGeometry(),
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        emissive: new THREE.Color('#3a1018'),
        emissiveIntensity: 0.35,
      }),
      this.q.petalPool,
    );
    this.sparkMat = createSparkMaterial(this.dpr);
    this.sparks = new SparkPool(this.q.sparkPool, this.sparkMat);
    this.petals.mesh.renderOrder = 1;
    this.scene.add(this.petals.mesh, this.sparks.points);
  }

  // ---- lifecycle ----------------------------------------------------------

  bind() {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    this.onPointerMove = (e) => {
      this.pointer.nx = (e.clientX / this.width) * 2 - 1;
      this.pointer.ny = -(e.clientY / this.height) * 2 + 1;
      this.pointer.has = true;
    };
    this.onPointerLeave = () => {
      this.pointer.has = false;
    };
    this.onVisibility = () => {
      if (document.hidden) this.stop();
      else if (!this.suspended) this.start();
    };
    if (fine && !this.q.reduced) {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.container);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.aspect = w / h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.dustMat.uniforms.uAspect.value = this.aspect;
    this.bokehMat.uniforms.uAspect.value = this.aspect;
    if (this.running) this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this.running || this.disposed || document.hidden) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  tick = (now) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const raw = (now - this.last) / 1000;
    this.last = now;
    if (raw <= 0) return;
    const dt = Math.min(raw, 1 / 24);
    this.monitor(raw);
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  // Watches real frame times; if the device can't keep up, render fewer
  // pixels and spawn fewer particles. Steps down at most twice.
  monitor(raw) {
    if (this.time < 1.5 || raw > 0.25) return; // ignore warm-up and tab switches
    this.perfAcc = (this.perfAcc || 0) + raw;
    this.perfFrames = (this.perfFrames || 0) + 1;
    if (this.perfAcc < 2.5) return;
    const avg = this.perfAcc / this.perfFrames;
    this.perfAcc = 0;
    this.perfFrames = 0;
    if (avg > 1 / 42 && (this.downgrades || 0) < 2) {
      this.downgrades = (this.downgrades || 0) + 1;
      this.dpr = Math.max(1, this.dpr * 0.75);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(this.width, this.height, false);
      for (const m of [this.dustMat, this.bokehMat, this.sparkMat]) m.uniforms.uPixelRatio.value = this.dpr;
      this.budget *= 0.65;
    }
  }

  track(anim) {
    this.anims = this.anims.filter((a) => a.isActive() || a.progress() < 1);
    this.anims.push(anim);
    return anim;
  }

  killAnims() {
    this.anims.forEach((a) => a.kill());
    this.anims = [];
    gsap.killTweensOf(this.state);
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.killAnims();
    window.removeEventListener('pointermove', this.onPointerMove);
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.ro.disconnect();

    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      if (o.isInstancedMesh) o.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  // ---- helpers ------------------------------------------------------------

  halfH(z) {
    return (CAM_Z - z) * TAN_HALF;
  }

  /** Point on the plane at depth z under a screen coordinate. */
  screenToWorld(clientX, clientY, z, out = new THREE.Vector3()) {
    this._ndc.set((clientX / this.width) * 2 - 1, -(clientY / this.height) * 2 + 1);
    this.ray.origin.setFromMatrixPosition(this.camera.matrixWorld);
    this.ray.direction.set(this._ndc.x, this._ndc.y, 0.5).unproject(this.camera).sub(this.ray.origin).normalize();
    const t = (z - this.ray.origin.z) / this.ray.direction.z;
    return out.copy(this.ray.origin).addScaledVector(this.ray.direction, t);
  }

  // ---- choreography (called from React) ----------------------------------

  /** Glide every layer toward a stage's mood. */
  setMood(name, { duration = 2.5, ease = 'sine.inOut' } = {}) {
    const mood = MOODS[name];
    if (!mood) return;
    this.track(gsap.to(this.state, { ...mood, duration, ease, overwrite: 'auto' }));
  }

  /** A large petal drifting slowly right past the lens. */
  drift(dir = 1, delay = 0) {
    this.track(gsap.delayedCall(delay, () => this.spawnHero(dir)));
  }

  /** Everything that gathered at the centre blooms outward. */
  burst() {
    this.track(gsap.to(this.state, { gather: 0, duration: 1.4, ease: 'expo.out', overwrite: 'auto' }));
    if (this.q.reduced) return;
    const b = this.budget;
    const c = this._w.set(0, 0, 1).clone();
    for (const p of this.petals.items) {
      const d = this._v.copy(p.pos).sub(c);
      d.z = Math.abs(d.z) * 0.3 + rand(0, 0.5);
      d.normalize();
      p.vel.addScaledVector(d, rand(2, 6));
      p.spin = rand(5, 9) * sign();
    }
    for (let i = 0; i < Math.round(this.q.burstPetals * b); i++) this.spawnBurst(c);
    this.emitSparks(c, Math.round(this.q.sparkPool * 0.2 * b), 1.5, 14, 1.1, SPARK_COLORS);
    this.ring(c, 1, SPARK_COLORS);
  }

  /** The gift opens: petals erupt from a point on screen, then rain down everywhere. */
  flood(clientX, clientY) {
    const b = this.budget * (this.q.reduced ? 0.4 : 1);
    const c = this.screenToWorld(clientX, clientY, 1.5, new THREE.Vector3());
    for (let i = 0; i < Math.round(this.q.burstPetals * 1.6 * b); i++) this.spawnFountain(c);
    this.emitSparks(c, Math.round(this.q.sparkPool * 0.18 * b), 1.5, 12, 1, SPARK_COLORS);
    if (!this.q.reduced) this.ring(c, 0.8, SPARK_COLORS);
    this.track(
      gsap
        .timeline()
        .to(this.state, { ...MOODS.flood, duration: 0.8, ease: 'power2.out', overwrite: 'auto' })
        .to(this.state, { ...MOODS.intro, duration: 6, ease: 'sine.inOut' }, 4),
    );
  }

  /** A small celebratory bloom of petals and light at a point on screen. */
  sparkle(clientX, clientY) {
    const c = this.screenToWorld(clientX, clientY, 2.5, new THREE.Vector3());
    const n = Math.round(24 * this.budget * (this.q.reduced ? 0.4 : 1));
    for (let i = 0; i < n; i++) this.spawnFountain(c, 0.6);
    this.emitSparks(c, Math.round(140 * this.budget), 1, 8, 0.9, SPARK_COLORS);
  }

  /** Particles drawn inward for a breath, then released — used while loading. */
  pulse(colors = 'red') {
    if (this.q.reduced) return;
    const set = colors === 'red' ? RED_SPARKS : SPARK_COLORS;
    this.track(
      gsap
        .timeline()
        .to(this.state, { gather: 0.42, duration: 0.8, ease: 'power2.in', overwrite: 'auto' })
        .call(() => this.ring(this._w.set(0, 0, 1).clone(), 0.55, set))
        .to(this.state, { gather: 0, duration: 1.3, ease: 'expo.out' }),
    );
  }

  /** Turns DOM rects (e.g. letters) into rising motes of light. */
  dissolve(rects) {
    const b = this.budget;
    for (const r of rects) {
      if (!r.width || !r.height) continue;
      const n = Math.max(1, Math.round(Math.min(7, (r.width * r.height) / 150) * b));
      for (let k = 0; k < n; k++) {
        const w = this.screenToWorld(r.left + Math.random() * r.width, r.top + r.height * rand(0.2, 0.9), 4, this._w);
        this.sparks.emit(w.x, w.y, w.z, rand(-0.25, 0.25), rand(0.1, 0.7), rand(-0.1, 0.3), rand(1.2, 2.4), rand(0.45, 0.9), pick(SPARK_COLORS), 1.1, -0.35);
      }
    }
  }

  /** Pause rendering entirely (during the video) and empty the scene. */
  suspend() {
    this.suspended = true;
    this.killAnims();
    Object.assign(this.state, REST);
    this.ambientCount = 0;
    this.petals.clear();
    this.sparks.clear();
    this.renderer.render(this.scene, this.camera); // leave a clean frame behind
    this.stop();
  }

  resume() {
    this.suspended = false;
    this.start();
  }

  // ---- spawners -----------------------------------------------------------

  spawnAmbient() {
    const p = this.petals.acquire('ambient');
    if (!p) return;
    this.ambientCount++;
    const z = Math.random() < 0.12 ? rand(2, 5.5) : rand(-11, 2);
    const hh = this.halfH(z);
    const hw = hh * this.aspect;
    const r = Math.random();
    if (r < 0.35) {
      // Fade in where it is, so the frame never looks empty.
      p.pos.set(rand(-1, 1) * hw, rand(-0.8, 1) * hh, z);
      p.fadeIn = 2.2;
    } else if (r < 0.55) {
      const side = sign();
      p.pos.set(side * (hw + rand(0.6, 1.4)), rand(-0.3, 0.9) * hh, z);
      p.drift = -side * rand(0.3, 0.7);
    } else {
      p.pos.set(rand(-1.05, 1.05) * hw, hh + rand(0.4, 1.6), z);
    }
    p.vel.set(rand(-0.2, 0.2), -rand(0.2, 0.5), 0);
    p.fall = rand(0.32, 0.7);
    p.k = rand(0.55, 0.9);
    p.swayAmp = rand(0.35, 0.85);
    p.swayFreq = rand(0.5, 1.2);
    p.vzT = Math.random() < 0.1 ? rand(0.2, 0.6) : 0;
    p.size = rand(0.16, 0.3);
    p.spin = p.spinBase = rand(0.6, 1.8) * sign();
    p.color.copy(pick(PETAL_COLORS));
  }

  /** Fade out one ambient petal when the mood asks for fewer. */
  retireAmbient() {
    const items = this.petals.items;
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].kind === 'ambient') {
        items[i].kind = 'fading';
        items[i].life = items[i].age + 1.6;
        this.ambientCount--;
        return;
      }
    }
  }

  spawnHero(dir) {
    const p = this.petals.acquire('hero');
    if (!p) return;
    const z = rand(5, 7.5);
    const hh = this.halfH(z);
    const hw = hh * this.aspect;
    p.pos.set(-dir * (hw + 1.2), rand(-0.2, 0.6) * hh, z);
    p.drift = dir * rand(1.4, 2.0) * Math.max(0.6, Math.min(1, this.aspect));
    p.vel.set(p.drift, rand(-0.2, 0.1), 0);
    p.fall = rand(0.12, 0.3);
    p.k = 0.5;
    p.swayAmp = 0.45;
    p.size = rand(0.4, 0.58);
    p.spin = p.spinBase = rand(0.9, 1.5) * sign();
    p.color.copy(pick(PETAL_COLORS));
  }

  spawnBurst(origin) {
    const p = this.petals.acquire('burst');
    if (!p) return;
    p.pos.copy(origin).add(this._v.set(rand(-0.2, 0.2), rand(-0.2, 0.2), rand(-0.2, 0.2)));
    const dir = this._v.set(rand(-1, 1), rand(-1, 1), rand(-0.35, 0.8)).normalize();
    p.vel.copy(dir).multiplyScalar(2 + 7 * Math.pow(Math.random(), 1.6));
    p.life = rand(5, 8);
    p.fadeIn = 0.25;
    p.k = rand(0.7, 1.1);
    p.fall = rand(0.4, 0.9);
    p.swayAmp = rand(0.4, 1);
    p.size = rand(0.14, 0.3);
    p.spin = rand(4, 8) * sign();
    p.spinBase = rand(1, 2.2) * sign();
    p.color.copy(pick(PETAL_COLORS));
  }

  spawnFountain(origin, power = 1) {
    const p = this.petals.acquire('burst');
    if (!p) return;
    p.pos.copy(origin).add(this._v.set(rand(-0.3, 0.3), rand(-0.1, 0.2), rand(-0.3, 0.3)));
    const dir = this._v.set(rand(-1, 1), rand(0.5, 1.6), rand(-0.4, 0.7)).normalize();
    p.vel.copy(dir).multiplyScalar((5 + 9 * Math.pow(Math.random(), 1.3)) * power);
    p.life = rand(6, 9.5);
    p.fadeIn = 0.15;
    p.k = rand(0.5, 0.85);
    p.fall = rand(0.6, 1.1);
    p.swayAmp = rand(0.4, 1);
    p.size = rand(0.16, 0.34);
    p.spin = rand(4, 8) * sign();
    p.spinBase = rand(1, 2.2) * sign();
    p.color.copy(pick(PETAL_COLORS));
  }

  ring(c, scale, colors) {
    const n = Math.round(80 * this.budget * scale);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = rand(8, 10) * scale;
      this.sparks.emit(c.x, c.y, c.z, Math.cos(a) * sp, Math.sin(a) * sp, rand(-0.3, 0.3), rand(0.9, 1.3), rand(0.6, 1), pick(colors), 2.6);
    }
  }

  emitSparks(c, n, minSpeed, maxSpeed, sizeMul, colors) {
    for (let i = 0; i < n; i++) {
      const d = this._v.randomDirection();
      const sp = minSpeed + (maxSpeed - minSpeed) * Math.pow(Math.random(), 1.8);
      this.sparks.emit(c.x, c.y, c.z, d.x * sp, d.y * sp, d.z * sp, rand(0.8, 2), rand(0.6, 1.4) * sizeMul, pick(colors), 1.8, 0.3);
    }
  }

  // ---- per-frame ----------------------------------------------------------

  update(dt) {
    const s = this.state;
    this.time += dt;
    this.flow += dt * s.speed * this.motion;
    const t = this.time;

    // Camera: gentle pointer parallax plus a slow idle drift for depth.
    const idle = this.q.reduced ? 0 : 1;
    const tx = (this.pointer.has ? this.pointer.nx * 0.45 : 0) + Math.sin(t * 0.11) * 0.22 * idle;
    const ty = (this.pointer.has ? this.pointer.ny * 0.3 : 0) + Math.cos(t * 0.09) * 0.14 * idle;
    const ease = 1 - Math.exp(-2 * dt);
    this.camera.position.x += (tx - this.camera.position.x) * ease;
    this.camera.position.y += (ty - this.camera.position.y) * ease;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();

    const du = this.dustMat.uniforms;
    du.uTime.value = this.flow;
    du.uOpacity.value = s.dust;
    du.uBoost.value = s.boost;
    du.uGather.value = s.gather;
    const bu = this.bokehMat.uniforms;
    bu.uTime.value = this.flow;
    bu.uOpacity.value = s.bokeh;
    bu.uBoost.value = s.boost;

    this.hemi.intensity = 1.4 * s.light;
    this.key.intensity = 1.3 * s.light;
    this.rim.intensity = 0.8 * s.light;
    this.glowLight.intensity = s.glow * 40;

    // Population follows the mood: petals trickle in one at a time so nothing
    // pops, or pour in when a flood calls for many.
    const target = Math.round(s.ambient * this.q.ambientPetals * this.budget);
    if (this.ambientCount < target) {
      for (let k = target - this.ambientCount > 12 ? 3 : 1; k > 0 && this.ambientCount < target; k--) this.spawnAmbient();
    } else if (this.ambientCount > target + 1) this.retireAmbient();
    if (s.heroRate > 0 && Math.random() < s.heroRate * dt) this.spawnHero(sign());

    this.updatePetals(dt);
    this.sparks.update(dt);
    this.petals.commit();
  }

  inBounds(p, margin) {
    const z = p.pos.z;
    if (z > CAM_Z - 1.2) return false;
    const hh = this.halfH(z);
    const hw = hh * this.aspect;
    return p.pos.y > -hh - 1.5 && p.pos.y < hh + 3.5 && Math.abs(p.pos.x) < hw + margin;
  }

  updatePetals(dt) {
    const s = this.state;
    const fdt = dt * s.speed * this.motion;
    const ft = this.flow;
    const wind = Math.sin(ft * 0.13) * 0.35 + Math.sin(ft * 0.051 + 1.3) * 0.25 + 0.12;
    const g = s.gather;
    const items = this.petals.items;

    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.age += dt;

      // Velocity relaxes toward a gently swaying fall.
      const a = 1 - Math.exp(-p.k * fdt);
      const tvx = wind + p.drift + Math.sin(ft * p.swayFreq + p.phase) * p.swayAmp;
      p.vel.x += (tvx - p.vel.x) * a;
      p.vel.y += (-p.fall - p.vel.y) * a;
      p.vel.z += (p.vzT - p.vel.z) * a;
      p.pos.addScaledVector(p.vel, fdt);

      // Vortex toward the centre while gathering.
      if (g > 0.01 && p.kind !== 'burst') {
        const x = p.pos.x;
        const y = p.pos.y;
        p.pos.x += (-x * 1.1 - y * 0.8) * g * dt;
        p.pos.y += (-y * 1.1 + x * 0.8) * g * dt;
      }

      p.spin += (p.spinBase - p.spin) * a * 0.6;
      p.quat.multiply(this._q.setFromAxisAngle(p.axis, p.spin * fdt));

      const fadeIn = Math.min(1, p.age / p.fadeIn);
      const fadeOut = p.life === Infinity ? 1 : THREE.MathUtils.clamp((p.life - p.age) / 1.2, 0, 1);
      p.s = p.size * fadeIn * fadeOut;

      if (p.age > p.life || !this.inBounds(p, p.kind === 'hero' ? 3 : 2.5)) {
        if (p.kind === 'ambient') this.ambientCount--;
        this.petals.release(i);
      }
    }
  }
}
