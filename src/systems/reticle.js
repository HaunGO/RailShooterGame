import * as THREE from 'three'

export function createReticleSystem(renderer, camera) {
  const tmpForward = new THREE.Vector3()
  const tmpPoint = new THREE.Vector3()
  const tmpNdc = new THREE.Vector3()
  const tmpTargetNdc = new THREE.Vector3()

  return function updateReticle(reticleEl, player, targets = []) {
    if (!reticleEl) return null

    const rect = renderer.domElement.getBoundingClientRect()
    const halfW = rect.width / 2
    const halfH = rect.height / 2

    tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
    tmpPoint.copy(player.group.position).addScaledVector(tmpForward, 25)

    tmpNdc.copy(tmpPoint).project(camera)
    const padding = 12

    if (tmpNdc.z < -1 || tmpNdc.z > 1) {
      reticleEl.style.opacity = '0'
      reticleEl.classList.remove('reticle--lock')
      return null
    }

    reticleEl.style.opacity = '1'
    let xPx = tmpNdc.x * halfW
    let yPx = -tmpNdc.y * halfH
    xPx = THREE.MathUtils.clamp(xPx, -halfW + padding, halfW - padding)
    yPx = THREE.MathUtils.clamp(yPx, -halfH + padding, halfH - padding)
    reticleEl.style.transform = `translate(calc(-50% + ${xPx}px), calc(-50% + ${yPx}px))`

    let hasLock = false
    let lockedTarget = null
    const lockRadiusPx = 18
    let bestDistSq = lockRadiusPx * lockRadiusPx
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i]
      if (!t?.mesh) continue
      tmpTargetNdc.copy(t.mesh.position).project(camera)
      if (tmpTargetNdc.z < -1 || tmpTargetNdc.z > 1) continue
      const tx = tmpTargetNdc.x * halfW
      const ty = -tmpTargetNdc.y * halfH
      const dx = tx - xPx
      const dy = ty - yPx
      const distSq = dx * dx + dy * dy
      if (distSq <= bestDistSq) {
        bestDistSq = distSq
        hasLock = true
        lockedTarget = t
      }
    }
    reticleEl.classList.toggle('reticle--lock', hasLock)
    return lockedTarget
  }
}
