import * as THREE from 'three'
import { GAME_CONFIG, loopForwardCarry, shipHitSpheres } from './config/constants.js'
import { createCore } from './core/renderer.js'
import { InputManager } from './input.js'
import { createPlayer, createProjectile } from './entities.js'
import { createEnvironment, updateEnvironment } from './systems/environment.js'
import { createReticleSystem } from './systems/reticle.js'
import { attachAutoLockIndicator, attachTargetHitbox, updateTargets } from './systems/targets.js'
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
    autoLockEnabled: resolvedSettings.autoLockEnabled ?? true,
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
  let barrelRollTimer = 0
  let barrelRollDir = 0
  let barrelRollStartZ = 0
  let barrelRollCooldown = 0
  let loopTimer = 0
  let loopDir = 0
  let loopCooldown = 0
  let loopWasActive = false
  let loopPitchPrev = 0
  let loopBlendInTimer = 0
  let loopStartPitch = 0
  const loopBlendStartPos = new THREE.Vector3()
  let loopBlendOutTimer = 0
  let loopEndPitch = 0
  let loopEndRoll = 0
  const loopStartPos = new THREE.Vector3()
  const loopForward = new THREE.Vector3()
  const loopRight = new THREE.Vector3()
  const loopWorldUp = new THREE.Vector3(0, 1, 0)
  const tmpSphereCenter = new THREE.Vector3()
  const tmpToTarget = new THREE.Vector3()
  const tmpForward = new THREE.Vector3()
  const tmpLaserOrigin = new THREE.Vector3()
  const tmpLaserEnd = new THREE.Vector3()
  const tmpLoopOffset = new THREE.Vector3()
  const tmpLoopTarget = new THREE.Vector3()

  const reticleEl = document.querySelector('#reticle')
  const updateReticle = createReticleSystem(renderer, camera)
  const effects = createEffectsSystem(scene)
  const scoreSystem = createScoreSystem(score ?? {})
  const shipVelocity = new THREE.Vector3()
  let currentAutoLockTarget = null
  let autoFireLockedTarget = null
  let autoFirePendingTarget = null
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
  })

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

  const playerShadow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), shadowMaterial)
  playerShadow.rotation.x = -Math.PI / 2
  playerShadow.visible = state.shadowsEnabled
  scene.add(playerShadow)

  const laserLineGeometry = new THREE.BufferGeometry()
  laserLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3))
  const laserLine = new THREE.Line(
    laserLineGeometry,
    new THREE.LineBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.65 })
  )
  laserLine.frustumCulled = false
  laserLine.visible = state.laserEnabled
  scene.add(laserLine)
  const laserHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4a4a, transparent: true, opacity: 0.9 })
  )
  laserHit.visible = false
  scene.add(laserHit)
  const laserRaycaster = new THREE.Raycaster()
  laserRaycaster.far = GAME_CONFIG.laserMaxDistance
  let laserTarget = null

  const clearLaserHighlight = () => {
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

  const applyLaserHighlight = (target) => {
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

  const levelSegments = []
  for (let i = 0; i < envState.segmentCount; i += 1) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(GAME_CONFIG.levelWidth, envState.segmentLength, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.set(0, 0, i * envState.segmentLength)
    scene.add(plane)

    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(GAME_CONFIG.levelWidth, envState.segmentLength, 20, 10),
      new THREE.MeshBasicMaterial({
        color: 0x5ac8ff,
        wireframe: true,
        transparent: true,
        opacity: 0.03,
      })
    )
    grid.rotation.x = -Math.PI / 2
    grid.position.set(0, 0.01, i * envState.segmentLength)
    scene.add(grid)

    levelSegments.push({ plane, grid })
  }
  const setLevelMeshVisible = (value) => {
    for (let i = 0; i < levelSegments.length; i += 1) {
      levelSegments[i].plane.visible = value
      levelSegments[i].grid.visible = value
    }
  }
  setLevelMeshVisible(state.levelMeshEnabled)

  const refreshTargetShadows = () => {
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i]
      if (state.shadowsEnabled) {
        if (!t.shadow) {
          t.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), shadowMaterial)
          t.shadow.rotation.x = -Math.PI / 2
          scene.add(t.shadow)
        }
        t.shadow.visible = true
      } else if (t.shadow) {
        t.shadow.visible = false
      }
    }
  }

  const ensureAutoLockState = (target) => {
    if (target.autoLock) return
    target.autoLock = {
      tracked: true,
      eligible: false,
      targeted: false,
    }
    attachAutoLockIndicator(target)
  }

  const updateAutoLockEligibility = (playerZ) => {
    if (!state.autoLockEnabled) return
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i]
      ensureAutoLockState(t)
      if (!t.autoLock.eligible && t.mesh.position.z - playerZ <= GAME_CONFIG.autoLockAcquireDistance) {
        t.autoLock.eligible = true
      }
    }
  }

  const updateAutoLockTargeting = (playerZ) => {
    if (!state.autoLockEnabled) {
      currentAutoLockTarget = null
      for (let i = 0; i < targets.length; i += 1) {
        const t = targets[i]
        if (t.autoLock) t.autoLock.targeted = false
        if (t.autoLockIndicator) t.autoLockIndicator.visible = false
      }
      return
    }
    let best = null
    let bestDz = Infinity
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i]
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
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i]
      if (t.autoLockIndicator) {
        t.autoLockIndicator.visible = Boolean(t.autoLock?.eligible && t.autoLock?.targeted)
      }
    }
  }

  const resolveAutoLockHit = (target) => {
    tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
    tmpLaserOrigin.copy(player.group.position).addScaledVector(tmpForward, 1.3)
    effects.addLaserBeam(tmpLaserOrigin, target.mesh.position, { color: GAME_CONFIG.laserBeamColor, opacity: 0.9 })
    const shotId = nextShotId
    nextShotId += 1
    if (shotId !== nextExpectedHitId) {
      scoreSystem.resetCombo()
    }
    scoreSystem.addHit(10)
    nextExpectedHitId = Math.max(nextExpectedHitId, shotId + 1)
    scene.remove(target.mesh)
    if (target.shadow) scene.remove(target.shadow)
    const idx = targets.indexOf(target)
    if (idx >= 0) targets.splice(idx, 1)
    effects.addExplosion(target.mesh.position, { color: 0xfff1a6, radius: 0.6 })
  }

  const fireAimedProjectile = (target) => {
    const proj = createProjectile(false)
    tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
    proj.mesh.position.copy(player.group.position).addScaledVector(tmpForward, 2.2)
    tmpToTarget.copy(target.mesh.position).sub(proj.mesh.position).normalize()
    proj.velocity = tmpToTarget.clone().multiplyScalar(GAME_CONFIG.projectileSpeed)
    scene.add(proj.mesh)
    projectiles.push(proj)
    proj.shotId = nextShotId
    nextShotId += 1
  }

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
      autoLockEnabled: state.autoLockEnabled,
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
      playerShadow.visible = enabled
      refreshTargetShadows()
    },
    onLevelMeshChange: (enabled) => {
      setLevelMeshVisible(enabled)
    },
    onLaserChange: (enabled) => {
      laserLine.visible = enabled
      if (!enabled) {
        laserHit.visible = false
        clearLaserHighlight()
      }
    },
    debugEl,
  })

  let frame = 0
  let last = performance.now()
  function loop(now) {
    try {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      frame += 1

      input.update()
      const inputState = input.getState()
      const { steer, aim, usingMouseAim } = inputState

      // Movement
      // X: keep current "feels correct" mapping.
      const xInput = -steer.x
      // Y: default is screen/direct (up = nose up). Invert toggles flight-style.
      const yInput = state.invertY ? steer.y : -steer.y
      const speedScale = inputState.boost.held ? GAME_CONFIG.boostMultiplier : inputState.brake.held ? GAME_CONFIG.brakeMultiplier : 1
      const rollStrafe =
        barrelRollTimer > 0 && barrelRollDir !== 0
          ? tuningState.rollStrafeMultiplier * -barrelRollDir
          : 0
      shipVelocity.set(
        xInput * tuningState.speedX + rollStrafe * tuningState.speedX,
        yInput * tuningState.speedY,
        GAME_CONFIG.forwardSpeed * speedScale
      )
      player.group.position.x += shipVelocity.x * dt
      player.group.position.y += shipVelocity.y * dt
      player.group.position.z += shipVelocity.z * dt

      player.group.position.x = THREE.MathUtils.clamp(player.group.position.x, -bounds.x, bounds.x)
      // Treat the floor as solid ground (can't go below it).
      player.group.position.y = THREE.MathUtils.clamp(player.group.position.y, minY, bounds.y)

      // Recycle floor segments to stay ahead of the ship.
      updateEnvironment(envState, player.group.position.z)

      // Spawn simple targets ahead of the ship.
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
        shadowMaterial,
        floorY: envState.floorY,
        onSpawn: (target) => {
          ensureAutoLockState(target)
        },
      })
      updateAutoLockEligibility(player.group.position.z)
      updateAutoLockTargeting(player.group.position.z)

      // Player flicker on hit (visual feedback only).
      playerHitTimer = Math.max(0, playerHitTimer - dt)
      if (playerHitTimer > 0) {
        const flicker = Math.floor(playerHitTimer * 30) % 2 === 0
        player.group.visible = flicker
      } else {
        player.group.visible = true
      }

      // Orientation: make the ship "point" where you're aiming/steering.
      const yawMax = usingMouseAim ? 0.55 : 0.32
      const pitchMax = usingMouseAim ? 0.45 : 0.4
      const rollMax = usingMouseAim ? 0.75 : 0.42
      // Map turn response (1..10) to stable lerp range (0.03..0.18).
      const tr01 = THREE.MathUtils.clamp((tuningState.turnResponse - 1) / 9, 0, 1)
      const rotLerp = usingMouseAim ? 0.12 : THREE.MathUtils.lerp(0.03, 0.18, tr01)

      // Match heading to actual movement X direction.
      const targetYaw = xInput * yawMax
      const targetPitch = -yInput * pitchMax
      // Bank into the turn (move right => clockwise bank on screen).
      const targetRoll = -xInput * rollMax

      // Barrel roll (Shift + Left/Right).
      barrelRollCooldown = Math.max(0, barrelRollCooldown - dt)
      if (barrelRollTimer <= 0 && barrelRollCooldown <= 0 && inputState.roll.held) {
        const rollThreshold = usingMouseAim ? 0.1 : 0.6
        if (inputState.steer.x <= -rollThreshold) {
          barrelRollTimer = GAME_CONFIG.barrelRollDuration
          barrelRollDir = -1
          barrelRollStartZ = player.group.rotation.z
          barrelRollCooldown = GAME_CONFIG.barrelRollCooldownTime
        } else if (inputState.steer.x >= rollThreshold) {
          barrelRollTimer = GAME_CONFIG.barrelRollDuration
          barrelRollDir = 1
          barrelRollStartZ = player.group.rotation.z
          barrelRollCooldown = GAME_CONFIG.barrelRollCooldownTime
        }
      }
      // Loop (Shift + Up). Uses motion angle to add a spiral bias.
      loopCooldown = Math.max(0, loopCooldown - dt)
      const loopThreshold = usingMouseAim ? 0.3 : 0.55
      if (
        loopTimer <= 0 &&
        loopCooldown <= 0 &&
        barrelRollTimer <= 0 &&
        inputState.roll.held &&
        yInput >= loopThreshold
      ) {
        loopTimer = GAME_CONFIG.loopDuration
        loopDir = -1
        loopStartPos.copy(player.group.position)
        loopBlendStartPos.copy(player.group.position)
        loopForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
        loopRight.crossVectors(loopForward, loopWorldUp).normalize()
        loopPitchPrev = player.group.rotation.x
        loopStartPitch = player.group.rotation.x
        loopBlendInTimer = GAME_CONFIG.loopBlendInDuration
        loopBlendOutTimer = 0
        loopCooldown = GAME_CONFIG.loopCooldownTime
      }
      if (barrelRollTimer > 0) {
        barrelRollTimer = Math.max(0, barrelRollTimer - dt)
      }
      const wasLooping = loopTimer > 0
      if (loopTimer > 0) {
        loopTimer = Math.max(0, loopTimer - dt)
        if (loopTimer === 0) {
          loopEndPitch = player.group.rotation.x
          loopEndRoll = player.group.rotation.z
          loopBlendOutTimer = 0
        }
      }
      if (loopBlendInTimer > 0) {
        loopBlendInTimer = Math.max(0, loopBlendInTimer - dt)
      }
      if (loopBlendOutTimer > 0) {
        loopBlendOutTimer = Math.max(0, loopBlendOutTimer - dt)
      }
      loopWasActive = wasLooping
      const rollPhase = barrelRollTimer > 0 ? 1 - barrelRollTimer / GAME_CONFIG.barrelRollDuration : 0
      const easedPhase = rollPhase * rollPhase * (3 - 2 * rollPhase)
      // Full roll = 360° rotation.
      const barrelRollOffset = barrelRollTimer > 0 ? barrelRollDir * easedPhase * Math.PI * 2 : 0
      const loopPhase = loopTimer > 0 ? 1 - loopTimer / GAME_CONFIG.loopDuration : 0
      const loopPhaseEased = loopPhase * loopPhase * (3 - 2 * loopPhase)
      const loopTheta = loopPhase * Math.PI * 2
      const loopBlendIn = GAME_CONFIG.loopBlendInDuration > 0 ? 1 - loopBlendInTimer / GAME_CONFIG.loopBlendInDuration : 1
      const loopBlendT = Math.min(1, Math.max(0, loopBlendIn))
      const loopBlendScale = loopBlendT * loopBlendT * (3 - 2 * loopBlendT)
      player.group.rotation.y = THREE.MathUtils.lerp(player.group.rotation.y, targetYaw, rotLerp)
      if (loopTimer > 0) {
        const dTheta = 0.02
        const theta2 = Math.min(loopTheta + dTheta, Math.PI * 2)
        const phase2 = theta2 / (Math.PI * 2)
        const verticalOffset = GAME_CONFIG.loopRadius * (1 - Math.cos(loopTheta))
        const forwardOffset = GAME_CONFIG.loopRadius * Math.sin(loopTheta) * -loopDir + loopForwardCarry * loopPhase
        const verticalOffset2 = GAME_CONFIG.loopRadius * (1 - Math.cos(theta2))
        const forwardOffset2 = GAME_CONFIG.loopRadius * Math.sin(theta2) * -loopDir + loopForwardCarry * phase2
        tmpLoopOffset
          .copy(loopStartPos)
          .addScaledVector(loopForward, forwardOffset)
          .addScaledVector(loopWorldUp, verticalOffset)
        const tmpLoopOffset2 = tmpForward
          .copy(loopStartPos)
          .addScaledVector(loopForward, forwardOffset2)
          .addScaledVector(loopWorldUp, verticalOffset2)
        const tangent = tmpLoopOffset2.sub(tmpLoopOffset).normalize()
        let desiredX = -Math.atan2(tangent.y, tangent.dot(loopForward))
        // Hold current pitch briefly, then ease into the loop pitch.
        const holdPhase = 0.1
        if (loopPhase < holdPhase) {
          desiredX = loopStartPitch
        } else {
          const rampT = Math.min(1, (loopPhase - holdPhase) / 0.25)
          const ramp = rampT * rampT * (3 - 2 * rampT)
          desiredX = loopStartPitch + (desiredX - loopStartPitch) * ramp
        }
        let adjusted = desiredX
        while (adjusted - loopPitchPrev > Math.PI) adjusted -= Math.PI * 2
        while (adjusted - loopPitchPrev < -Math.PI) adjusted += Math.PI * 2
        loopPitchPrev = adjusted
        player.group.rotation.x = THREE.MathUtils.lerp(loopStartPitch, adjusted, loopBlendScale)
      } else if (loopBlendOutTimer > 0) {
        const t = 1 - loopBlendOutTimer / GAME_CONFIG.loopBlendOutDuration
        const blend = t * t * (3 - 2 * t)
        let adjustedTarget = targetPitch
        while (adjustedTarget - loopEndPitch > Math.PI) adjustedTarget -= Math.PI * 2
        while (adjustedTarget - loopEndPitch < -Math.PI) adjustedTarget += Math.PI * 2
        player.group.rotation.x = THREE.MathUtils.lerp(loopEndPitch, adjustedTarget, blend)
      } else {
        if (loopWasActive) {
          let adjusted = player.group.rotation.x
          while (adjusted - targetPitch > Math.PI) adjusted -= Math.PI * 2
          while (adjusted - targetPitch < -Math.PI) adjusted += Math.PI * 2
          player.group.rotation.x = adjusted
        }
        player.group.rotation.x = THREE.MathUtils.lerp(player.group.rotation.x, targetPitch, rotLerp)
      }
      if (barrelRollTimer > 0) {
        player.group.rotation.z = barrelRollStartZ + barrelRollOffset
      } else if (loopTimer > 0) {
        const spiralRoll = Math.sin(loopTheta * 2) * 0.25 * Math.max(0.2, Math.abs(xInput))
        const wrapped = ((player.group.rotation.z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const nearest = wrapped > Math.PI ? wrapped - Math.PI * 2 : wrapped
        player.group.rotation.z = THREE.MathUtils.lerp(nearest, targetRoll + spiralRoll, rotLerp)
      } else if (loopBlendOutTimer > 0) {
        const t = 1 - loopBlendOutTimer / GAME_CONFIG.loopBlendOutDuration
        const blend = t * t * (3 - 2 * t)
        let adjustedTarget = targetRoll
        while (adjustedTarget - loopEndRoll > Math.PI) adjustedTarget -= Math.PI * 2
        while (adjustedTarget - loopEndRoll < -Math.PI) adjustedTarget += Math.PI * 2
        player.group.rotation.z = THREE.MathUtils.lerp(loopEndRoll, adjustedTarget, blend)
      } else {
        const wrapped = ((player.group.rotation.z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const nearest = wrapped > Math.PI ? wrapped - Math.PI * 2 : wrapped
        player.group.rotation.z = THREE.MathUtils.lerp(nearest, targetRoll, rotLerp)
      }

      if (loopTimer > 0) {
        const spiralBias = Math.sin(loopTheta * 2) * xInput
        const verticalOffset = GAME_CONFIG.loopRadius * (1 - Math.cos(loopTheta))
        const forwardOffset = GAME_CONFIG.loopRadius * Math.sin(loopTheta) * -loopDir + loopForwardCarry * loopPhase
        tmpLoopTarget
          .copy(loopStartPos)
          .addScaledVector(loopForward, forwardOffset)
          .addScaledVector(loopWorldUp, verticalOffset)
          .addScaledVector(loopRight, spiralBias * GAME_CONFIG.loopRadius * 0.35)
        if (loopBlendScale < 1) {
          tmpLoopOffset.copy(loopBlendStartPos).lerp(tmpLoopTarget, loopBlendScale)
          player.group.position.copy(tmpLoopOffset)
        } else {
          player.group.position.copy(tmpLoopTarget)
        }
      }

      // Reticle = ship boresight (nose direction) projected to screen.
      const reticleTarget = updateReticle(reticleEl, player, targets)
      if (reticleTarget !== autoFireLockedTarget) {
        autoFireLockedTarget = reticleTarget
        autoFirePendingTarget = reticleTarget
      } else if (!reticleTarget) {
        autoFirePendingTarget = null
      }
      if (state.laserEnabled) {
        // Laser sight: ray from nose to closest target (or max distance).
        tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
        tmpLaserOrigin.copy(player.group.position).addScaledVector(tmpForward, 1.3)
        laserRaycaster.set(tmpLaserOrigin, tmpForward)
        const targetMeshes = targets.map((t) => t.mesh)
        const hits = targetMeshes.length > 0 ? laserRaycaster.intersectObjects(targetMeshes, false) : []
        if (hits.length > 0) {
          const hit = hits[0]
          tmpLaserEnd.copy(hit.point)
          laserHit.position.copy(hit.point)
          laserHit.visible = true
          if (laserTarget !== hit.object.__targetRef) {
            clearLaserHighlight()
          }
          if (!hit.object.__targetRef) {
            hit.object.__targetRef = targets.find((t) => t.mesh === hit.object) || null
          }
          if (hit.object.__targetRef) {
            laserTarget = hit.object.__targetRef
            applyLaserHighlight(laserTarget)
          }
        } else {
          tmpLaserEnd.copy(tmpLaserOrigin).addScaledVector(tmpForward, GAME_CONFIG.laserMaxDistance)
          laserHit.visible = false
          clearLaserHighlight()
        }
        const laserPos = laserLine.geometry.attributes.position
        laserPos.setXYZ(0, tmpLaserOrigin.x, tmpLaserOrigin.y, tmpLaserOrigin.z)
        laserPos.setXYZ(1, tmpLaserEnd.x, tmpLaserEnd.y, tmpLaserEnd.z)
        laserPos.needsUpdate = true
      }

      // Keep the plane level synced to ship height, but not locked to ship X.
      // This makes the ship "pass over" the grid as it strafes.
      const levelWrapBehindZ = player.group.position.z - envState.segmentLength
      for (let i = 0; i < levelSegments.length; i += 1) {
        const seg = levelSegments[i]
        seg.plane.position.y = player.group.position.y - 0.01
        seg.grid.position.y = player.group.position.y
        if (seg.plane.position.z < levelWrapBehindZ) {
          const offset = envState.segmentLength * envState.segmentCount
          seg.plane.position.z += offset
          seg.grid.position.z += offset
        }
      }

      if (state.shadowsEnabled) {
        playerShadow.position.set(player.group.position.x, envState.floorY + 0.02, player.group.position.z)
        for (let i = 0; i < targets.length; i += 1) {
          const t = targets[i]
          if (t.shadow) {
            t.shadow.position.set(t.mesh.position.x, envState.floorY + 0.02, t.mesh.position.z)
          }
        }
      }

      // Fire (space) / Auto-lock (R by default)
      fireCooldown = Math.max(0, fireCooldown - dt)
      const wantsFire = inputState.fire.pressed || inputState.fire.held
      const wantsAutoFire = state.autoFireEnabled && autoFirePendingTarget
      const wantsAutoLock = inputState.laser.held
      if (state.autoLockEnabled && wantsAutoLock && fireCooldown <= 0) {
        const target = currentAutoLockTarget
        if (target) {
          resolveAutoLockHit(target)
          currentAutoLockTarget = null
          fireCooldown = GAME_CONFIG.projectileCooldown
        }
      } else if (wantsAutoFire && fireCooldown <= 0) {
        fireAimedProjectile(autoFirePendingTarget)
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

      // Update projectiles (forward +Z)
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
          if (shotId !== nextExpectedHitId) {
            scoreSystem.resetCombo()
          }
          scoreSystem.addHit(10)
          nextExpectedHitId = Math.max(nextExpectedHitId, shotId + 1)
        },
      })

      // Target hits ship (multi-sphere). Despawn target + flicker ship + impact flash.
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
      if (laserTarget && !targets.includes(laserTarget)) {
        clearLaserHighlight()
      }

      // Update explosions.
      effects.update(dt)

      // (bank/pitch handled above in the "Orientation" block)

      // Camera behind ship, looking forward toward the horizon.
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
