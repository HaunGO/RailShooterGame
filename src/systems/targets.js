import * as THREE from 'three'
import { createDrone } from '../entities.js'

export function updateTargets({ targets, scene, bounds, minY, playerZ, dt, targetSpawnTimer }) {
  let timer = targetSpawnTimer - dt
  if (timer <= 0) {
    const t = createDrone()
    t.mesh.position.set(
      THREE.MathUtils.randFloat(-bounds.x, bounds.x),
      THREE.MathUtils.randFloat(minY + 0.6, bounds.y - 0.6),
      playerZ + THREE.MathUtils.randFloat(60, 120)
    )
    scene.add(t.mesh)
    targets.push(t)
    timer = THREE.MathUtils.randFloat(0.45, 0.85)
  }

  for (let i = targets.length - 1; i >= 0; i -= 1) {
    const t = targets[i]
    if (t.mesh.position.z < playerZ - 10) {
      scene.remove(t.mesh)
      targets.splice(i, 1)
    }
  }

  return timer
}
