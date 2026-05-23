import * as THREE from 'three'
import { GAME_CONFIG } from '../config/constants.js'

/**
 * Hypersonic gate (boost + nose faster than bullets), presentation blend, heat/tier for gameplay.
 * While in the gate, heat stays max (no ramp-up / time meter). `fxBlend` eases in/out for visuals.
 */
export function createHypersonicState() {
  let blend = 0
  let fxBlend = 0
  let heat = 0
  let raw = false
  let prevTier = 0

  function update(dt, { boostHeld, speedAlongForward, projectileSpeed }) {
    const g = GAME_CONFIG.hypersonicBulletSpeedGate
    raw = boostHeld && speedAlongForward > projectileSpeed * g

    if (raw) {
      heat = 1
    } else {
      heat = Math.max(0, heat - dt * GAME_CONFIG.hypersonicHeatDecayPerSec)
    }

    const k = 1 - Math.exp(-dt * GAME_CONFIG.hypersonicBlendLerp)
    blend = THREE.MathUtils.lerp(blend, raw ? 1 : 0, k)

    const kFx = 1 - Math.exp(-dt * GAME_CONFIG.hypersonicFxBlendLerp)
    fxBlend = THREE.MathUtils.lerp(fxBlend, raw ? 1 : 0, kFx)

    const tier =
      heat < GAME_CONFIG.hypersonicTier1Heat ? 0 : heat < GAME_CONFIG.hypersonicTier2Heat ? 1 : 2
    const tierUp = tier > prevTier
    prevTier = tier

    return { raw, blend, fxBlend, heat, tier, tierUp }
  }

  return { update }
}
