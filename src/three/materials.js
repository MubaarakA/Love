import * as THREE from 'three';

// Ambient glowing dust. Positions are stored in normalised view space and
// expanded per-depth in the shader, so the field always fills the frustum
// regardless of aspect ratio — and costs zero CPU per frame.
export function createDustMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uBoost: { value: 0 },
      uGather: { value: 0 },
      uSize: { value: 70 },
      uPixelRatio: { value: pixelRatio },
      uTanHalf: { value: Math.tan(THREE.MathUtils.degToRad(22.5)) },
      uAspect: { value: 1 },
      uCamZ: { value: 12 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uOpacity, uBoost, uGather, uSize, uPixelRatio, uTanHalf, uAspect, uCamZ;
      attribute float aScale;
      attribute float aPhase;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float z = position.z;
        float hh = (uCamZ - z) * uTanHalf * 1.2;
        float hw = hh * uAspect + 0.6;
        float rise = uTime * (0.05 + 0.07 * aScale) * (1.0 + uBoost * 2.5);
        float y = mod(position.y * hh + rise + hh, 2.0 * hh) - hh;
        float x = position.x * hw + sin(uTime * 0.22 + aPhase * 6.2831) * 0.35;
        y += cos(uTime * 0.31 + aPhase * 4.0) * 0.18;
        // Gather: swirl inward toward the centre of the frame.
        float g = clamp(uGather * (0.6 + 0.4 * aPhase), 0.0, 1.0);
        float ang = g * 1.8;
        vec2 swirl = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * vec2(x, y) * 0.1;
        vec2 p = mix(vec2(x, y), swirl, g);
        x = p.x;
        y = p.y;
        vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * aScale * uPixelRatio * (1.0 + uBoost * 0.5) / -mv.z;
        float tw = 0.5 + 0.5 * sin(uTime * (0.7 + aScale) + aPhase * 30.0);
        vAlpha = uOpacity * (0.3 + 0.7 * tw) * (0.85 + uBoost * 0.6);
        vColor = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c);
        float a = exp(-d * 28.0) * 0.9 + exp(-d * 9.0) * 0.25;
        a *= (1.0 - smoothstep(0.12, 0.25, d));
        gl_FragColor = vec4(vColor, a * vAlpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

// Large soft discs with a faint rim — out-of-focus lights.
export function createBokehMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uBoost: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uTanHalf: { value: Math.tan(THREE.MathUtils.degToRad(22.5)) },
      uAspect: { value: 1 },
      uCamZ: { value: 12 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uOpacity, uBoost, uPixelRatio, uTanHalf, uAspect, uCamZ;
      attribute float aScale;
      attribute float aPhase;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float z = position.z;
        float hh = (uCamZ - z) * uTanHalf * 1.1;
        float hw = hh * uAspect;
        float x = position.x * hw + sin(uTime * 0.07 + aPhase * 6.2831) * 0.8;
        float y = position.y * hh + cos(uTime * 0.06 + aPhase * 5.0) * 0.6;
        vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(aScale * 900.0 * uPixelRatio / -mv.z, 260.0 * uPixelRatio);
        float breathe = 0.75 + 0.25 * sin(uTime * 0.4 + aPhase * 12.0);
        vAlpha = uOpacity * breathe * (1.0 + uBoost * 0.8);
        vColor = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float disc = (1.0 - smoothstep(0.82, 1.0, d));
        float rim = smoothstep(0.62, 0.92, d) * disc;
        float a = (disc * 0.55 + rim * 0.35) * vAlpha;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

// CPU-driven sparkles (pointer trails, bursts, petal trails) with a soft
// core and a four-point glint that reads as light rather than dots.
export function createSparkMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: /* glsl */ `
      uniform float uPixelRatio;
      attribute float aSize;
      attribute float aAlpha;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(aSize * uPixelRatio * 60.0 / -mv.z, 140.0 * uPixelRatio);
        vColor = aColor;
        vAlpha = aAlpha;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c);
        float core = exp(-d * 60.0);
        float glow = exp(-d * 14.0) * 0.35;
        vec2 ac = abs(c);
        float glint = (exp(-ac.x * 46.0) * exp(-ac.y * 6.0) + exp(-ac.y * 46.0) * exp(-ac.x * 6.0)) * 0.55;
        float a = (core + glow + glint) * (1.0 - smoothstep(0.14, 0.25, d)) * vAlpha;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }
    `,
  });
}
