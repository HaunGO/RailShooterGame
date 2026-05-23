import * as THREE from 'three'

/** Central game design constants: bounds, speeds, timings, ship hit volume, laser, instant-laser lock, level mesh. */
export const GAME_CONFIG = {
  bounds: { x: 15.75, y: 10.5 },
  groundClearance: 0.4,
  baseSpeedX: 6.0,
  baseSpeedY: 6.0,
  forwardSpeed: 12,
  boostMultiplier: 4.0,
  /** Along-ship forward speed must exceed `tunedProjectileSpeed ×` this (while boosting) to count as hypersonic. */
  hypersonicBulletSpeedGate: 1.02,
  /** Extra camera FOV while hypersonic (degrees), before per-tier add. */
  hypersonicFovBoost: 8,
  /** Additional FOV per heat tier (0…2). */
  hypersonicFovPerTier: 3,
  /** Heat 0→1 per second while inside the hypersonic gate. */
  hypersonicHeatPerSec: 0.12,
  /** Heat decay per second when outside the gate. */
  hypersonicHeatDecayPerSec: 0.055,
  /** Tier thresholds on heat (0…1). */
  hypersonicTier1Heat: 0.34,
  hypersonicTier2Heat: 0.68,
  /** Exponential smoothing for gameplay blend (`1 - exp(-dt * k)`). */
  hypersonicBlendLerp: 7,
  /**
   * Slower lerp for hypersonic **visuals** (FOV, canvas warp, POV clip, speed lines). Lower = gentler ramp.
   */
  hypersonicFxBlendLerp: 1.75,
  /** Point value multiplier applied before combo mult while hypersonic (gate). */
  hypersonicHitPointScale: 1.25,
  /** Combo steps added per hit while hypersonic (cruise is +1). */
  hypersonicComboStep: 2,
  /** Flat score per tier level (0…2), added before combo mult on each hit in the gate. */
  hypersonicTierFlatBonus: 3,
  /** Extra fraction of base points from current heat (0…1), before combo mult, in the gate. */
  hypersonicHeatScoreFactor: 0.1,
  /** Projectile cooldown multiplier when in gate and tier ≥ 1 (faster refire). */
  hypersonicFireCooldownFactor: 0.86,
  brakeMultiplier: 0.1,
  /** World muzzle speed paired with default `forwardSpeed`; use `tunedProjectileSpeed()` when forward is retuned. */
  projectileSpeed: 45,
  laserBeamColor: 0x7cff2b,
  projectileCooldown: 0.18,
  playerHitInvuln: 1,
  barrelRollDuration: 1.0,
  barrelRollCooldownTime: 0.5,
  baseRollStrafeMultiplier: 1.6,
  loopDuration: 2.5,
  loopCooldownTime: 0.5,
  loopRadius: 7,
  loopBlendInDuration: 0.35,
  loopBlendOutDuration: 0,
  autoLockAcquireDistance: 75,
  /** Distance at which the crosshair (center crosshairs) is drawn; laser sight is capped to this length. */
  crosshairProjectionDistance: 25,
  /** Crosshair size in pixels; circle diameter and cross scale with this. */
  crosshairSize: 24,
  laserMaxDistance: 120,
  levelWidth: 80,
}

/** loopForwardCarry = forwardSpeed * loopDuration (used for loop-the-loop path). */
export const loopForwardCarry = GAME_CONFIG.forwardSpeed * GAME_CONFIG.loopDuration

/**
 * Bullet world speed from the player's tuned cruise forward speed, keeping the same ratio as the shipped defaults.
 * Boost only multiplies the ship, not muzzle velocity, so along +Z the ship can still move faster than shots — intentional.
 */
export function tunedProjectileSpeed(forwardSpeed) {
  return (GAME_CONFIG.projectileSpeed / GAME_CONFIG.forwardSpeed) * forwardSpeed
}

/** Laser / turret origin in ship local space (top of ship, forward of ridge). */
export const laserOriginOffset = new THREE.Vector3(0, 0.5, 0.85)

/** Scene clear / fallback background (must match renderer `setClearColor`). */
export const SCENE_CLEAR_COLOR = 0x0b1020

/** POV world video served from `public/video/` (Vite root URL). */
export const WORLD_VIDEO_URL = '/video/pov-sample.mp4'

/**
 * World video horizontal mirror: **1** = as decoded, **-1** = flip left/right (e.g. match flight feel).
 */
export const WORLD_VIDEO_MIRROR_X = 1

/**
 * Some phone / drone clips look vertically flipped in WebGL; toggle if the sky/ground feel inverted.
 * `VideoTexture.flipY` — `true` is Three’s default for many sources.
 */
export const WORLD_VIDEO_FLIP_Y = true

/** Camera-local −Z distance to the POV backdrop when zoom is off. */
export const WORLD_VIDEO_DISTANCE = 8

/** Closest the POV root moves at full slider (Inner dome on). Lower = harder “into” the clip. */
export const WORLD_VIDEO_DISTANCE_MIN = 0.62

/** At max slider + boost overshoot, lerp toward this (closer than `WORLD_VIDEO_DISTANCE_MIN`). */
export const WORLD_VIDEO_DISTANCE_MIN_BOOST = 0.34

/** Default `tuning.worldVideoDomeDepth` (~36% of slider — same feel as old 18/50). */
export const WORLD_VIDEO_DOME_DEPTH = 180

/** HUD slider maximum; zoom/bowl normalize by this so 500 = full push. */
export const WORLD_VIDEO_DOME_SLIDER_MAX = 500

/** Hard clamp for stored / runtime depth (allow a little past the slider). */
export const WORLD_VIDEO_DOME_DEPTH_HARD_MAX = 520

/**
 * Vertex bowl at full slider: max local Z recess ≈ `immersion * recess * this` (plane ±0.5).
 */
export const WORLD_VIDEO_DOME_BOWL_AMP_MAX = 1.62

/** At max depth + Inner dome: extra billboard scale past frustum fill (peripheral wrap). */
export const WORLD_VIDEO_OVERSCALE_MAX = 0.82

/** Extra overscale at full boost overshoot (multiplied by overshoot × zoomT). */
export const WORLD_VIDEO_OVERSCALE_BOOST_EXTRA = 0.95

/** At max depth, apply 100% of the distance lerp (was 0.96 — left a bit of “air” before). */
export const WORLD_VIDEO_ZOOM_LERP = 1

/**
 * Drive curve for zoom + bowl: `pow(linear, curve)` with linear = depth / SLIDER_MAX.
 * **< 1** = stronger effect in the mid–upper slider (same full strength at 500).
 */
export const WORLD_VIDEO_ZOOM_CURVE = 0.62

/** While E/boost is held, POV drive is `rawLinear × this`; past 1.0 = overshoot (closer, more wrap, stronger bowl). */
export const WORLD_VIDEO_BOOST_DOME_ZOOM_MUL = 2

/** POV clip playback when not in hypersonic presentation. */
export const WORLD_VIDEO_PLAYBACK_BASE = 1

/** Max `HTMLVideoElement.playbackRate` at hypersonic blend = 1 (before tier add). */
export const WORLD_VIDEO_HYPERSONIC_PLAYBACK_MAX = 1.58

/** Extra playback per hypersonic tier (0…2), added after blend lerp. */
export const WORLD_VIDEO_HYPERSONIC_PLAYBACK_TIER_ADD = 0.065

/** Max bowl multiplier from boost overshoot (1 = no extra). */
export const WORLD_VIDEO_BOWL_BOOST_MUL_MAX = 2.05

/** Safety clamp on combined bowl uniform. */
export const WORLD_VIDEO_BOWL_AMP_HARD_CAP = 3.5

/** Ship collision volume: multiple spheres in ship-local space (paper-airplane shape). */
export const shipHitSpheres = [
  { offset: new THREE.Vector3(0, 0.1, 1.6), radius: 0.55 },
  { offset: new THREE.Vector3(0, 0.15, 0.3), radius: 0.9 },
  { offset: new THREE.Vector3(0, 0.12, -1.0), radius: 0.65 },
  { offset: new THREE.Vector3(-1.4, 0.0, 0.7), radius: 0.6 },
  { offset: new THREE.Vector3(1.4, 0.0, 0.7), radius: 0.6 },
]
