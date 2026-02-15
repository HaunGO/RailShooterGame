import * as THREE from 'three'
import { createDrone } from '../entities.js'

const HITBOX_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0x2a8f86,
  wireframe: true,
  transparent: true,
  opacity: 0.3,
})

export function attachTargetHitbox(target) {
  if (target.hitbox) return
  const hb = new THREE.Mesh(new THREE.SphereGeometry(target.radius, 10, 10), HITBOX_MATERIAL)
  hb.name = 'hitbox'
  target.mesh.add(hb)
  target.hitbox = hb
}

export function attachAutoLockIndicator(target) {
  if (target.autoLockIndicator) return
  const group = new THREE.Group()
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 0.5, 18),
    new THREE.MeshBasicMaterial({
      color: 0xff3344,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    })
  )
  const crossGeo = new THREE.BufferGeometry()
  crossGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.6, 0, 0, 0.6, 0, 0, 0, -0.6, 0, 0, 0.6, 0], 3)
  )
  const cross = new THREE.LineSegments(
    crossGeo,
    new THREE.LineBasicMaterial({
      color: 0xff3344,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
    })
  )
  group.add(ring)
  group.add(cross)
  group.position.z = 0
  group.visible = false
  group.renderOrder = 999
  ring.renderOrder = 999
  cross.renderOrder = 999
  target.mesh.add(group)
  target.autoLockIndicator = group
}

export function updateTargets({
  targets,
  scene,
  bounds,
  minY,
  playerZ,
  dt,
  targetSpawnTimer,
  hitboxesEnabled,
  shadowsEnabled,
  shadowMaterial,
  floorY,
  onSpawn,
}) {
  let timer = targetSpawnTimer - dt
  if (timer <= 0) {
    const t = createDrone()
    t.mesh.position.set(
      THREE.MathUtils.randFloat(-bounds.x, bounds.x),
      THREE.MathUtils.randFloat(minY + 0.6, bounds.y - 0.6),
      playerZ + THREE.MathUtils.randFloat(60, 120)
    )
    if (hitboxesEnabled) {
      attachTargetHitbox(t)
    }
    if (shadowsEnabled && shadowMaterial) {
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), shadowMaterial)
      shadow.rotation.x = -Math.PI / 2
      shadow.position.set(t.mesh.position.x, floorY + 0.02, t.mesh.position.z)
      t.shadow = shadow
      scene.add(shadow)
    }
    scene.add(t.mesh)
    targets.push(t)
    if (onSpawn) onSpawn(t)
    timer = THREE.MathUtils.randFloat(0.45, 0.85)
  }

  for (let i = targets.length - 1; i >= 0; i -= 1) {
    const t = targets[i]
    if (t.mesh.position.z < playerZ - 10) {
      scene.remove(t.mesh)
      if (t.shadow) scene.remove(t.shadow)
      targets.splice(i, 1)
    }
  }

  return timer
}
