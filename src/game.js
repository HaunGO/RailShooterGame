/**
 * Orchestrates the game loop and subsystems. Creates core, entities, and systems;
 * runs input → flight → world wrap & spawns → reticle/laser/shadows → fire →
 * projectiles & collisions → effects → camera & render.
 */
import * as THREE from 'three'
import { GAME_CONFIG, shipHitSpheres } from './config/constants.js'
import { createCore } from './core/renderer.js'
import { InputManager } from './input.js'
import { createPlayer } from './entities.js'
import { createEnvironment, updateEnvironment } from './systems/environment.js'
import { createLevelMesh } from './systems/levelMesh.js'
import { createShadowsSystem } from './systems/shadows.js'
import { createLaserSight } from './systems/laserSight.js'
import { createFlightSystem } from './systems/flight.js'
import { createAutoLockSystem } from './systems/autoLock.js'
import { createReticleSystem } from './systems/reticle.js'
import { attachTargetHitbox, updateTargets } from './systems/targets.js'
import { tryFireProjectile, updateProjectiles } from './systems/projectiles.js'
import { createEffectsSystem } from './systems/effects.js'
import { handleProjectileTargetCollisions, handleTargetShipCollisions } from './systems/collisions.js'
import { createScoreSystem } from './systems/score.js'
import { bindSettingsUI } from './ui/settingsBindings.js'

export function initGame({
  container,
  menuButton,
  toggleMouseButton,
  toggleTouchButton,
  toggleInstructionsButton,
  toggleInvertYButton,
  toggleHitboxesButton,
  toggleShadowsButton,
  toggleLevelMeshButton,
  toggleLaserButton,
  toggleAutoLockButton,
  toggleAutoFireButton,
  toggleDebugButton,
  settings,
  onSettingsChange,
  touchControls,
  touchStick,
  touchFire,
  touchRoll,
  tuning,
  score,
}) {
  const resolvedSettings = settings ?? {}
  const debugEl = document.querySelector('#debug')
  const settingsPanel = document.querySelector('#debug-panel')
  const instructionsEl = document.querySelector('#instructions')
  const state = {
    mouseMode: resolvedSettings.mouseMode ?? 'off',
    touchMode: (() => {
      const prefersTouch =
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
        'ontouchstart' in window
      const stored = resolvedSettings.touchMode ?? 'auto'
      return stored === 'auto' ? (prefersTouch ? 'stick' : 'off') : stored
    })(),
    settingsOpen: settingsPanel ? settingsPanel.dataset.open !== 'false' : true,
    instructionsVisible: resolvedSettings.instructionsVisible ?? false,
    invertY: resolvedSettings.invertY ?? false,
    hitboxesEnabled: resolvedSettings.hitboxesEnabled ?? false,
    shadowsEnabled: resolvedSettings.shadowsEnabled ?? true,
    levelMeshEnabled: resolvedSettings.levelMeshEnabled ?? false,
    laserEnabled: resolvedSettings.laserEnabled ?? true,
    instantLaserEnabled: resolvedSettings.instantLaserEnabled ?? true,
    autoFireEnabled: resolvedSettings.autoFireEnabled ?? false,
    debugEnabled: resolvedSettings.debugEnabled ?? false,
  }
  if (debugEl) {
    debugEl.style.display = state.debugEnabled ? 'block' : 'none'
  }

  // Ensure the host container actually has a size.
  container.style.position = 'relative'
  container.style.width = '100vw'
  container.style.height = '100vh'

  const core = createCore(container, debugEl)
  if (!core) return
  const { renderer, scene, camera } = core

  // Simple "fly through" floor segments for motion cues.
  const envState = createEnvironment(scene)

  const player = createPlayer()
  player.group.position.set(0, 0, 0)
  scene.add(player.group)

  const input = new InputManager({
    canvas: renderer.domElement,
    touchStick,
    touchFire,
    touchRoll,
  })
  const tuningState = {
    speedX: resolvedSettings.tuning?.speedX ?? GAME_CONFIG.baseSpeedX,
    speedY: resolvedSettings.tuning?.speedY ?? GAME_CONFIG.baseSpeedY,
    turnResponse: resolvedSettings.tuning?.turnResponse ?? 3.0,
    rollStrafeMultiplier:
      resolvedSettings.tuning?.rollStrafeMultiplier ?? GAME_CONFIG.baseRollStrafeMultiplier,
    camDistance: resolvedSettings.tuning?.camDistance ?? 10.0,
    camHeight: resolvedSettings.tuning?.camHeight ?? 1.8,
  }
  const mouseIntensityRef = { value: resolvedSettings.tuning?.mouseIntensity ?? 6.0 }
  input.setMouseMode(state.mouseMode)
  input.setTouchMode(state.touchMode)
  let emitSettings = () => {}
  const bounds = GAME_CONFIG.bounds
  const minY = envState.floorY + GAME_CONFIG.groundClearance
  let fireCooldown = 0
  let nextShotId = 1
  let nextExpectedHitId = 1
  const projectiles = []
  const targets = []
  let targetSpawnTimer = 0
  let playerHitTimer = 0
  const tmpSphereCenter = new THREE.Vector3()
  const tmpToTarget = new THREE.Vector3()

  const reticleEl = document.querySelector('#reticle')
  const updateReticle = createReticleSystem(renderer, camera)
  const effects = createEffectsSystem(scene)
  const scoreSystem = createScoreSystem(score ?? {})
  const flight = createFlightSystem({ player, bounds, minY })
  const autoLock = createAutoLockSystem({
    targetsRef: targets,
    player,
    scene,
    effects,
    projectilesRef: projectiles,
    onAutoLockHit: () => {
      const shotId = nextShotId
      nextShotId += 1
      if (shotId !== nextExpectedHitId) scoreSystem.resetCombo()
      scoreSystem.addHit(10)
      nextExpectedHitId = Math.max(nextExpectedHitId, shotId + 1)
    },
    onFireAimed: (proj) => {
      proj.shotId = nextShotId
      nextShotId += 1
    },
  })
  let autoFireLockedTarget = null
  let autoFirePendingTarget = null
  const shipHitboxGroup = new THREE.Group()
  for (let i = 0; i < shipHitSpheres.length; i += 1) {
    const sphere = shipHitSpheres[i]
    const hb = new THREE.Mesh(
      new THREE.SphereGeometry(sphere.radius, 10, 10),
      new THREE.MeshBasicMaterial({
        color: 0x2a8f86,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
      })
    )
    hb.position.copy(sphere.offset)
    shipHitboxGroup.add(hb)
  }
  shipHitboxGroup.visible = state.hitboxesEnabled
  player.group.add(shipHitboxGroup)

  const refreshTargetHitboxes = () => {
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i]
      if (state.hitboxesEnabled) {
        attachTargetHitbox(t)
        t.hitbox.visible = true
      } else if (t.hitbox) {
        t.hitbox.visible = false
      }
    }
  }

  const shadows = createShadowsSystem(scene)
  const playerShadow = shadows.addPlayerShadow()
  playerShadow.setVisible(state.shadowsEnabled)

  const laserSight = createLaserSight(scene)
  laserSight.setEnabled(state.laserEnabled)

  const levelMesh = createLevelMesh(scene, envState)
  levelMesh.setVisible(state.levelMeshEnabled)

  emitSettings = () => {
    if (!onSettingsChange) return
    onSettingsChange({
      mouseMode: state.mouseMode,
      touchMode: state.touchMode,
      instructionsVisible: state.instructionsVisible,
      invertY: state.invertY,
      hitboxesEnabled: state.hitboxesEnabled,
      shadowsEnabled: state.shadowsEnabled,
      levelMeshEnabled: state.levelMeshEnabled,
      laserEnabled: state.laserEnabled,
      instantLaserEnabled: state.instantLaserEnabled,
      autoFireEnabled: state.autoFireEnabled,
      debugEnabled: state.debugEnabled,
      tuning: {
        speedX: tuningState.speedX,
        speedY: tuningState.speedY,
        turnResponse: tuningState.turnResponse,
        rollStrafeMultiplier: tuningState.rollStrafeMultiplier,
        mouseIntensity: mouseIntensityRef.value,
        camDistance: tuningState.camDistance,
        camHeight: tuningState.camHeight,
      },
    })
  }

  bindSettingsUI({
    elements: {
      menuButton,
      toggleMouseButton,
      toggleTouchButton,
      toggleInstructionsButton,
      toggleInvertYButton,
      toggleHitboxesButton,
      toggleShadowsButton,
      toggleLevelMeshButton,
      toggleLaserButton,
      toggleAutoLockButton,
      toggleAutoFireButton,
      toggleDebugButton,
      settingsPanel,
      instructionsEl,
      touchControls,
      tuning,
    },
    state,
    tuningState,
    mouseIntensityRef,
    input,
    emitSettings,
    onHitboxesChange: (enabled) => {
      shipHitboxGroup.visible = enabled
      refreshTargetHitboxes()
    },
    onShadowsChange: (enabled) => {
      playerShadow.setVisible(enabled)
      shadows.refreshTargetShadows(targets, enabled)
    },
    onLevelMeshChange: (enabled) => {
      levelMesh.setVisible(enabled)
    },
    onLaserChange: (enabled) => {
      laserSight.setEnabled(enabled)
    },
    debugEl,
  })

  let frame = 0
  let last = performance.now()
  function loop(now) {
    try {
      // Clamp dt to avoid spiral/overshoot on lag spikes.
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      frame += 1

      // Input & movement
      input.update()
      const inputState = input.getState()
      const { steer, aim, usingMouseAim } = inputState
      flight.update(dt, inputState, tuningState, state.invertY)

      // World wrap (floor segments)
      updateEnvironment(envState, player.group.position.z)

      // Spawn & auto-lock state
      targetSpawnTimer = updateTargets({
        targets,
        scene,
        bounds,
        minY,
        playerZ: player.group.position.z,
        dt,
        targetSpawnTimer,
        hitboxesEnabled: state.hitboxesEnabled,
        shadowsEnabled: state.shadowsEnabled,
        shadowMaterial: shadows.shadowMaterial,
        floorY: envState.floorY,
        onSpawn: (target) => {
          autoLock.ensureAutoLockState(target)
        },
      })
      autoLock.updateEligibility(player.group.position.z, state.instantLaserEnabled)
      autoLock.updateTargeting(player.group.position.z, state.instantLaserEnabled)

      // Player flicker on hit (visual feedback only).
      playerHitTimer = Math.max(0, playerHitTimer - dt)
      if (playerHitTimer > 0) {
        const flicker = Math.floor(playerHitTimer * 30) % 2 === 0
        player.group.visible = flicker
      } else {
        player.group.visible = true
      }

      // Reticle, laser sight, level mesh, shadows
      const reticleTarget = updateReticle(reticleEl, player, targets)
      if (reticleTarget !== autoFireLockedTarget) {
        autoFireLockedTarget = reticleTarget
        autoFirePendingTarget = reticleTarget
      } else if (!reticleTarget) {
        autoFirePendingTarget = null
      }
      if (state.laserEnabled) {
        laserSight.update(player, targets)
      }

      levelMesh.update(player.group.position)

      if (state.shadowsEnabled) {
        shadows.updatePositions(playerShadow, player.group.position, targets, envState.floorY)
      }

      // Fire: manual (space), instant laser (R), or auto-fire (reticle on target)
      fireCooldown = Math.max(0, fireCooldown - dt)
      const wantsFire = inputState.fire.pressed || inputState.fire.held
      const wantsAutoFire = state.autoFireEnabled && autoFirePendingTarget
      const wantsAutoLock = inputState.laser.held
      if (state.instantLaserEnabled && wantsAutoLock && fireCooldown <= 0) {
        const target = autoLock.getCurrentAutoLockTarget()
        if (target) {
          autoLock.resolveAutoLockHit(target)
          fireCooldown = GAME_CONFIG.projectileCooldown
        }
      } else if (wantsAutoFire && fireCooldown <= 0) {
        autoLock.fireAimedProjectile(autoFirePendingTarget)
        autoFirePendingTarget = null
        fireCooldown = GAME_CONFIG.projectileCooldown
      } else {
        fireCooldown = tryFireProjectile({
          state: inputState,
          fireCooldown,
          projectileCooldown: GAME_CONFIG.projectileCooldown,
          projectileSpeed: GAME_CONFIG.projectileSpeed,
          player,
          projectiles,
          scene,
          onFire: (proj) => {
            proj.shotId = nextShotId
            nextShotId += 1
          },
        })
      }

      // Projectiles (move forward, cull past player)
      updateProjectiles({
        projectiles,
        scene,
        dt,
        playerZ: player.group.position.z,
        projectileSpeed: GAME_CONFIG.projectileSpeed,
        onMiss: (projectile) => {
          const shotId = projectile?.shotId
          if (typeof shotId !== 'number') {
            scoreSystem.resetCombo()
            return
          }
          if (shotId >= nextExpectedHitId) {
            scoreSystem.resetCombo()
            nextExpectedHitId = shotId + 1
          }
        },
      })

      // Projectile vs target collisions (simple radius check).
      handleProjectileTargetCollisions({
        targets,
        projectiles,
        scene,
        effects,
        onHit: (_target, projectile) => {
          const shotId = projectile?.shotId
          if (typeof shotId !== 'number') {
            scoreSystem.addHit(10)
            return
          }
          // Combo requires hits in shot order; nextExpectedHitId enforces that.
          if (shotId !== nextExpectedHitId) {
            scoreSystem.resetCombo()
          }
          scoreSystem.addHit(10)
          nextExpectedHitId = Math.max(nextExpectedHitId, shotId + 1)
        },
      })

      const shipHit = handleTargetShipCollisions({
        targets,
        scene,
        player,
        shipHitSpheres,
        tmpSphereCenter,
        tmpToTarget,
        playerHitTimer,
        playerHitInvuln: GAME_CONFIG.playerHitInvuln,
        effects,
      })
      playerHitTimer = shipHit.playerHitTimer
      if (shipHit.hit) scoreSystem.resetCombo()
      laserSight.clearHighlightIfTargetGone(targets)

      effects.update(dt)

      // Camera behind ship, looking forward
      const horizon = new THREE.Vector3(player.group.position.x, player.group.position.y, player.group.position.z + 25)
      camera.position.set(
        player.group.position.x,
        player.group.position.y + tuningState.camHeight,
        player.group.position.z - tuningState.camDistance
      )
      camera.lookAt(horizon)

      if (debugEl && state.debugEnabled) {
        const cp = new THREE.Vector3()
        camera.getWorldPosition(cp)
        const rect = renderer.domElement.getBoundingClientRect()
        const info = renderer.info.render
        const gl = renderer.getContext()
        const glErr = gl.getError()
        debugEl.textContent =
          `frame=${frame} dt=${dt.toFixed(3)} mouse=${usingMouseAim ? 1 : 0} steer=(${steer.x.toFixed(
            2
          )},${steer.y.toFixed(2)}) aim=(${aim.x.toFixed(
            2
          )},${aim.y.toFixed(2)}) ` +
          `cam=(${cp.x.toFixed(1)},${cp.y.toFixed(1)},${cp.z.toFixed(1)}) ` +
          `calls=${info.calls} tris=${info.triangles} ` +
          `glErr=${glErr} ` +
          `canvasPx=${renderer.domElement.width}x${renderer.domElement.height} rect=${Math.round(
            rect.width
          )}x${Math.round(rect.height)}`
      }

      renderer.render(scene, camera)
      requestAnimationFrame(loop)
    } catch (err) {
      if (debugEl && state.debugEnabled) {
        debugEl.textContent = `loop error: ${err?.message ?? String(err)}`
      }
    }
  }

  function onResize() {
    const width = window.innerWidth
    const height = window.innerHeight
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  window.addEventListener('resize', onResize)
  requestAnimationFrame(loop)
}
