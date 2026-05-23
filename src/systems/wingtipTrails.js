import * as THREE from 'three'

const WINGTIP_HALF_WIDTH = 0.22
/** Trail origin in ship local space: inboard by half streak width so thick part aligns with wing tip. */
const WINGTIP_LEFT = new THREE.Vector3(-2.3 + WINGTIP_HALF_WIDTH, 0.0, 0.6)
const WINGTIP_RIGHT = new THREE.Vector3(2.3 - WINGTIP_HALF_WIDTH, 0.0, 0.6)

/** Max ribbon segments in mesh index buffer; path may hold at most `MAX_POINTS + 1` samples. */
const MAX_POINTS = 48
const MAX_PATH_SAMPLES = MAX_POINTS + 1
const MIN_SPEED_SCALE_FOR_TRAIL = 0.15
const BASE_OPACITY = 0.1
const TRAIL_COLOR = 0xffffff
const TRAIL_COLOR_HYPERSONIC = new THREE.Color(0xa8f0ff)
const TRAIL_COLOR_BASE = new THREE.Color(TRAIL_COLOR)

const WORLD_UP = new THREE.Vector3(0, 1, 0)
const tmpTrailColor = new THREE.Color()

const streakVertexShader = `
  attribute float edge;
  varying float vEdge;
  void main() {
    vEdge = edge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const streakFragmentShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vEdge;
  void main() {
    float dist = abs(vEdge - 0.5) * 2.0;
    float soft = 1.0 - smoothstep(0.2, 0.95, dist);
    gl_FragColor = vec4(uColor, uOpacity * soft);
  }
`

function buildRibbonMesh(maxPoints, color) {
  const vertexCount = (maxPoints + 1) * 2
  const positions = new Float32Array(vertexCount * 3)
  const edges = new Float32Array(vertexCount)
  for (let i = 0; i <= maxPoints; i++) {
    edges[i * 2] = 0
    edges[i * 2 + 1] = 1
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('edge', new THREE.BufferAttribute(edges, 1))

  const indexCount = maxPoints * 6
  const indices = new Uint16Array(indexCount)
  for (let i = 0; i < maxPoints; i++) {
    const o = i * 6
    const a = i * 2
    indices[o] = a
    indices[o + 1] = a + 1
    indices[o + 2] = a + 2
    indices[o + 3] = a + 1
    indices[o + 4] = a + 3
    indices[o + 5] = a + 2
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))

  const material = new THREE.ShaderMaterial({
    vertexShader: streakVertexShader,
    fragmentShader: streakFragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: BASE_OPACITY },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  return { mesh, geometry, positions }
}

/**
 * Creates the wingtip trail system. Emits streak points from both wingtips in world space;
 * trail length and opacity scale with forward speed. Ribbon is thicker at the wingtip and tapers to the tail.
 */
export function createWingtipTrails(scene) {
  const leftPoints = []
  const rightPoints = []
  const worldLeft = new THREE.Vector3()
  const worldRight = new THREE.Vector3()
  const segmentDir = new THREE.Vector3()
  const rightDir = new THREE.Vector3()

  const left = buildRibbonMesh(MAX_POINTS, TRAIL_COLOR)
  const right = buildRibbonMesh(MAX_POINTS, TRAIL_COLOR)
  scene.add(left.mesh)
  scene.add(right.mesh)

  function writeRibbon(points, positions, mesh, material, opacity, color) {
    const n = points.length
    if (n < 2) {
      mesh.visible = false
      return
    }
    material.uniforms.uColor.value.copy(color)
    material.uniforms.uOpacity.value = opacity

    for (let i = 0; i < n; i++) {
      const p = points[i]
      const t = i / (n - 1)
      const halfWidth = WINGTIP_HALF_WIDTH * t

      if (i < n - 1) {
        segmentDir.subVectors(points[i + 1], p).normalize()
      } else if (n >= 2) {
        segmentDir.subVectors(p, points[i - 1]).normalize()
      }
      rightDir.crossVectors(segmentDir, WORLD_UP).normalize()
      if (rightDir.lengthSq() < 1e-8) {
        rightDir.set(1, 0, 0)
      }

      const ix = i * 2 * 3
      positions[ix] = p.x - rightDir.x * halfWidth
      positions[ix + 1] = p.y - rightDir.y * halfWidth
      positions[ix + 2] = p.z - rightDir.z * halfWidth
      positions[ix + 3] = p.x + rightDir.x * halfWidth
      positions[ix + 4] = p.y + rightDir.y * halfWidth
      positions[ix + 5] = p.z + rightDir.z * halfWidth
    }

    mesh.geometry.setDrawRange(0, (n - 1) * 6)
    mesh.geometry.attributes.position.needsUpdate = true
    mesh.visible = true
  }

  function update(dt, player, speedScale, hypersonicBlend = 0, hypersonicTier = 0) {
    const group = player.group
    group.localToWorld(worldLeft.copy(WINGTIP_LEFT))
    group.localToWorld(worldRight.copy(WINGTIP_RIGHT))

    const hyp = Math.max(0, Math.min(1, hypersonicBlend))
    const tier = Math.max(0, Math.min(2, Math.floor(Number(hypersonicTier) || 0)))
    const t = Math.max(0, Math.min(1, (speedScale - MIN_SPEED_SCALE_FOR_TRAIL) / (1 - MIN_SPEED_SCALE_FOR_TRAIL)))
    const baseLength = 0.3 + 0.65 * t
    /** Keep sample count inside fixed GPU buffers; hypersonic reads longer via opacity/color only. */
    const lengthForGeometry = Math.min(0.995, baseLength * (1 + 0.06 * hyp + 0.04 * tier))
    const pathPointBudget = Math.max(6, Math.min(MAX_PATH_SAMPLES, Math.floor(MAX_POINTS * lengthForGeometry)))
    const opacity = Math.min(0.62, BASE_OPACITY * (0.2 + 0.8 * t) * (1 + 1.1 * hyp + tier * 0.2))
    tmpTrailColor.copy(TRAIL_COLOR_BASE).lerp(TRAIL_COLOR_HYPERSONIC, Math.min(1, hyp + tier * 0.2))

    leftPoints.push(worldLeft.clone())
    rightPoints.push(worldRight.clone())
    while (leftPoints.length > pathPointBudget) leftPoints.shift()
    while (rightPoints.length > pathPointBudget) rightPoints.shift()

    writeRibbon(leftPoints, left.positions, left.mesh, left.mesh.material, opacity, tmpTrailColor)
    writeRibbon(rightPoints, right.positions, right.mesh, right.mesh.material, opacity, tmpTrailColor)
  }

  function setVisible(visible) {
    left.mesh.visible = visible && leftPoints.length > 1
    right.mesh.visible = visible && rightPoints.length > 1
  }

  return { update, setVisible }
}
