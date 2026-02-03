import * as THREE from 'three'

const EFFECT_DURATION = 0.18

export function createEffectsSystem(scene) {
  const explosions = []

  function addExplosion(position, { color, radius }) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 10, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
    )
    mesh.position.copy(position)
    mesh.userData.t = 0
    scene.add(mesh)
    explosions.push(mesh)
  }

  function update(dt) {
    for (let i = explosions.length - 1; i >= 0; i -= 1) {
      const e = explosions[i]
      e.userData.t += dt
      const k = e.userData.t / EFFECT_DURATION
      e.scale.setScalar(1 + k * 1.6)
      e.material.opacity = THREE.MathUtils.clamp(1 - k, 0, 1)
      if (e.userData.t >= EFFECT_DURATION) {
        scene.remove(e)
        explosions.splice(i, 1)
      }
    }
  }

  return { addExplosion, update }
}
