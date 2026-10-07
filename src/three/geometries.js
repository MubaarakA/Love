import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * A single curved petal, built as a small grid so it can cup across its width
 * and curl along its length. Base sits at the origin, tip points up +Y and the
 * cupped (inner) side faces +Z when `cup` is positive.
 */
function buildPetal({
  length = 1,
  width = 0.62,
  cup = 0.12,
  curl = 0.1,
  notch = 0.1,
  round = 0.05,
  profile = 'blossom',
  baseShade = 0.82,
  tipShade = 1,
  rim = 0,
  segX = 6,
  segY = 8,
}) {
  const positions = [];
  const colors = [];
  const indices = [];

  for (let j = 0; j <= segY; j++) {
    const v = j / segY;
    const half =
      profile === 'rose'
        ? (width / 2) * Math.sin(Math.min(1, v * 1.5 + 0.12) * Math.PI * 0.5) * (1 - 0.12 * v * v)
        : (width / 2) * Math.sqrt(v) * (1 - 0.42 * v * v * v);

    for (let i = 0; i <= segX; i++) {
      const u = (i / segX) * 2 - 1;
      const x = u * half;
      const y = v * length - notch * (1 - u * u) * Math.pow(v, 8) - round * u * u * Math.pow(v, 4);
      const z = cup * u * u * (half / (width / 2)) + curl * Math.pow(v, 2.4);
      positions.push(x, y, z);

      // Deeper at the base, luminous at the edges — reads as translucency.
      // A lighter rim on the outer edge separates overlapping layers.
      const edge = Math.abs(u) * 0.12 + rim * (THREE.MathUtils.smoothstep(v, 0.72, 1) + 0.5 * Math.pow(Math.abs(u), 3) * v);
      const s = THREE.MathUtils.lerp(baseShade, tipShade, Math.pow(Math.min(1, v * 1.15), 0.7)) + edge;
      colors.push(Math.min(1, s), Math.min(1, s * (0.97 + 0.03 * v)), Math.min(1, s * (0.98 + 0.02 * v)));
    }
  }

  const row = segX + 1;
  for (let j = 0; j < segY; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** A cherry-blossom style petal centred on its own middle, for free-falling. */
export function createPetalGeometry() {
  const geo = buildPetal({ length: 1, width: 0.68, cup: 0.1, curl: 0.14, notch: 0.13, round: 0.06 });
  geo.translate(0, -0.5, 0);
  return geo;
}

/** A rose head: rings of cupped petals that open wider toward the outside. */
export function createRoseGeometry() {
  const layers = [
    { n: 3, len: 0.42, w: 0.6, open: 0.1, r: 0.02, cup: -0.2, curl: 0, shade: 0.5 },
    { n: 4, len: 0.5, w: 0.66, open: 0.26, r: 0.035, cup: -0.22, curl: 0.02, shade: 0.6 },
    { n: 5, len: 0.58, w: 0.72, open: 0.46, r: 0.05, cup: -0.22, curl: 0.05, shade: 0.7 },
    { n: 6, len: 0.66, w: 0.8, open: 0.72, r: 0.07, cup: -0.2, curl: 0.1, shade: 0.8 },
    { n: 6, len: 0.72, w: 0.8, open: 1.0, r: 0.085, cup: -0.16, curl: 0.17, shade: 0.9 },
    { n: 7, len: 0.78, w: 0.8, open: 1.3, r: 0.1, cup: -0.1, curl: 0.24, shade: 1 },
  ];

  const parts = [];
  layers.forEach((L, li) => {
    for (let k = 0; k < L.n; k++) {
      // Slight per-petal irregularity keeps the silhouette organic.
      const jitter = 0.92 + Math.random() * 0.14;
      const p = buildPetal({
        length: L.len * jitter,
        width: L.w * (0.9 + Math.random() * 0.12),
        cup: L.cup,
        curl: L.curl,
        notch: 0,
        round: L.len * 0.16,
        profile: 'rose',
        baseShade: L.shade * 0.32,
        tipShade: Math.min(1, L.shade * 0.95),
        rim: 0.22,
        segX: 5,
        segY: 6,
      });
      p.rotateX(L.open + (Math.random() - 0.5) * 0.16);
      p.translate(0, 0, L.r);
      p.rotateY((k / L.n) * Math.PI * 2 + li * 0.7 + (Math.random() - 0.5) * 0.24);
      parts.push(p);
    }
  });

  const geo = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  geo.translate(0, -0.18, 0);
  return geo;
}

/** A soft, bevelled 3D heart roughly one unit tall, point down. */
export function createHeartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 1.6,
    bevelEnabled: true,
    bevelThickness: 2.2,
    bevelSize: 1.8,
    bevelSegments: 3,
    curveSegments: 9,
  });
  geo.center();
  geo.rotateZ(Math.PI);
  geo.scale(0.05, 0.05, 0.05);
  geo.computeVertexNormals();
  return geo;
}
