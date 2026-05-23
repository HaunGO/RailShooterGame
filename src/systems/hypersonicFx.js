import * as THREE from 'three'
import { GAME_CONFIG } from '../config/constants.js'

/**
 * Hypersonic presentation: FOV, canvas wash, optional vignette, subtle view shake on the canvas.
 * `snapshot` carries smoothed blend, heat, and tier from {@link createHypersonicState}.
 */
export function createHypersonicFx({ canvas, camera, vignetteEl }) {
  const baseFov = camera.fov
  let shakePhase = 0

  /**
 * @param {object} snapshot
 * @param {number} snapshot.blend
 * @param {number} snapshot.fxBlend Smoothed 0–1 for visuals (FOV / canvas warp); falls back to `blend`.
 * @param {number} snapshot.heat
 * @param {number} snapshot.tier
   * @param {number} dt
   */
  function update(snapshot, dt) {
    const s = THREE.MathUtils.clamp(snapshot.fxBlend ?? snapshot.blend, 0, 1)
    const heat = THREE.MathUtils.clamp(snapshot.heat, 0, 1)
    const tier = snapshot.tier ?? 0

    const fovBoost = GAME_CONFIG.hypersonicFovBoost + tier * GAME_CONFIG.hypersonicFovPerTier
    camera.fov = THREE.MathUtils.lerp(baseFov, baseFov + fovBoost, s)
    camera.updateProjectionMatrix()

    if (s < 0.02 && heat < 0.02) {
      canvas.style.filter = ''
      canvas.style.transform = ''
      if (vignetteEl) vignetteEl.style.opacity = '0'
      return
    }

    const haze = s * (0.85 + heat * 0.35)
    const blur = (0.22 + 0.22 * haze + tier * 0.06).toFixed(2)
    const sat = (1 + 0.42 * haze + tier * 0.08).toFixed(2)
    const con = (1 + 0.12 * haze + tier * 0.05).toFixed(2)
    const br = (1 + 0.07 * haze + heat * 0.06).toFixed(2)
    const hue = (tier * 4 * s).toFixed(1)
    canvas.style.filter = `blur(${blur}px) saturate(${sat}) contrast(${con}) brightness(${br}) hue-rotate(${hue}deg)`

    shakePhase += dt * (9 + tier * 5)
    const amp = (0.6 + tier * 0.45) * s * (0.35 + heat * 0.65)
    const sx = Math.sin(shakePhase * 1.7) * amp
    const sy = Math.cos(shakePhase * 2.1) * amp * 0.85
    canvas.style.transform = `translate(${sx.toFixed(2)}px,${sy.toFixed(2)}px)`

    if (vignetteEl) {
      const vig = THREE.MathUtils.clamp(0.1 + 0.38 * s + 0.22 * heat + tier * 0.06, 0, 0.92)
      vignetteEl.style.opacity = String(vig)
    }
  }

  function reset() {
    canvas.style.filter = ''
    canvas.style.transform = ''
    camera.fov = baseFov
    camera.updateProjectionMatrix()
    if (vignetteEl) vignetteEl.style.opacity = '0'
    shakePhase = 0
  }

  return { update, reset }
}
