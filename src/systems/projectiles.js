import * as THREE from 'three'
import { createProjectile } from '../entities.js'

const tmpForward = new THREE.Vector3()

export function tryFireProjectile({
  state,
  fireCooldown,
  projectileCooldown,
  projectileSpeed,
  player,
  projectiles,
  scene,
}) {
  let cooldown = Math.max(0, fireCooldown)
  if (state.fire.pressed && cooldown <= 0) {
    const proj = createProjectile(false)
    proj.mesh.position.copy(player.group.position)
    proj.mesh.position.z += 2.2
    tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
    // Snapshot heading at fire time; bullets fly straight thereafter.
    proj.velocity = tmpForward.clone().multiplyScalar(projectileSpeed)
    scene.add(proj.mesh)
    projectiles.push(proj)
    cooldown = projectileCooldown
  }
  return cooldown
}

export function updateProjectiles({ projectiles, scene, dt, playerZ, projectileSpeed }) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i]
    if (p.velocity) {
      p.mesh.position.x += p.velocity.x * dt
      p.mesh.position.y += p.velocity.y * dt
      p.mesh.position.z += p.velocity.z * dt
    } else {
      p.mesh.position.z += projectileSpeed * dt
    }
    if (p.mesh.position.z > playerZ + 120) {
      scene.remove(p.mesh)
      projectiles.splice(i, 1)
    }
  }
}
