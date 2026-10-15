import * as THREE from 'three';

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
