import * as THREE from 'three'
import { createProjectile } from '../entities.js'
import { GAME_CONFIG, laserOriginOffset } from '../config/constants.js'

const tmpForward = new THREE.Vector3()
const tmpDirection = new THREE.Vector3()
const tmpLaserOrigin = new THREE.Vector3()
const tmpPlanePoint = new THREE.Vector3()
const tmpNdc = new THREE.Vector2()
const aimRaycaster = new THREE.Raycaster()

/**
 * World-space direction from the laser origin through the screen pixel (aim),
 * intersecting the plane ahead of the ship used for crosshair depth.
 * Falls back to ship forward if the pick ray is parallel to that plane.
 */
function directionFromScreenAim(player, camera, aim, out) {
  tmpLaserOrigin.copy(laserOriginOffset).applyQuaternion(player.group.quaternion).add(player.group.position)
  tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
  tmpPlanePoint.copy(tmpLaserOrigin).addScaledVector(tmpForward, GAME_CONFIG.crosshairProjectionDistance)
  aimRaycaster.setFromCamera(tmpNdc.set(aim.x, -aim.y), camera)
  const rayO = aimRaycaster.ray.origin
  const rayD = aimRaycaster.ray.direction
  const denom = tmpForward.dot(rayD)
  if (Math.abs(denom) < 1e-5) {
    out.copy(tmpForward)
    return out
  }
  const planeD = -tmpForward.dot(tmpPlanePoint)
  const t = -(tmpForward.dot(rayO) + planeD) / denom
  if (t < 0) {
    out.copy(tmpForward)
    return out
  }
  out.copy(rayD).multiplyScalar(t).add(rayO).sub(tmpLaserOrigin).normalize()
  if (out.lengthSq() < 1e-8) out.copy(tmpForward)
  return out
}

export function tryFireProjectile({
  state,
  fireCooldown,
  projectileCooldown,
  projectileSpeed,
  player,
  camera,
  screenAim,
  projectiles,
  scene,
  onFire,
}) {
  let cooldown = Math.max(0, fireCooldown)
  if ((state.fire.pressed || state.fire.held) && cooldown <= 0) {
    const proj = createProjectile(false)
    proj.mesh.position.copy(laserOriginOffset).applyQuaternion(player.group.quaternion).add(player.group.position)
    tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
    if (camera && screenAim && typeof screenAim.x === 'number' && typeof screenAim.y === 'number') {
      directionFromScreenAim(player, camera, screenAim, tmpDirection)
      proj.velocity = tmpDirection.clone().multiplyScalar(projectileSpeed)
    } else {
      // Snapshot heading at fire time; bullets fly straight thereafter.
      proj.velocity = tmpForward.clone().multiplyScalar(projectileSpeed)
    }
    scene.add(proj.mesh)
    projectiles.push(proj)
    if (onFire) onFire(proj)
    cooldown = projectileCooldown
  }
  return cooldown
}

export function updateProjectiles({ projectiles, scene, dt, playerZ, projectileSpeed, onMiss }) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i]
    if (p.velocity) {
      p.mesh.position.x += p.velocity.x * dt
      p.mesh.position.y += p.velocity.y * dt
      p.mesh.position.z += p.velocity.z * dt
      tmpDirection.copy(p.velocity).normalize()
      if (tmpDirection.lengthSq() > 1e-6) {
        p.mesh.quaternion.setFromUnitVectors(tmpForward.set(0, 1, 0), tmpDirection)
      }
    } else {
      p.mesh.position.z += projectileSpeed * dt
    }
    if (p.mesh.position.z > playerZ + 120) {
      if (onMiss) onMiss(p)
      scene.remove(p.mesh)
      projectiles.splice(i, 1)
    }
  }
}
