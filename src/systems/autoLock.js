import * as THREE from 'three'
import { GAME_CONFIG, laserOriginOffset } from '../config/constants.js'
import { createProjectile } from '../entities.js'
import { attachAutoLockIndicator } from './targets.js'

/** Instant Laser (R) and auto-fire: eligibility, targeting, resolve hit, fire aimed projectile. */
export function createAutoLockSystem({
  targetsRef,
  player,
  scene,
  effects,
  projectilesRef,
  onAutoLockHit,
  onFireAimed,
}) {
  let currentAutoLockTarget = null
  const tmpForward = new THREE.Vector3()
  const tmpToTarget = new THREE.Vector3()
  const tmpLaserOrigin = new THREE.Vector3()

  function ensureAutoLockState(target) {
    if (target.autoLock) return
    target.autoLock = {
      tracked: true,
      eligible: false,
      targeted: false,
    }
    attachAutoLockIndicator(target)
  }

  function updateEligibility(playerZ, instantLaserEnabled) {
    if (!instantLaserEnabled) return
    for (let i = 0; i < targetsRef.length; i += 1) {
      const t = targetsRef[i]
      ensureAutoLockState(t)
      if (
        !t.autoLock.eligible &&
        t.mesh.position.z - playerZ <= GAME_CONFIG.autoLockAcquireDistance
      ) {
        t.autoLock.eligible = true
      }
    }
  }

  function updateTargeting(playerZ, instantLaserEnabled) {
    if (!instantLaserEnabled) {
      currentAutoLockTarget = null
      for (let i = 0; i < targetsRef.length; i += 1) {
        const t = targetsRef[i]
        if (t.autoLock) t.autoLock.targeted = false
        if (t.autoLockIndicator) t.autoLockIndicator.visible = false
      }
      return
    }
    let best = null
    let bestDz = Infinity
    for (let i = 0; i < targetsRef.length; i += 1) {
      const t = targetsRef[i]
      const lock = t.autoLock
      if (!lock || !lock.eligible) continue
      lock.targeted = false
      const dz = t.mesh.position.z - playerZ
      if (dz < bestDz) {
        bestDz = dz
        best = t
      }
    }
    if (best?.autoLock) best.autoLock.targeted = true
    currentAutoLockTarget = best ?? null
    for (let i = 0; i < targetsRef.length; i += 1) {
      const t = targetsRef[i]
      if (t.autoLockIndicator) {
        t.autoLockIndicator.visible = Boolean(t.autoLock?.eligible && t.autoLock?.targeted)
      }
    }
  }

  function getCurrentAutoLockTarget() {
    return currentAutoLockTarget
  }

  function resolveAutoLockHit(target) {
    tmpLaserOrigin.copy(laserOriginOffset).applyQuaternion(player.group.quaternion).add(player.group.position)
    effects.addLaserBeam(tmpLaserOrigin, target.mesh.position, {
      color: GAME_CONFIG.laserBeamColor,
      opacity: 0.9,
    })
    if (onAutoLockHit) onAutoLockHit()
    scene.remove(target.mesh)
    if (target.shadow) scene.remove(target.shadow)
    const idx = targetsRef.indexOf(target)
    if (idx >= 0) targetsRef.splice(idx, 1)
    effects.addExplosion(target.mesh.position, { color: 0xfff1a6, radius: 0.6 })
    currentAutoLockTarget = null
  }

  function fireAimedProjectile(target, projectileSpeed = GAME_CONFIG.projectileSpeed) {
    const proj = createProjectile(false)
    proj.mesh.position.copy(laserOriginOffset).applyQuaternion(player.group.quaternion).add(player.group.position)
    tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
    tmpToTarget.copy(target.mesh.position).sub(proj.mesh.position).normalize()
    proj.velocity = tmpToTarget.clone().multiplyScalar(projectileSpeed)
    scene.add(proj.mesh)
    projectilesRef.push(proj)
    if (onFireAimed) onFireAimed(proj)
  }

  return {
    ensureAutoLockState,
    updateEligibility,
    updateTargeting,
    getCurrentAutoLockTarget,
    resolveAutoLockHit,
    fireAimedProjectile,
  }
}
