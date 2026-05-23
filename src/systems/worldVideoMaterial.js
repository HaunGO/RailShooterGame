import * as THREE from 'three'
import {
  WORLD_VIDEO_DOME_BOWL_AMP_MAX,
  WORLD_VIDEO_DOME_DEPTH,
  WORLD_VIDEO_DOME_SLIDER_MAX,
  WORLD_VIDEO_ZOOM_CURVE,
} from '../config/constants.js'

/**
 * POV video on a subdivided plane: optional **inner dome** — `bowlAmp` drives vertex recess
 * (normalized by `WORLD_VIDEO_DOME_SLIDER_MAX` so large slider values don’t explode geometry).
 */
const worldVideoVertexShader = `
uniform float immersion;
uniform float bowlAmp;

varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 p = position;
  vec2 c = vec2(0.5);
  float rho = length(uv - c) * 1.414213562;
  rho = min(rho, 1.0);
  float recess = pow(1.0 - rho, 1.55);
  p.z -= immersion * recess * bowlAmp;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const worldVideoFragmentShader = `
uniform sampler2D map;
uniform float opacity;
uniform vec2 mapRepeat;
uniform vec2 mapOffset;

varying vec2 vUv;

void main() {
  vec2 mapUv = vUv * mapRepeat + mapOffset;
  mapUv = clamp(mapUv, vec2(0.0), vec2(1.0));
  vec4 tex = texture2D(map, mapUv);
  gl_FragColor = vec4(tex.rgb, tex.a * opacity);
}
`

/** Bowl amplitude from normalized depth 0…1 (same `pow` curve as `updateWorldVideo` zoom). */
export function worldVideoBowlAmpFromLinear(linear) {
  const x = Number(linear)
  if (!Number.isFinite(x) || x <= 0) return 0
  const t = Math.pow(Math.min(1, x), WORLD_VIDEO_ZOOM_CURVE)
  return t * WORLD_VIDEO_DOME_BOWL_AMP_MAX
}

/** Bowl vertex amplitude from raw slider depth (no boost — boost applied in `updateWorldVideo`). */
export function worldVideoBowlAmpFromDepth(depth) {
  const d = Number(depth)
  if (!Number.isFinite(d) || d <= 0) return 0
  const linear = Math.min(1, d / WORLD_VIDEO_DOME_SLIDER_MAX)
  return worldVideoBowlAmpFromLinear(linear)
}

/**
 * @param {THREE.VideoTexture} videoTexture
 * @param {{ opacity?: number; domeDepth?: number }} [opts]
 */
export function createWorldVideoShaderMaterial(videoTexture, opts = {}) {
  const opacity = opts.opacity ?? 0.5
  const depth = opts.domeDepth ?? WORLD_VIDEO_DOME_DEPTH
  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: videoTexture },
      opacity: { value: opacity },
      mapRepeat: { value: new THREE.Vector2(1, 1) },
      mapOffset: { value: new THREE.Vector2(0, 0) },
      immersion: { value: 0 },
      bowlAmp: { value: worldVideoBowlAmpFromDepth(depth) },
    },
    vertexShader: worldVideoVertexShader,
    fragmentShader: worldVideoFragmentShader,
    transparent: true,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
    side: THREE.FrontSide,
  })
  return material
}

/** Keep shader UV transform in sync with `texture.repeat` / `texture.offset` (cover crop). */
export function syncWorldVideoMapUniforms(material, texture) {
  const u = material?.uniforms
  if (!u?.mapRepeat?.value || !u?.mapOffset?.value || !texture) return
  u.mapRepeat.value.copy(texture.repeat)
  u.mapOffset.value.copy(texture.offset)
}
