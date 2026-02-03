export function handleProjectileTargetCollisions({ targets, projectiles, scene, effects }) {
  for (let i = targets.length - 1; i >= 0; i -= 1) {
    const t = targets[i]
    for (let j = projectiles.length - 1; j >= 0; j -= 1) {
      const p = projectiles[j]
      if (t.mesh.position.distanceTo(p.mesh.position) <= t.radius + p.radius) {
        scene.remove(t.mesh)
        scene.remove(p.mesh)
        targets.splice(i, 1)
        projectiles.splice(j, 1)
        effects.addExplosion(t.mesh.position, { color: 0xfff1a6, radius: 0.6 })
        break
      }
    }
  }
}

export function handleTargetShipCollisions({
  targets,
  scene,
  player,
  shipHitSpheres,
  tmpSphereCenter,
  tmpToTarget,
  playerHitTimer,
  playerHitInvuln,
  effects,
}) {
  if (playerHitTimer > 0) return playerHitTimer

  for (let i = targets.length - 1; i >= 0; i -= 1) {
    const t = targets[i]
    let hit = false
    let impactPoint = null

    for (let s = 0; s < shipHitSpheres.length; s += 1) {
      const sphere = shipHitSpheres[s]
      tmpSphereCenter.copy(sphere.offset).applyQuaternion(player.group.quaternion).add(player.group.position)
      const dist = tmpSphereCenter.distanceTo(t.mesh.position)
      if (dist <= sphere.radius + t.radius) {
        tmpToTarget.copy(t.mesh.position).sub(tmpSphereCenter)
        if (tmpToTarget.lengthSq() > 1e-6) {
          tmpToTarget.setLength(sphere.radius)
          impactPoint = tmpSphereCenter.clone().add(tmpToTarget)
        } else {
          impactPoint = t.mesh.position.clone()
        }
        hit = true
        break
      }
    }

    if (hit) {
      scene.remove(t.mesh)
      targets.splice(i, 1)
      effects.addExplosion(impactPoint ?? player.group.position, { color: 0xff6b6b, radius: 0.8 })
      return playerHitInvuln
    }
  }

  return playerHitTimer
}
