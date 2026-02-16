import * as THREE from 'three'
import { createProjectile } from '../entities.js'
import { laserOriginOffset } from '../config/constants.js'

const tmpForward = new THREE.Vector3()
const tmpDirection = new THREE.Vector3()

export function tryFireProjectile({
  state,
  fireCooldown,
  projectileCooldown,
  projectileSpeed,
  player,
  projectiles,
  scene,
  onFire,
}) {
  let cooldown = Math.max(0, fireCooldown)
  if ((state.fire.pressed || state.fire.held) && cooldown <= 0) {
    const proj = createProjectile(false)
    proj.mesh.position.copy(laserOriginOffset).applyQuaternion(player.group.quaternion).add(player.group.position)
    tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
    // Snapshot heading at fire time; bullets fly straight thereafter.
    proj.velocity = tmpForward.clone().multiplyScalar(projectileSpeed)
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
