import * as THREE from 'three'
import { GAME_CONFIG, laserOriginOffset } from '../config/constants.js'

/** Laser sight: ray from nose to center crosshairs or to first target within that distance; line, hit marker, target highlight. */
export function createLaserSight(scene, options = {}) {
  const maxLength = options.maxLength ?? GAME_CONFIG.crosshairProjectionDistance
  const tmpForward = new THREE.Vector3()
  const tmpOrigin = new THREE.Vector3()
  const tmpEnd = new THREE.Vector3()

  const laserLineGeometry = new THREE.BufferGeometry()
  laserLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3))
  const laserLine = new THREE.Line(
    laserLineGeometry,
    new THREE.LineBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.65 })
  )
  laserLine.frustumCulled = false
  scene.add(laserLine)

  const laserHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.9 })
  )
  laserHit.visible = false
  scene.add(laserHit)

  const laserRaycaster = new THREE.Raycaster()
  laserRaycaster.far = maxLength

  let laserTarget = null

  function clearLaserHighlight() {
    if (!laserTarget) return
    const mat = laserTarget.mesh?.material
    const original = laserTarget._laserOriginal
    if (mat && mat.isMeshStandardMaterial && original) {
      mat.color.copy(original.color)
      mat.emissive.copy(original.emissive)
      mat.emissiveIntensity = original.emissiveIntensity
    }
    laserTarget = null
  }

  function applyLaserHighlight(target) {
    if (!target?.mesh?.material) return
    const mat = target.mesh.material
    if (!mat.isMeshStandardMaterial) return
    if (!target._laserOriginal) {
      target._laserOriginal = {
        color: mat.color.clone(),
        emissive: mat.emissive.clone(),
        emissiveIntensity: mat.emissiveIntensity,
      }
    }
    mat.color.set(0xff4a4a)
    mat.emissive.set(0xff1a1a)
    mat.emissiveIntensity = 0.9
  }

  function setEnabled(enabled) {
    laserLine.visible = enabled
    if (!enabled) {
      laserHit.visible = false
      clearLaserHighlight()
    }
  }

  function setVisible(visible) {
    laserLine.visible = visible
    if (!visible) laserHit.visible = false
  }

  function update(player, targets) {
    tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
    tmpOrigin.copy(laserOriginOffset).applyQuaternion(player.group.quaternion).add(player.group.position)
    laserRaycaster.set(tmpOrigin, tmpForward)
    const targetMeshes = targets.map((t) => t.mesh)
    const hits = targetMeshes.length > 0 ? laserRaycaster.intersectObjects(targetMeshes, false) : []

    if (hits.length > 0 && hits[0].distance <= maxLength) {
      const hit = hits[0]
      tmpEnd.copy(hit.point)
      laserHit.position.copy(hit.point)
      laserHit.visible = true
      if (laserTarget !== hit.object.__targetRef) {
        clearLaserHighlight()
      }
      if (!hit.object.__targetRef) {
        hit.object.__targetRef = targets.find((t) => t.mesh === hit.object) ?? null
      }
      if (hit.object.__targetRef) {
        laserTarget = hit.object.__targetRef
        applyLaserHighlight(laserTarget)
      }
    } else {
      tmpEnd.copy(tmpOrigin).addScaledVector(tmpForward, maxLength)
      laserHit.visible = false
      clearLaserHighlight()
    }

    const pos = laserLine.geometry.attributes.position
    pos.setXYZ(0, tmpOrigin.x, tmpOrigin.y, tmpOrigin.z)
    pos.setXYZ(1, tmpEnd.x, tmpEnd.y, tmpEnd.z)
    pos.needsUpdate = true
  }

  /** Call after targets array may have changed (e.g. after collisions) to clear highlight if target was removed. */
  function clearHighlightIfTargetGone(targets) {
    if (laserTarget && !targets.includes(laserTarget)) {
      clearLaserHighlight()
    }
  }

  return { update, setEnabled, setVisible, clearHighlightIfTargetGone }
}
