/**
 * Orchestrates the game loop and subsystems. Creates core, entities, and systems;
 * runs input → flight → world wrap & spawns → crosshair/laser/shadows → fire →
 * projectiles & collisions → effects → camera & render.
 */
import * as THREE from 'three'
import {
  GAME_CONFIG,
  shipHitSpheres,
  laserOriginOffset,
  tunedProjectileSpeed,
  WORLD_VIDEO_DOME_DEPTH,
} from './config/constants.js'
import { createCore } from './core/renderer.js'
import { InputManager } from './input.js'
import { createPlayer } from './entities.js'
import { createEnvironment, updateEnvironment } from './systems/environment.js'
import { createLevelMesh } from './systems/levelMesh.js'
import { createShadowsSystem } from './systems/shadows.js'
import { createLaserSight } from './systems/laserSight.js'
import { createFlightSystem } from './systems/flight.js'
import { createAutoLockSystem } from './systems/autoLock.js'
import { createCrosshairSystem } from './systems/crosshair.js'
import { attachTargetHitbox, updateTargets } from './systems/targets.js'
import { tryFireProjectile, updateProjectiles } from './systems/projectiles.js'
import { createEffectsSystem } from './systems/effects.js'
import { createWingtipTrails } from './systems/wingtipTrails.js'
import { createHypersonicFx } from './systems/hypersonicFx.js'
import { createHypersonicState } from './systems/hypersonicState.js'
import { createHypersonicHud } from './systems/hypersonicHud.js'
import { unlockHypersonicAudio, playHypersonicTierUp } from './systems/hypersonicAudio.js'
import { createHypersonicSpeedLines } from './systems/hypersonicSpeedLines.js'
import { handleProjectileTargetCollisions, handleTargetShipCollisions } from './systems/collisions.js'
import { createScoreSystem } from './systems/score.js'
import { bindSettingsUI } from './ui/settingsBindings.js'

export function initGame({
  container,
  menuButton,
  toggleMouseButton,
  toggleCrosshairMouseButton,
  toggleTouchButton,
  toggleInstructionsButton,
  toggleInvertYButton,
  toggleHitboxesButton,
  toggleShadowsButton,
  toggleLevelMeshButton,
  toggleRailButton,
  toggleWorldVideoButton,
  toggleWorldImmersionButton,
  toggleLaserButton,
  toggleAutoLockButton,
  toggleAutoFireButton,
  toggleDebugButton,
  settings,
  onSettingsChange,
  touchControls,
  touchStick,
  touchFast,
  touchSlow,
  touchFire,
  touchLaser,
  touchRoll,
  tuning,
  worldView,
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
    crosshairFollowsMouse: resolvedSettings.crosshairFollowsMouse ?? resolvedSettings.reticleFollowsMouse ?? false,
    instructionsVisible: resolvedSettings.instructionsVisible ?? false,
    invertY: resolvedSettings.invertY ?? false,
    hitboxesEnabled: resolvedSettings.hitboxesEnabled ?? false,
    shadowsEnabled: resolvedSettings.shadowsEnabled ?? true,
    levelMeshEnabled: resolvedSettings.levelMeshEnabled ?? false,
    railVisible: resolvedSettings.railVisible !== false,
    worldVideoEnabled: resolvedSettings.worldVideoEnabled ?? false,
    worldVideoImmersionEnabled: resolvedSettings.worldVideoImmersionEnabled ?? false,
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
  const { renderer, scene, camera, canvas } = core

  // Simple "fly through" floor segments + optional POV world video backdrop.
  const envState = createEnvironment(scene, {
    camera,
    initialWorldVideoEnabled: state.worldVideoEnabled,
    initialWorldVideoImmersion: state.worldVideoImmersionEnabled,
    initialWorldVideoDomeDepth:
      resolvedSettings.tuning?.worldVideoDomeDepth ?? WORLD_VIDEO_DOME_DEPTH,
    initialRailVisible: state.railVisible,
  })

  const player = createPlayer()
  player.group.position.set(0, 0, 0)
  scene.add(player.group)

  const input = new InputManager({
    canvas: renderer.domElement,
    touchStick,
    touchFast,
    touchSlow,
    touchFire,
    touchLaser,
    touchRoll,
  })
  const tuningState = {
    speedX: resolvedSettings.tuning?.speedX ?? GAME_CONFIG.baseSpeedX,
    speedY: resolvedSettings.tuning?.speedY ?? GAME_CONFIG.baseSpeedY,
    forwardSpeed: resolvedSettings.tuning?.forwardSpeed ?? GAME_CONFIG.forwardSpeed,
    turnResponse: resolvedSettings.tuning?.turnResponse ?? 3.0,
    rollStrafeMultiplier:
      resolvedSettings.tuning?.rollStrafeMultiplier ?? GAME_CONFIG.baseRollStrafeMultiplier,
    camDistance: resolvedSettings.tuning?.camDistance ?? 10.0,
    camHeight: resolvedSettings.tuning?.camHeight ?? 1.8,
    worldVideoDomeDepth: resolvedSettings.tuning?.worldVideoDomeDepth ?? WORLD_VIDEO_DOME_DEPTH,
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
  const tmpShipVel = new THREE.Vector3()
  const tmpWorldFwd = new THREE.Vector3()

  const crosshairEl = document.querySelector('#crosshair')
  if (crosshairEl) crosshairEl.style.setProperty('--crosshair-size', `${GAME_CONFIG.crosshairSize}px`)
  const hudLaserSvg = document.querySelector('#hud-laser')
  const hudLaserLine = document.querySelector('#hud-laser-line')
  const updateCrosshair = createCrosshairSystem(renderer, camera)
  const effects = createEffectsSystem(scene)
  const scoreSystem = createScoreSystem(score ?? {})
  const hypersonicVignette = document.querySelector('#hypersonic-vignette')
  const hypersonicState = createHypersonicState()
  const hypersonicHud = createHypersonicHud({
    root: document.querySelector('#hypersonic-hud'),
    heatFill: document.querySelector('#hypersonic-heat-fill'),
    tierEl: document.querySelector('#hypersonic-tier'),
    streakEl: document.querySelector('#hypersonic-streak'),
  })
  const hypersonicFx = createHypersonicFx({ canvas, camera, vignetteEl: hypersonicVignette })
  const hypersonicSpeedLines = createHypersonicSpeedLines(document.querySelector('#hypersonic-speed-lines'))
  const unlockAudioOnce = () => unlockHypersonicAudio()
  container.addEventListener('pointerdown', unlockAudioOnce, { once: true })
  window.addEventListener('keydown', unlockAudioOnce, { once: true })
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

  const wingtipTrails = createWingtipTrails(scene)

  emitSettings = () => {
    if (!onSettingsChange) return
    onSettingsChange({
      mouseMode: state.mouseMode,
      touchMode: state.touchMode,
      crosshairFollowsMouse: state.crosshairFollowsMouse,
      instructionsVisible: state.instructionsVisible,
      invertY: state.invertY,
      hitboxesEnabled: state.hitboxesEnabled,
      shadowsEnabled: state.shadowsEnabled,
      levelMeshEnabled: state.levelMeshEnabled,
      railVisible: state.railVisible,
      worldVideoEnabled: state.worldVideoEnabled,
      worldVideoImmersionEnabled: state.worldVideoImmersionEnabled,
      laserEnabled: state.laserEnabled,
      instantLaserEnabled: state.instantLaserEnabled,
      autoFireEnabled: state.autoFireEnabled,
      debugEnabled: state.debugEnabled,
      tuning: {
        speedX: tuningState.speedX,
        speedY: tuningState.speedY,
        forwardSpeed: tuningState.forwardSpeed,
        turnResponse: tuningState.turnResponse,
        rollStrafeMultiplier: tuningState.rollStrafeMultiplier,
        mouseIntensity: mouseIntensityRef.value,
        camDistance: tuningState.camDistance,
        camHeight: tuningState.camHeight,
        worldVideoDomeDepth: tuningState.worldVideoDomeDepth,
      },
    })
  }

  bindSettingsUI({
    elements: {
      menuButton,
      toggleMouseButton,
      toggleCrosshairMouseButton,
      toggleTouchButton,
      toggleInstructionsButton,
      toggleInvertYButton,
      toggleHitboxesButton,
      toggleShadowsButton,
      toggleLevelMeshButton,
      toggleRailButton,
      toggleWorldVideoButton,
      toggleWorldImmersionButton,
      toggleLaserButton,
      toggleAutoLockButton,
      toggleAutoFireButton,
      toggleDebugButton,
      settingsPanel,
      instructionsEl,
      touchControls,
      tuning,
      worldView: worldView ?? {},
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
    onRailChange: (enabled) => {
      envState.setRailVisible(enabled)
    },
    onWorldVideoChange: (enabled) => {
      envState.setWorldVideoEnabled(enabled)
    },
    onWorldImmersionChange: (enabled) => {
      envState.setWorldVideoImmersion(enabled)
    },
    onWorldVideoDomeDepthChange: (depth) => {
      envState.setWorldVideoDomeDepth(depth)
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

      const followMouse =
        Boolean(state.crosshairFollowsMouse) && Boolean(usingMouseAim) && typeof aim?.x === 'number' && typeof aim?.y === 'number'

      const speedScale = inputState.boost.held
        ? GAME_CONFIG.boostMultiplier
        : inputState.brake.held
          ? GAME_CONFIG.brakeMultiplier
          : 1
      const projectileSpeed = tunedProjectileSpeed(tuningState.forwardSpeed)
      flight.getShipVelocity(tmpShipVel)
      tmpWorldFwd.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
      const speedAlongForward = tmpShipVel.dot(tmpWorldFwd)
      const h = hypersonicState.update(dt, {
        boostHeld: inputState.boost.held,
        speedAlongForward,
        projectileSpeed,
      })
      scoreSystem.syncHypersonicFrame({ raw: h.raw, heat: h.heat, tier: h.tier })
      if (h.tierUp && h.tier >= 1) playHypersonicTierUp(h.tier)
      hypersonicFx.update(h, dt)
      hypersonicSpeedLines.update(h)
      hypersonicHud.update(h)
      wingtipTrails.update(dt, player, speedScale, h.fxBlend ?? h.blend, h.tier)

      // World wrap (floor segments)
      updateEnvironment(envState, player.group.position.z)
      envState.updateWorldVideo(camera, {
        speedBoostHeld: inputState.boost.held,
        hypersonicBlend: h.fxBlend ?? h.blend,
        hypersonicTier: h.tier,
      })

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

      playerHitTimer = Math.max(0, playerHitTimer - dt)

      // Crosshair, laser sight, level mesh, shadows
      const crosshairOptions = followMouse
        ? { followMouse: true, mouseAim: { x: aim.x, y: aim.y } }
        : {}
      const crosshairTarget = updateCrosshair(crosshairEl, player, targets, crosshairOptions)
      if (crosshairTarget !== autoFireLockedTarget) {
        autoFireLockedTarget = crosshairTarget
        autoFirePendingTarget = crosshairTarget
      } else if (!crosshairTarget) {
        autoFirePendingTarget = null
      }
      if (state.laserEnabled) {
        if (followMouse && hudLaserSvg && hudLaserLine) {
          laserSight.setVisible(false)
          const rect = renderer.domElement.getBoundingClientRect()
          const halfW = rect.width / 2
          const halfH = rect.height / 2
          tmpToTarget.copy(laserOriginOffset).applyQuaternion(player.group.quaternion).add(player.group.position)
          tmpToTarget.project(camera)
          const sx = halfW + tmpToTarget.x * halfW
          const sy = halfH - tmpToTarget.y * halfH
          const ex = halfW + aim.x * halfW
          const ey = halfH + aim.y * halfH
          hudLaserSvg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
          hudLaserLine.setAttribute('x1', String(sx))
          hudLaserLine.setAttribute('y1', String(sy))
          hudLaserLine.setAttribute('x2', String(ex))
          hudLaserLine.setAttribute('y2', String(ey))
          hudLaserSvg.style.display = 'block'
        } else {
          laserSight.setVisible(true)
          laserSight.update(player, targets)
          if (hudLaserSvg) hudLaserSvg.style.display = 'none'
        }
      } else {
        laserSight.setVisible(false)
        if (hudLaserSvg) hudLaserSvg.style.display = 'none'
      }

      levelMesh.update(player.group.position)

      if (state.shadowsEnabled) {
        shadows.updatePositions(playerShadow, player.group.position, targets, envState.floorY)
      }

      // Fire: manual (space), instant laser (R), or auto-fire (crosshair on target)
      fireCooldown = Math.max(0, fireCooldown - dt)
      const wantsFire = inputState.fire.pressed || inputState.fire.held
      const wantsAutoFire = state.autoFireEnabled && autoFirePendingTarget
      const wantsAutoLock = inputState.laser.held
      const projectileCooldownEffective =
        GAME_CONFIG.projectileCooldown *
        (h.raw && h.tier >= 1 ? GAME_CONFIG.hypersonicFireCooldownFactor : 1)
      if (state.instantLaserEnabled && wantsAutoLock && fireCooldown <= 0) {
        const target = autoLock.getCurrentAutoLockTarget()
        if (target) {
          autoLock.resolveAutoLockHit(target)
          fireCooldown = projectileCooldownEffective
        }
      } else if (wantsAutoFire && fireCooldown <= 0) {
        autoLock.fireAimedProjectile(autoFirePendingTarget, projectileSpeed)
        autoFirePendingTarget = null
        fireCooldown = projectileCooldownEffective
      } else if (wantsFire && fireCooldown <= 0 && crosshairTarget) {
        // Crosshairs red = locked on target; fire is a guaranteed direct hit
        autoLock.fireAimedProjectile(crosshairTarget, projectileSpeed)
        fireCooldown = projectileCooldownEffective
      } else {
        fireCooldown = tryFireProjectile({
          state: inputState,
          fireCooldown,
          projectileCooldown: projectileCooldownEffective,
          projectileSpeed,
          player,
          camera,
          screenAim: followMouse ? aim : null,
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
        projectileSpeed,
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
