import * as THREE from 'three'

export function createReticleSystem(renderer, camera) {
  const tmpForward = new THREE.Vector3()
  const tmpPoint = new THREE.Vector3()
  const tmpNdc = new THREE.Vector3()

  return function updateReticle(reticleEl, player) {
    if (!reticleEl) return

    const rect = renderer.domElement.getBoundingClientRect()
    const halfW = rect.width / 2
    const halfH = rect.height / 2

    tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
    tmpPoint.copy(player.group.position).addScaledVector(tmpForward, 25)

    tmpNdc.copy(tmpPoint).project(camera)
    const padding = 12

    if (tmpNdc.z < -1 || tmpNdc.z > 1) {
      reticleEl.style.opacity = '0'
      return
    }

    reticleEl.style.opacity = '1'
    let xPx = tmpNdc.x * halfW
    let yPx = -tmpNdc.y * halfH
    xPx = THREE.MathUtils.clamp(xPx, -halfW + padding, halfW - padding)
    yPx = THREE.MathUtils.clamp(yPx, -halfH + padding, halfH - padding)
    reticleEl.style.transform = `translate(calc(-50% + ${xPx}px), calc(-50% + ${yPx}px))`
  }
}
