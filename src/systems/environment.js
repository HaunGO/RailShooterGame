import * as THREE from 'three'

export function createEnvironment(scene) {
  const env = new THREE.Group()
  scene.add(env)

  const floorY = -2
  const segmentLength = 40
  const segmentCount = 10
  const floorWidth = 28
  const floorSegments = []

  for (let i = 0; i < segmentCount; i += 1) {
    const mat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0x141c33 : 0x10182d,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    })
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, segmentLength, 1, 1), mat)
    seg.rotation.x = -Math.PI / 2
    seg.position.set(0, floorY, i * segmentLength)
    env.add(seg)
    floorSegments.push(seg)
  }

  return {
    floorY,
    segmentLength,
    segmentCount,
    floorSegments,
  }
}

export function updateEnvironment(envState, playerZ) {
  const { floorSegments, segmentLength, segmentCount } = envState
  const wrapBehindZ = playerZ - segmentLength
  for (let i = 0; i < floorSegments.length; i += 1) {
    const seg = floorSegments[i]
    if (seg.position.z < wrapBehindZ) {
      seg.position.z += segmentLength * segmentCount
    }
  }
}
