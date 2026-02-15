import * as THREE from 'three'

/** Central game design constants: bounds, speeds, timings, ship hit volume, laser, instant-laser lock, level mesh. */
export const GAME_CONFIG = {
  bounds: { x: 15.75, y: 10.5 },
  groundClearance: 0.4,
  baseSpeedX: 6.0,
  baseSpeedY: 6.0,
  forwardSpeed: 12,
  boostMultiplier: 4.0,
  brakeMultiplier: 0.1,
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
  laserMaxDistance: 120,
  levelWidth: 80,
}

/** loopForwardCarry = forwardSpeed * loopDuration (used for loop-the-loop path). */
export const loopForwardCarry = GAME_CONFIG.forwardSpeed * GAME_CONFIG.loopDuration

/** Ship collision volume: multiple spheres in ship-local space (paper-airplane shape). */
export const shipHitSpheres = [
  { offset: new THREE.Vector3(0, 0.1, 1.6), radius: 0.55 },
  { offset: new THREE.Vector3(0, 0.15, 0.3), radius: 0.9 },
  { offset: new THREE.Vector3(0, 0.12, -1.0), radius: 0.65 },
  { offset: new THREE.Vector3(-1.4, 0.0, 0.7), radius: 0.6 },
  { offset: new THREE.Vector3(1.4, 0.0, 0.7), radius: 0.6 },
]
