import * as THREE from 'three';
import gsap from 'gsap';
import { detectQuality } from './quality';
import { createPetalGeometry, createRoseGeometry, createHeartGeometry } from './geometries';
import { createDustMaterial, createBokehMaterial, createSparkMaterial } from './materials';
import { INTRO, YES } from '../timing';

const CAM_Z = 12;
const FOV = 45;
const TAN_HALF = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const sign = () => (Math.random() < 0.5 ? -1 : 1);
const palette = (list) => list.map((c) => new THREE.Color(c));

const PETAL_COLORS = palette(['#ffd3de', '#ffc0d0', '#ffb0c4', '#ffe4ea', '#fff1ef', '#f7a1bb', '#fbc9d8', '#ffd9cf']);
const HEART_COLORS = palette(['#ff6f91', '#ff8fab', '#f0577f', '#ffadc0', '#e8466f']);
const ROSE_COLORS = palette(['#ea5a80', '#dc4870', '#f2829f', '#d6466d', '#f59ab2']);
const SPARK_COLORS = palette(['#fff6e5', '#ffe3b3', '#ffd0dc', '#ffffff', '#ffc2d4']);
const HEART_SPARK_COLORS = palette(['#ff9ab5', '#ffd0dc', '#ffffff', '#ff7aa0']);
const DUST_COLORS = palette(['#fff3d6', '#ffe0ea', '#ffffff', '#ffd6c2', '#f6d6ff']);
const BOKEH_COLORS = palette(['#ffffff', '#ffd9e3', '#ffe6d6', '#f3dcff', '#ffc9d8']);

// Rose resting spots in normalised screen space — kept to the corners so the
// question always owns the centre of the frame.
const ROSE_ANCHORS = [
  [-0.8, 0.64, -5],
  [0.82, -0.62, -4.5],
  [0.86, 0.7, -8],
  [-0.84, -0.66, -7],
  [-0.12, 0.96, -10],
  [0.18, -0.98, -9],
];

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

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
// Instanced pool for petals / hearts / roses. Live items stay contiguous so
// mesh.count is exact and nothing is drawn for dead slots.
// ---------------------------------------------------------------------------
function makeItem() {
  return {
    kind: '',
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    axis: new THREE.Vector3(0, 1, 0),
    color: new THREE.Color(),
    p0: new THREE.Vector3(),
    p1: new THREE.Vector3(),
    p2: new THREE.Vector3(),
    anchor: new THREE.Vector3(),
  };
}

function resetItem(p) {
  p.age = 0;
  p.life = Infinity;
  p.s = 0;
  p.size = 0.3;
  p.k = 0.8;
  p.fall = 0.6;
  p.drift = 0;
  p.vzT = 0;
  p.swayAmp = 0.6;
  p.swayFreq = 1;
  p.phase = Math.random() * Math.PI * 2;
  p.spin = 1;
  p.spinBase = 1;
  p.rotY = 0;
  p.tilt = 0;
  p.roll = 0;
  p.t = 0;
  p.dur = 1;
  p.delay = 0;
  p.trail = 0;
  p.enter = 1;
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
export class RomanceEngine {
  constructor(container) {
    this.container = container;
    this.q = detectQuality();
    this.budget = 1; // scaled down if frame times are poor
    this.time = 0;
    this.celebrated = false;
    this.anims = [];
    this.counts = { ambient: 0, ambientHearts: 0 };
    this.heartAcc = 0;
    this.lastBloom = -1;

    // Tweened by GSAP, read every frame.
    this.state = {
      dust: 0,
      bokeh: 0,
      ambient: 0,
      ambientHearts: 0,
      sideBias: 1,
      heartRate: 0,
      boost: 0,
      rosePulse: 0,
    };

    this.pointer = { nx: 0, ny: 0, x: 0, y: 0, has: false, touch: false, lastMove: -99, trailAcc: 0 };
    this.parallax = { x: 0, y: 0 };
    this.ray = new THREE.Raycaster().ray;
    this._ndc = new THREE.Vector2();
    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();

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
    this.buildPools();

    this.resize();
    this.bind();
    this.start();
  }

  // ---- construction -------------------------------------------------------

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff4f6, 0xf0b2c4, 2.1));
    const key = new THREE.DirectionalLight(0xfff1e8, 1.6);
    key.position.set(-4, 6, 8);
    const rim = new THREE.DirectionalLight(0xffd0e0, 0.9);
    rim.position.set(5, -3, -4);
    this.flashLight = new THREE.PointLight(0xffc1d4, 0, 20, 1.4);
    this.flashLight.position.set(0, 0, 3);
    this.scene.add(key, rim, this.flashLight);
  }

  buildDust() {
    const n = this.q.dust;
    const pos = new Float32Array(n * 3);
    const scale = new Float32Array(n);
    const phase = new Float32Array(n);
    const color = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-1, 1);
      pos[i * 3 + 1] = rand(-1, 1);
      pos[i * 3 + 2] = Math.random() < 0.12 ? rand(2, 7) : rand(-16, 2);
      scale[i] = 0.4 + Math.pow(Math.random(), 2.2) * 1.8;
      phase[i] = Math.random();
      const c = pick(DUST_COLORS);
      color.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    this.dustMat = createDustMaterial(this.dpr);
    this.dust = new THREE.Points(g, this.dustMat);
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 2;
    this.scene.add(this.dust);
  }

  buildBokeh() {
    const n = this.q.bokeh;
    const pos = new Float32Array(n * 3);
    const scale = new Float32Array(n);
    const phase = new Float32Array(n);
    const color = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const near = Math.random() < 0.2;
      pos[i * 3] = rand(-1, 1);
      pos[i * 3 + 1] = rand(-1, 1);
      pos[i * 3 + 2] = near ? rand(4, 7.5) : rand(-24, -8);
      scale[i] = near ? rand(0.3, 0.55) : rand(0.9, 2.6);
      phase[i] = Math.random();
      const c = pick(BOKEH_COLORS);
      color.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    this.bokehMat = createBokehMaterial(this.dpr);
    this.bokeh = new THREE.Points(g, this.bokehMat);
    this.bokeh.frustumCulled = false;
    this.bokeh.renderOrder = 0;
    this.scene.add(this.bokeh);
  }

  buildPools() {
    const q = this.q;

    this.petals = new InstancedPool(
      createPetalGeometry(),
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        emissive: new THREE.Color('#ffb7c8'),
        emissiveIntensity: 0.14,
      }),
      q.petalPool,
    );

    this.hearts = new InstancedPool(
      createHeartGeometry(),
      new THREE.MeshPhongMaterial({
        color: 0xffffff,
        shininess: 60,
        specular: new THREE.Color('#b27a88'),
        emissive: new THREE.Color('#7a1430'),
        emissiveIntensity: 0.22,
      }),
      q.heartPool,
    );

    this.roses = new InstancedPool(
      createRoseGeometry(),
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        emissive: new THREE.Color('#5a0a22'),
        emissiveIntensity: 0.1,
      }),
      q.roses + q.burstRoses,
    );

    this.sparkMat = createSparkMaterial(this.dpr);
    this.sparks = new SparkPool(q.sparkPool, this.sparkMat);

    this.petals.mesh.renderOrder = 1;
    this.hearts.mesh.renderOrder = 1;
    this.roses.mesh.renderOrder = 1;
    this.scene.add(this.roses.mesh, this.petals.mesh, this.hearts.mesh, this.sparks.points);

    // Floating roses waiting in the depths for the intro.
    for (let i = 0; i < q.roses; i++) {
      const r = this.roses.acquire('float');
      const a = ROSE_ANCHORS[i % ROSE_ANCHORS.length];
      r.anchor.set(a[0], a[1], a[2]);
      r.size = rand(0.85, 1.15);
      r.tilt = rand(0.9, 1.25);
      r.roll = rand(-0.5, 0.5);
      r.spin = rand(0.06, 0.14) * sign();
      r.color.copy(ROSE_COLORS[i % ROSE_COLORS.length]);
      r.enter = 0;
    }
  }

  // ---- lifecycle ----------------------------------------------------------

  bind() {
    this.onPointerMove = (e) => {
      const p = this.pointer;
      if (p.has) p.trailAcc += Math.hypot(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX;
      p.y = e.clientY;
      p.nx = (e.clientX / this.width) * 2 - 1;
      p.ny = -(e.clientY / this.height) * 2 + 1;
      p.has = true;
      p.touch = e.pointerType === 'touch';
      p.lastMove = this.time;
    };
    this.onPointerDown = (e) => {
      this.onPointerMove(e);
      this.pointer.trailAcc = 0;
      if (e.target?.closest?.('button, a, [data-no-bloom]')) return;
      this.bloom(e.clientX, e.clientY);
    };
    this.onPointerLeave = () => {
      this.pointer.has = false;
    };
    this.onVisibility = () => (document.hidden ? this.stop() : this.start());

    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
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
    // Narrow portrait screens get proportionally smaller roses.
    this.roseScale = THREE.MathUtils.clamp(this.aspect * 1.15, 0.62, 1);
    if (this.running) this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this.running || this.disposed) return;
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

  dispose() {
    this.disposed = true;
    this.stop();
    this.anims.forEach((a) => a.kill());
    gsap.killTweensOf([this.state, this.camera.position, this.flashLight, ...this.roses.items]);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.ro.disconnect();

    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      if (o.dispose && o.isInstancedMesh) o.dispose();
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

  intro() {
    const s = this.state;
    const tl = gsap.timeline();
    tl.to(s, { dust: 1, duration: 3.4, ease: 'sine.inOut' }, INTRO.dust)
      .to(s, { bokeh: 0.5, duration: 4, ease: 'sine.inOut' }, INTRO.dust + 0.3)
      .to(s, { ambient: this.q.ambientPetals, duration: 5, ease: 'power1.in' }, INTRO.petals)
      .to(s, { sideBias: 0.18, duration: 6, ease: 'sine.inOut' }, INTRO.petals)
      .to(s, { ambientHearts: this.q.ambientHearts, duration: 4 }, INTRO.petals + 2.5);
    this.roses.items.forEach((r, i) => {
      tl.to(r, { enter: 1, duration: 4.2, ease: 'power3.out' }, INTRO.roses + i * 0.35);
    });
    INTRO.heroPetals.forEach((at, i) => tl.call(() => this.spawnHero(i % 2 ? -1 : 1), null, at));
    this.anims.push(tl);
    return tl;
  }

  celebrate() {
    if (this.celebrated) return;
    this.celebrated = true;
    const s = this.state;
    const b = this.budget;
    const n = Math.round(this.q.convergePetals * b);
    for (let i = 0; i < n; i++) this.spawnConverge(i, n);

    const B = YES.burst;
    const tl = gsap.timeline();
    tl.to(s, { boost: 1, duration: B - YES.converge, ease: 'power2.in' }, YES.converge)
      .to(s, { sideBias: 0, duration: 0.5 }, 0)
      .call(() => this.burst(), null, B)
      .to(this.camera.position, { z: CAM_Z - 1.2, duration: 0.16, ease: 'power2.out' }, B)
      .to(this.camera.position, { z: CAM_Z, duration: 2, ease: 'elastic.out(1, 0.45)' }, B + 0.16)
      .to(this.flashLight, { intensity: 45, duration: 0.1, ease: 'power2.out' }, B)
      .to(this.flashLight, { intensity: 0, duration: 1.8, ease: 'power2.out' }, B + 0.1)
      .to(s, { rosePulse: 1, duration: 0.2, ease: 'power2.out' }, B)
      .to(s, { rosePulse: 0, duration: 1.6, ease: 'elastic.out(1, 0.4)' }, B + 0.2)
      .call(() => this.emitHeartShape(), null, B + 0.28)
      .to(s, { boost: 0.4, duration: 3, ease: 'sine.inOut' }, B + 0.5)
      .to(s, { heartRate: 6 * b, duration: 0.4 }, B + 0.2)
      .to(s, { heartRate: 1.3 * b, duration: 6, ease: 'sine.inOut' }, B + 3)
      .to(s, { ambient: Math.round(this.q.ambientPetals * 1.35 * b), duration: 3 }, B + 1);
    this.anims.push(tl);
  }

  /** Small petal puff where the NO button used to be. */
  puff(clientX, clientY) {
    const c = this.screenToWorld(clientX, clientY, 3, this._v.clone());
    const n = Math.max(2, Math.round(5 * this.budget));
    for (let i = 0; i < n; i++) this.spawnBurstPetal(c, 0.2, 0.55);
    this.emitSparks(c, Math.round(16 * this.budget), 0.6, 4, 0.45);
  }

  /** Tap/click on empty space: a little bloom where the finger landed. */
  bloom(clientX, clientY) {
    if (this.time - this.lastBloom < 0.12) return;
    this.lastBloom = this.time;
    const c = this.screenToWorld(clientX, clientY, 2, this._v.clone());
    const n = Math.max(3, Math.round((this.celebrated ? 10 : 6) * this.budget));
    for (let i = 0; i < n; i++) this.spawnBurstPetal(c, 0.24, 0.7);
    if (this.celebrated) for (let i = 0; i < 2; i++) this.spawnBurstHeart(c, 0.35);
    this.emitSparks(c, Math.round(26 * this.budget), 0.8, 5.5, 0.6);
  }

  // ---- spawners -----------------------------------------------------------

  spawnAmbientPetal() {
    const p = this.petals.acquire('ambient');
    if (!p) return;
    this.counts.ambient++;
    const z = Math.random() < 0.14 ? rand(2, 6) : rand(-11, 2);
    const hh = this.halfH(z);
    const hw = hh * this.aspect;
    const side = Math.random() < this.state.sideBias * 0.85 ? sign() : 0;
    if (side) {
      p.pos.set(side * (hw + rand(0.6, 1.4)), rand(-0.4, 0.9) * hh, z);
      p.drift = -side * rand(0.7, 1.4);
      p.vel.set(-side * rand(1.4, 2.6), rand(-0.5, 0.2), 0);
    } else {
      p.pos.set(rand(-1.05, 1.05) * hw, hh + rand(0.4, 1.8), z);
      p.vel.set(rand(-0.3, 0.3), -rand(0.3, 0.8), 0);
    }
    p.fall = rand(0.45, 0.95);
    p.k = rand(0.55, 0.9);
    p.swayAmp = rand(0.4, 1.0);
    p.swayFreq = rand(0.6, 1.4);
    p.vzT = Math.random() < 0.12 ? rand(0.3, 0.9) : 0;
    p.size = rand(0.2, 0.36);
    p.spin = p.spinBase = rand(0.8, 2.2) * sign();
    p.color.copy(pick(PETAL_COLORS));
  }

  /** Large petals that drift right past the lens. */
  spawnHero(dir) {
    const p = this.petals.acquire('hero');
    if (!p) return;
    const z = rand(5.2, 7.8);
    const hh = this.halfH(z);
    const hw = hh * this.aspect;
    p.pos.set(-dir * (hw + 1.2), rand(-0.3, 0.55) * hh, z);
    p.drift = dir * rand(2.2, 3.0) * Math.max(0.6, Math.min(1, this.aspect));
    p.vel.set(p.drift, rand(-0.3, 0.1), 0);
    p.fall = rand(0.15, 0.35);
    p.k = 0.5;
    p.swayAmp = 0.5;
    p.size = rand(0.42, 0.62);
    p.spin = p.spinBase = rand(1.2, 2) * sign();
    p.color.copy(pick(PETAL_COLORS));
  }

  spawnConverge(i, n) {
    const p = this.petals.acquire('converge');
    if (!p) return;
    const a = (i / n) * Math.PI * 2 + rand(-0.25, 0.25);
    const z0 = rand(-2, 3);
    const hh = this.halfH(z0);
    const hw = hh * this.aspect;
    p.p0.set(Math.cos(a) * hw * 1.15, Math.sin(a) * hh * 1.15, z0);
    p.p2.set(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(0, 0.8));
    // Control point pushed sideways (always the same way) so the whole
    // flock swirls in like a vortex rather than flying in straight lines.
    const dx = p.p2.x - p.p0.x;
    const dy = p.p2.y - p.p0.y;
    p.p1.set((p.p0.x + p.p2.x) / 2 - dy * 0.38, (p.p0.y + p.p2.y) / 2 + dx * 0.38, (z0 + p.p2.z) / 2 + 1);
    p.delay = YES.converge + rand(0, 0.35);
    p.dur = YES.burst - p.delay - rand(0.04, 0.16);
    p.pos.copy(p.p0);
    p.size = rand(0.22, 0.36);
    p.spin = rand(5, 9) * sign();
    p.spinBase = rand(1, 2.4) * sign();
    p.color.copy(pick(PETAL_COLORS));
  }

  launch(p, origin, speedMul) {
    p.pos.copy(origin).add(this._v.set(rand(-0.15, 0.15), rand(-0.15, 0.15), rand(-0.15, 0.15)));
    const dir = this._v.set(rand(-1, 1), rand(-1, 1), rand(-0.35, 1)).normalize();
    p.vel.copy(dir).multiplyScalar((2 + 11 * Math.pow(Math.random(), 1.6)) * speedMul);
  }

  spawnBurstPetal(origin, speedMul = 1, sizeMul = 1) {
    const p = this.petals.acquire('burst');
    if (!p) return;
    this.launch(p, origin, speedMul);
    this.toBurst(p);
    p.size = rand(0.18, 0.4) * sizeMul;
  }

  toBurst(p) {
    p.kind = 'burst';
    p.age = 0;
    p.life = rand(6, 10);
    p.k = rand(0.7, 1.1);
    p.fall = rand(0.5, 1.0);
    p.drift = 0;
    p.swayAmp = rand(0.4, 1);
    p.spin = rand(4, 9) * sign();
    p.spinBase = rand(1, 2.5) * sign();
    p.color.copy(pick(PETAL_COLORS));
  }

  spawnBurstHeart(origin, speedMul = 1) {
    const p = this.hearts.acquire('burst');
    if (!p) return;
    this.launch(p, origin, speedMul * 0.75);
    p.life = rand(7, 10);
    p.k = 1.1;
    p.fall = -rand(0.5, 1.0);
    p.size = rand(0.2, 0.4);
    p.spin = rand(3, 7) * sign();
    p.color.copy(pick(HEART_COLORS));
  }

  spawnRisingHeart(ambient) {
    const p = this.hearts.acquire(ambient ? 'ambient' : 'rise');
    if (!p) return;
    const z = ambient ? rand(-13, -4) : rand(-7, 4);
    const hh = this.halfH(z);
    const hw = hh * this.aspect;
    p.pos.set(rand(-0.95, 0.95) * hw, -hh - rand(0.6, 1.6), z);
    p.fall = -(ambient ? rand(0.35, 0.6) : rand(0.7, 1.4));
    p.vel.set(0, -p.fall, 0);
    p.k = 0.8;
    p.size = ambient ? rand(0.16, 0.26) : rand(0.18, 0.36);
    p.swayAmp = rand(0.3, 0.7);
    p.spin = 0;
    p.color.copy(pick(HEART_COLORS));
    if (ambient) this.counts.ambientHearts++;
  }

  spawnBurstRose(origin) {
    const p = this.roses.acquire('burst');
    if (!p) return;
    p.pos.copy(origin);
    // Flung outward so they sweep past the edges instead of settling over the message.
    const a = Math.random() * Math.PI * 2;
    const dir = this._v.set(Math.cos(a), Math.sin(a) * 0.75, rand(0.15, 0.5)).normalize();
    p.vel.copy(dir).multiplyScalar(rand(7, 9));
    p.life = rand(4.5, 6);
    p.k = 0.35;
    p.fall = rand(-0.2, 0.25);
    p.size = rand(0.55, 0.8);
    p.tilt = rand(0.6, 1.3);
    p.roll = rand(-0.6, 0.6);
    p.spin = rand(2, 4) * sign();
    p.color.copy(pick(ROSE_COLORS));
  }

  burst() {
    const b = this.budget;
    const c = new THREE.Vector3(0, 0, 0.6);
    for (const p of this.petals.items) {
      if (p.kind === 'converge' || p.kind === 'gather') {
        this.toBurst(p);
        const dir = this._v.copy(p.pos).sub(c);
        dir.z += rand(0, 0.6);
        dir.normalize();
        p.vel.copy(dir).multiplyScalar(rand(4, 12));
      }
    }
    for (let i = 0; i < Math.round(this.q.burstPetals * b); i++) this.spawnBurstPetal(c);
    for (let i = 0; i < Math.round(this.q.burstHearts * b); i++) this.spawnBurstHeart(c);
    for (let i = 0; i < this.q.burstRoses; i++) this.spawnBurstRose(c);
    this.emitSparks(c, Math.round(this.q.sparkPool * 0.28 * b), 2, 18, 1.2);

    // Expanding shock ring in the screen plane.
    const ring = Math.round(90 * b);
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2;
      const sp = rand(9, 11);
      this.sparks.emit(c.x, c.y, c.z, Math.cos(a) * sp, Math.sin(a) * sp, rand(-0.3, 0.3), rand(0.9, 1.3), rand(0.7, 1.1), pick(SPARK_COLORS), 2.6);
    }
  }

  /** A firework that settles into the shape of a heart. */
  emitHeartShape() {
    const n = Math.round(150 * this.budget);
    const scale = Math.min(1, this.aspect * 1.25) * 0.36;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const j = rand(0.94, 1.06);
      this.sparks.emit(0, 0.4, 0.8, hx * scale * j, hy * scale * j, rand(-0.4, 0.4), rand(1.7, 2.4), rand(0.9, 1.4), pick(HEART_SPARK_COLORS), 2.1, 0.12);
    }
  }

  emitSparks(c, n, minSpeed, maxSpeed, sizeMul) {
    for (let i = 0; i < n; i++) {
      const d = this._v.randomDirection();
      const sp = minSpeed + (maxSpeed - minSpeed) * Math.pow(Math.random(), 1.8);
      this.sparks.emit(c.x, c.y, c.z, d.x * sp, d.y * sp, d.z * sp, rand(0.8, 2), rand(0.6, 1.5) * sizeMul, pick(SPARK_COLORS), 1.8, 0.35);
    }
  }

  // ---- per-frame ----------------------------------------------------------

  update(dt) {
    this.time += dt;
    const t = this.time;
    const s = this.state;

    // Camera: pointer parallax plus a slow idle drift.
    const ptr = this.pointer;
    const fresh = ptr.has && (!ptr.touch || t - ptr.lastMove < 1.5);
    const tx = (fresh ? ptr.nx * 0.6 : 0) + Math.sin(t * 0.11) * 0.25;
    const ty = (fresh ? ptr.ny * 0.38 : 0) + Math.cos(t * 0.09) * 0.15;
    const ease = 1 - Math.exp(-2.2 * dt);
    this.camera.position.x += (tx - this.camera.position.x) * ease;
    this.camera.position.y += (ty - this.camera.position.y) * ease;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();

    // Pointer ray for petal repulsion and sparkle trails.
    this.pointerLive = ptr.has && t - ptr.lastMove < 2.5;
    if (this.pointerLive) {
      this.ray.origin.copy(this.camera.position);
      this.ray.direction.set(ptr.nx, ptr.ny, 0.5).unproject(this.camera).sub(this.ray.origin).normalize();
      let emitted = 0;
      while (ptr.trailAcc > 14 && emitted < 5) {
        ptr.trailAcc -= 14;
        emitted++;
        const tt = (4 - this.ray.origin.z) / this.ray.direction.z;
        const o = this.ray.origin;
        const d = this.ray.direction;
        this.sparks.emit(o.x + d.x * tt + rand(-0.05, 0.05), o.y + d.y * tt + rand(-0.05, 0.05), 4, rand(-0.25, 0.25), rand(0.1, 0.5), 0, rand(0.6, 1.1), rand(0.35, 0.8), pick(SPARK_COLORS), 1.4, -0.5);
      }
      ptr.trailAcc = Math.min(ptr.trailAcc, 30);
    }

    // Uniform-driven fields.
    this.dustMat.uniforms.uTime.value = t;
    this.dustMat.uniforms.uOpacity.value = s.dust;
    this.dustMat.uniforms.uBoost.value = s.boost;
    this.bokehMat.uniforms.uTime.value = t;
    this.bokehMat.uniforms.uOpacity.value = s.bokeh;
    this.bokehMat.uniforms.uBoost.value = s.boost;

    // Spawning.
    const ambientTarget = Math.floor(s.ambient * this.budget);
    for (let k = 0; k < 2 && this.counts.ambient < ambientTarget; k++) this.spawnAmbientPetal();
    if (this.counts.ambientHearts < Math.floor(s.ambientHearts)) this.spawnRisingHeart(true);
    this.heartAcc += s.heartRate * dt;
    while (this.heartAcc >= 1) {
      this.heartAcc -= 1;
      this.spawnRisingHeart(false);
    }

    this.updatePetals(dt, t);
    this.updateHearts(dt, t);
    this.updateRoses(dt, t);
    this.sparks.update(dt);

    this.petals.commit();
    this.hearts.commit();
    this.roses.commit();
  }

  repel(p, dt, strength) {
    if (!this.pointerLive) return;
    const o = this.ray.origin;
    const d = this.ray.direction;
    const tt = (p.pos.z - o.z) / d.z;
    const dx = p.pos.x - (o.x + d.x * tt);
    const dy = p.pos.y - (o.y + d.y * tt);
    const d2 = dx * dx + dy * dy;
    const R = 1.4;
    if (d2 < R * R && d2 > 1e-5) {
      const dist = Math.sqrt(d2);
      const f = (1 - dist / R) * strength * dt;
      p.vel.x += (dx / dist) * f;
      p.vel.y += (dy / dist) * f;
      p.spin += Math.sign(p.spin || 1) * f * 2;
    }
  }

  inBounds(p, margin = 2.5) {
    const z = p.pos.z;
    if (z > CAM_Z - 1.2) return false;
    const hh = this.halfH(z);
    const hw = hh * this.aspect;
    return p.pos.y > -hh - 1.5 && p.pos.y < hh + 3.5 && Math.abs(p.pos.x) < hw + margin;
  }

  updatePetals(dt, t) {
    const items = this.petals.items;
    const wind = Math.sin(t * 0.13) * 0.35 + Math.sin(t * 0.051 + 1.3) * 0.25;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];

      if (p.kind === 'converge') {
        if (p.delay > 0) {
          p.delay -= dt;
          p.s = 0;
          continue;
        }
        p.age += dt;
        p.t = Math.min(1, p.t + dt / p.dur);
        const u = p.t;
        const e = u * u * (2.2 - 1.2 * u);
        const ie = 1 - e;
        p.pos.set(
          ie * ie * p.p0.x + 2 * ie * e * p.p1.x + e * e * p.p2.x,
          ie * ie * p.p0.y + 2 * ie * e * p.p1.y + e * e * p.p2.y,
          ie * ie * p.p0.z + 2 * ie * e * p.p1.z + e * e * p.p2.z,
        );
        p.s = p.size * Math.min(1, p.age * 4) * (1 - 0.35 * e);
        p.quat.multiply(this._q.setFromAxisAngle(p.axis, p.spin * dt));
        // Glittering motion trail.
        p.trail += dt;
        while (p.trail > 0.028) {
          p.trail -= 0.028;
          this.sparks.emit(p.pos.x, p.pos.y, p.pos.z, rand(-0.2, 0.2), rand(-0.2, 0.2), 0, rand(0.35, 0.7), rand(0.5, 0.9), pick(SPARK_COLORS), 2.5);
        }
        if (p.t >= 1) {
          p.kind = 'gather';
          p.tilt = Math.atan2(p.pos.y - p.p2.y, p.pos.x - p.p2.x);
          p.roll = rand(0.15, 0.45);
        }
        continue;
      }

      if (p.kind === 'gather') {
        p.tilt += dt * 5;
        p.pos.set(p.p2.x + Math.cos(p.tilt) * p.roll, p.p2.y + Math.sin(p.tilt) * p.roll, p.p2.z);
        p.quat.multiply(this._q.setFromAxisAngle(p.axis, p.spin * dt));
        continue;
      }

      // Free flight: velocity relaxes toward a gently swaying fall.
      p.age += dt;
      const a = 1 - Math.exp(-p.k * dt);
      const tvx = wind + p.drift + Math.sin(t * p.swayFreq + p.phase) * p.swayAmp;
      p.vel.x += (tvx - p.vel.x) * a;
      p.vel.y += (-p.fall - p.vel.y) * a;
      p.vel.z += (p.vzT - p.vel.z) * a;
      this.repel(p, dt, 12);
      p.pos.addScaledVector(p.vel, dt);
      p.spin += (p.spinBase - p.spin) * a * 0.6;
      p.quat.multiply(this._q.setFromAxisAngle(p.axis, p.spin * dt));

      const fadeIn = Math.min(1, p.age / 0.5);
      const fadeOut = p.life === Infinity ? 1 : THREE.MathUtils.clamp((p.life - p.age) / 0.9, 0, 1);
      p.s = p.size * fadeIn * fadeOut;

      if (p.age > p.life || !this.inBounds(p, p.kind === 'hero' ? 3 : 2.5)) {
        if (p.kind === 'ambient') this.counts.ambient--;
        this.petals.release(i);
      }
    }
  }

  updateHearts(dt, t) {
    const items = this.hearts.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.age += dt;
      const a = 1 - Math.exp(-p.k * dt);
      const tvx = Math.sin(t * 0.8 + p.phase) * p.swayAmp;
      p.vel.x += (tvx - p.vel.x) * a;
      p.vel.y += (-p.fall - p.vel.y) * a;
      p.vel.z += (0 - p.vel.z) * a;
      this.repel(p, dt, 8);
      p.pos.addScaledVector(p.vel, dt);
      p.spin *= Math.exp(-0.8 * dt);
      p.rotY += p.spin * dt;
      this._e.set(Math.sin(t * 0.9 + p.phase) * 0.25, p.rotY + Math.sin(t * 0.7 + p.phase) * 0.6, Math.sin(t * 1.1 + p.phase) * 0.2, 'XYZ');
      p.quat.setFromEuler(this._e);

      const fadeIn = Math.min(1, p.age / 0.6);
      const fadeOut = p.life === Infinity ? 1 : THREE.MathUtils.clamp((p.life - p.age) / 1, 0, 1);
      const beat = 1 + 0.05 * Math.pow(Math.max(0, Math.sin(t * 2.6 + p.phase)), 12);
      p.s = p.size * easeOutCubic(fadeIn) * fadeOut * beat;

      if (p.age > p.life || !this.inBounds(p)) {
        if (p.kind === 'ambient') this.counts.ambientHearts--;
        this.hearts.release(i);
      }
    }
  }

  updateRoses(dt, t) {
    const items = this.roses.items;
    const pulse = 1 + this.state.rosePulse * 0.16;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.age += dt;
      if (p.kind === 'float') {
        const z = p.anchor.z - (1 - p.enter) * 16;
        const hh = this.halfH(p.anchor.z);
        const hw = hh * this.aspect;
        p.pos.set(
          p.anchor.x * hw + Math.cos(t * 0.37 + p.phase) * 0.18,
          p.anchor.y * hh + Math.sin(t * 0.5 + p.phase) * 0.22,
          z,
        );
        this._e.set(p.tilt + Math.sin(t * 0.3 + p.phase) * 0.08, p.phase + t * p.spin, p.roll, 'ZXY');
        p.quat.setFromEuler(this._e);
        p.s = p.size * this.roseScale * easeOutCubic(p.enter) * pulse;
        continue;
      }
      // Burst roses tumble outward then drift.
      const a = 1 - Math.exp(-p.k * dt);
      p.vel.x += (Math.sin(t * 0.5 + p.phase) * 0.3 - p.vel.x) * a;
      p.vel.y += (-p.fall - p.vel.y) * a;
      p.vel.z += (0 - p.vel.z) * a;
      p.pos.addScaledVector(p.vel, dt);
      p.spin *= Math.exp(-0.5 * dt);
      p.rotY += (p.spin + 0.15) * dt;
      this._e.set(p.tilt + Math.sin(t * 0.6 + p.phase) * 0.2, p.rotY, p.roll, 'ZXY');
      p.quat.setFromEuler(this._e);
      const fadeIn = Math.min(1, p.age / 0.4);
      const fadeOut = THREE.MathUtils.clamp((p.life - p.age) / 1.2, 0, 1);
      p.s = p.size * this.roseScale * easeOutCubic(fadeIn) * fadeOut;
      if (p.age > p.life || !this.inBounds(p, 3)) this.roses.release(i);
    }
  }
}
