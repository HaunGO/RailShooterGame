import * as THREE from 'three'

const EFFECT_DURATION = 0.18
const LASER_DURATION = 0.12

export function createEffectsSystem(scene) {
  const explosions = []
  const lasers = []

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

  function addLaserBeam(start, end, { color = 0xff3344, opacity = 0.9, radius = 0.06 } = {}) {
    const direction = new THREE.Vector3().subVectors(end, start)
    const length = direction.length()
    if (length <= 1e-4) return
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 10, 1, true)
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
    const beam = new THREE.Mesh(geometry, material)
    beam.frustumCulled = false
    beam.userData.t = 0
    beam.position.copy(start).addScaledVector(direction, 0.5)
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    scene.add(beam)
    lasers.push(beam)
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

    for (let i = lasers.length - 1; i >= 0; i -= 1) {
      const beam = lasers[i]
      beam.userData.t += dt
      const k = beam.userData.t / LASER_DURATION
      beam.material.opacity = THREE.MathUtils.clamp(1 - k, 0, 1)
      if (beam.userData.t >= LASER_DURATION) {
        scene.remove(beam)
        beam.geometry.dispose()
        beam.material.dispose()
        lasers.splice(i, 1)
      }
    }
  }

  return { addExplosion, addLaserBeam, update }
}
