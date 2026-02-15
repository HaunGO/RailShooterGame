import * as THREE from 'three'

export function createPlayer() {
  const group = new THREE.Group()

  const material = new THREE.MeshStandardMaterial({
    color: 0x5b6fe6,
    emissive: 0x141b3d,
    emissiveIntensity: 0.35,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
    side: THREE.DoubleSide,
  })

  // Low-poly "paper airplane" (custom geometry) pointing forward (+Z).
  // Intentionally large wings + center ridge to read clearly in silhouette.
  const geo = new THREE.BufferGeometry()
  const vertices = new Float32Array([
    // 0 nose
    0.0, 0.0, 2.2,
    // 1 left wing tip (front)
    -2.3, 0.0, 0.6,
    // 2 right wing tip (front)
    2.3, 0.0, 0.6,
    // 3 tail point
    0.0, 0.0, -1.8,
    // 4 ridge (top)
    0.0, 0.35, 0.7,
    // 5 tail ridge (top)
    0.0, 0.22, -1.1,
  ])
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geo.setIndex([
    // top faces
    0, 4, 1, // nose -> ridge -> left
    0, 2, 4, // nose -> right -> ridge
    4, 5, 1, // ridge -> tailRidge -> left
    4, 2, 5, // ridge -> right -> tailRidge
    // bottom faces (simple underside)
    0, 1, 3,
    0, 3, 2,
  ])
  geo.computeVertexNormals()

  const plane = new THREE.Mesh(geo, material)
  group.add(plane)

  // Small vertical fin at the tail to reinforce "paper airplane" vibe.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.55), material)
  fin.position.set(0, 0.28, -1.25)
  group.add(fin)

  return {
    group,
    radius: 0.5,
    velocity: new THREE.Vector3(),
    fireCooldown: 0,
    chargeTime: 0,
  }
}

export function createDrone() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.4, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xff7a7a, flatShading: true })
  )
  return { mesh, radius: 0.6, hp: 1 }
}

export function createProjectile(isCharged = false) {
  const material = new THREE.MeshStandardMaterial({
    color: isCharged ? 0xffe27a : 0x7cff2b,
    emissive: isCharged ? 0x3a2d00 : 0x2a6b00,
    flatShading: true,
  })
  let mesh
  if (isCharged) {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), material)
  } else {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 10, 1, true), material)
  }
  return { mesh, radius: isCharged ? 0.3 : 0.18, isCharged }
}

export function createRing() {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.6, 0.12, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x7affb0, flatShading: true })
  )
  ring.rotation.x = Math.PI / 2
  return { mesh: ring, radius: 0.7 }
}
