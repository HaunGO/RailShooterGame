import * as THREE from 'three'
import { InputManager } from './input.js'
import { createPlayer } from './entities.js'
import { createEnvironment, updateEnvironment } from './systems/environment.js'
import { createReticleSystem } from './systems/reticle.js'
import { attachTargetHitbox, updateTargets } from './systems/targets.js'
import { tryFireProjectile, updateProjectiles } from './systems/projectiles.js'
import { createEffectsSystem } from './systems/effects.js'
import { handleProjectileTargetCollisions, handleTargetShipCollisions } from './systems/collisions.js'
import { createScoreSystem } from './systems/score.js'

export function initGame({
  container,
  toggleMouseButton,
  toggleHitboxesButton,
  toggleShadowsButton,
  toggleLevelMeshButton,
  toggleDebugButton,
  tuning,
  score,
}) {
  const debugEl = document.querySelector('#debug')
  let debugEnabled = false
  if (debugEl) {
    debugEl.style.display = 'none'
  }

  // Ensure the host container actually has a size.
  container.style.position = 'relative'
  container.style.width = '100vw'
  container.style.height = '100vh'

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      preserveDrawingBuffer: false,
    })
  } catch (err) {
    if (debugEl) {
      debugEl.textContent = `WebGLRenderer failed: ${err?.message ?? String(err)}`
    }
    return
  }

  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(0x0b1020, 1)
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.left = '0'
  renderer.domElement.style.top = '0'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.zIndex = '1'
  renderer.domElement.id = 'three-canvas'
  container.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b1020)

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500)
  camera.position.set(0, 1.8, -10)

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6)
  keyLight.position.set(6, 10, -6)
  scene.add(keyLight)
  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  scene.add(new THREE.HemisphereLight(0xbad3ff, 0x203050, 0.45))

  // Simple "fly through" floor segments for motion cues.
  const envState = createEnvironment(scene)

  const player = createPlayer()
  player.group.position.set(0, 0, 0)
  scene.add(player.group)

  const input = new InputManager({ canvas: renderer.domElement, touchStick: null, touchFire: null })
  let mouseMode = 'off'
  input.setMouseMode(mouseMode)
  if (toggleMouseButton) {
    const updateLabel = () => {
      toggleMouseButton.textContent =
        mouseMode === 'off' ? 'Mouse Aim: Off' : mouseMode === 'direct' ? 'Mouse Aim: Direct' : 'Mouse Aim: On'
    }
    updateLabel()
    toggleMouseButton.addEventListener('click', () => {
      mouseMode = mouseMode === 'off' ? 'normal' : mouseMode === 'normal' ? 'direct' : 'off'
      input.setMouseMode(mouseMode)
      updateLabel()
    })
  }
  const bounds = { x: 15.75, y: 10.5 }
  const groundClearance = 0.4
  const minY = envState.floorY + groundClearance
  const baseSpeedX = 6.0 // units/sec
  const baseSpeedY = 6.0 // units/sec
  const forwardSpeed = 12 // units/sec (auto-forward rail)
  const boostMultiplier = 4.0
  const brakeMultiplier = 0.1
  const projectileSpeed = 35
  const projectileCooldown = 0.12
  let fireCooldown = 0
  const projectiles = []
  const targets = []
  let targetSpawnTimer = 0
  let playerHitTimer = 0
  const playerHitInvuln = 0.6
  let barrelRollTimer = 0
  let barrelRollDir = 0
  let barrelRollStartZ = 0
  let barrelRollCooldown = 0
  const barrelRollDuration = 1.0
  const barrelRollCooldownTime = 0.25
  const baseRollStrafeMultiplier = 1.6
  // Approximate the paper-airplane shape with multiple spheres in ship-local space.
  const shipHitSpheres = [
    { offset: new THREE.Vector3(0, 0.1, 1.6), radius: 0.55 }, // nose
    { offset: new THREE.Vector3(0, 0.15, 0.3), radius: 0.9 }, // center mass
    { offset: new THREE.Vector3(0, 0.12, -1.0), radius: 0.65 }, // tail
    { offset: new THREE.Vector3(-1.4, 0.0, 0.7), radius: 0.6 }, // left wing
    { offset: new THREE.Vector3(1.4, 0.0, 0.7), radius: 0.6 }, // right wing
  ]
  const tmpSphereCenter = new THREE.Vector3()
  const tmpToTarget = new THREE.Vector3()

  const reticleEl = document.querySelector('#reticle')
  const updateReticle = createReticleSystem(renderer, camera)
  const effects = createEffectsSystem(scene)
  const scoreSystem = createScoreSystem(score ?? {})
  const shipVelocity = new THREE.Vector3()
  let hitboxesEnabled = false
  let shadowsEnabled = true
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
  shipHitboxGroup.visible = hitboxesEnabled
  player.group.add(shipHitboxGroup)

  const refreshTargetHitboxes = () => {
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i]
      if (hitboxesEnabled) {
        attachTargetHitbox(t)
        t.hitbox.visible = true
      } else if (t.hitbox) {
        t.hitbox.visible = false
      }
    }
  }

  if (toggleHitboxesButton) {
    toggleHitboxesButton.textContent = hitboxesEnabled ? 'Hitboxes: On' : 'Hitboxes: Off'
    toggleHitboxesButton.addEventListener('click', () => {
      hitboxesEnabled = !hitboxesEnabled
      shipHitboxGroup.visible = hitboxesEnabled
      refreshTargetHitboxes()
      toggleHitboxesButton.textContent = hitboxesEnabled ? 'Hitboxes: On' : 'Hitboxes: Off'
    })
  }

  const playerShadow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), shadowMaterial)
  playerShadow.rotation.x = -Math.PI / 2
  playerShadow.visible = shadowsEnabled
  scene.add(playerShadow)

  let levelMeshEnabled = true
  const levelWidth = 80
  const levelSegments = []
  for (let i = 0; i < envState.segmentCount; i += 1) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(levelWidth, envState.segmentLength, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.set(0, 0, i * envState.segmentLength)
    scene.add(plane)

    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(levelWidth, envState.segmentLength, 20, 10),
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
  setLevelMeshVisible(levelMeshEnabled)

  const refreshTargetShadows = () => {
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i]
      if (shadowsEnabled) {
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

  if (toggleShadowsButton) {
    toggleShadowsButton.textContent = shadowsEnabled ? 'Shadows: On' : 'Shadows: Off'
    toggleShadowsButton.addEventListener('click', () => {
      shadowsEnabled = !shadowsEnabled
      playerShadow.visible = shadowsEnabled
      refreshTargetShadows()
      toggleShadowsButton.textContent = shadowsEnabled ? 'Shadows: On' : 'Shadows: Off'
    })
  }

  if (toggleLevelMeshButton) {
    toggleLevelMeshButton.textContent = levelMeshEnabled ? 'Level Mesh: On' : 'Level Mesh: Off'
    toggleLevelMeshButton.addEventListener('click', () => {
      levelMeshEnabled = !levelMeshEnabled
      setLevelMeshVisible(levelMeshEnabled)
      toggleLevelMeshButton.textContent = levelMeshEnabled ? 'Level Mesh: On' : 'Level Mesh: Off'
    })
  }

  if (toggleDebugButton && debugEl) {
    const updateLabel = () => {
      toggleDebugButton.textContent = debugEnabled ? 'Debug: On' : 'Debug: Off'
      debugEl.style.display = debugEnabled ? 'block' : 'none'
      if (debugEnabled) debugEl.textContent = 'starting…'
    }
    updateLabel()
    toggleDebugButton.addEventListener('click', () => {
      debugEnabled = !debugEnabled
      updateLabel()
    })
  }

  const tuningState = {
    speedX: baseSpeedX,
    speedY: baseSpeedY,
    // UI scale 1..10. We'll map it to an internal lerp factor.
    turnResponse: 3.0,
    rollStrafeMultiplier: baseRollStrafeMultiplier,
    camDistance: 10.0,
    camHeight: 1.8,
  }

  if (tuning?.speedX) {
    const sync = () => {
      tuningState.speedX = Number(tuning.speedX.value)
      if (tuning.speedXVal) tuning.speedXVal.textContent = tuningState.speedX.toFixed(1)
    }
    tuning.speedX.addEventListener('input', sync)
    sync()
  }
  if (tuning?.speedY) {
    const sync = () => {
      tuningState.speedY = Number(tuning.speedY.value)
      if (tuning.speedYVal) tuning.speedYVal.textContent = tuningState.speedY.toFixed(1)
    }
    tuning.speedY.addEventListener('input', sync)
    sync()
  }
  if (tuning?.turnResponse) {
    const sync = () => {
      tuningState.turnResponse = Number(tuning.turnResponse.value)
      if (tuning.turnResponseVal) tuning.turnResponseVal.textContent = tuningState.turnResponse.toFixed(1)
    }
    tuning.turnResponse.addEventListener('input', sync)
    sync()
  }
  if (tuning?.rollStrafe) {
    const sync = () => {
      tuningState.rollStrafeMultiplier = Number(tuning.rollStrafe.value)
      if (tuning.rollStrafeVal) tuning.rollStrafeVal.textContent = tuningState.rollStrafeMultiplier.toFixed(1)
    }
    tuning.rollStrafe.addEventListener('input', sync)
    sync()
  }
  if (tuning?.mouseTightness) {
    const sync = () => {
      const value = Number(tuning.mouseTightness.value)
      if (tuning.mouseTightnessVal) tuning.mouseTightnessVal.textContent = value.toFixed(1)
      input.setMouseDirectSensitivity(value)
    }
    tuning.mouseTightness.addEventListener('input', sync)
    sync()
  }
  if (tuning?.camDistance) {
    const sync = () => {
      const value = Number(tuning.camDistance.value)
      tuningState.camDistance = value
      if (tuning.camDistanceVal) tuning.camDistanceVal.textContent = value.toFixed(1)
    }
    tuning.camDistance.addEventListener('input', sync)
    sync()
  }
  if (tuning?.camHeight) {
    const sync = () => {
      const value = Number(tuning.camHeight.value)
      tuningState.camHeight = value
      if (tuning.camHeightVal) tuning.camHeightVal.textContent = value.toFixed(1)
    }
    tuning.camHeight.addEventListener('input', sync)
    sync()
  }

  let frame = 0
  let last = performance.now()
  function loop(now) {
    try {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      frame += 1

      input.update()
      const state = input.getState()
      const { steer, aim, usingMouseAim } = state

      // Movement
      // X: keep current "feels correct" mapping.
      const xInput = -steer.x
      // Y: keyboard/gamepad are "flight inverted", mouse is "screen direct".
      const yInput = usingMouseAim ? -steer.y : steer.y
      const speedScale = state.boost.held ? boostMultiplier : state.brake.held ? brakeMultiplier : 1
      const rollStrafe =
        barrelRollTimer > 0 && barrelRollDir !== 0
          ? tuningState.rollStrafeMultiplier * -barrelRollDir
          : 0
      shipVelocity.set(
        xInput * tuningState.speedX + rollStrafe * tuningState.speedX,
        yInput * tuningState.speedY,
        forwardSpeed * speedScale
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
        hitboxesEnabled,
        shadowsEnabled,
        shadowMaterial,
        floorY: envState.floorY,
      })

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
      const pitchSign = usingMouseAim ? 1 : -1
      const targetPitch = pitchSign * aim.y * pitchMax
      // Bank into the turn (move right => clockwise bank on screen).
      const targetRoll = -xInput * rollMax

      // Barrel roll (Shift + Left/Right).
      barrelRollCooldown = Math.max(0, barrelRollCooldown - dt)
      if (barrelRollTimer <= 0 && barrelRollCooldown <= 0 && state.roll.held) {
        if (state.steer.x <= -0.6) {
          barrelRollTimer = barrelRollDuration
          barrelRollDir = -1
          barrelRollStartZ = player.group.rotation.z
          barrelRollCooldown = barrelRollCooldownTime
        } else if (state.steer.x >= 0.6) {
          barrelRollTimer = barrelRollDuration
          barrelRollDir = 1
          barrelRollStartZ = player.group.rotation.z
          barrelRollCooldown = barrelRollCooldownTime
        }
      }
      if (barrelRollTimer > 0) {
        barrelRollTimer = Math.max(0, barrelRollTimer - dt)
      }
      const rollPhase = barrelRollTimer > 0 ? 1 - barrelRollTimer / barrelRollDuration : 0
      const easedPhase = rollPhase * rollPhase * (3 - 2 * rollPhase)
      // Full roll = 360° rotation.
      const barrelRollOffset = barrelRollTimer > 0 ? barrelRollDir * easedPhase * Math.PI * 2 : 0

      player.group.rotation.y = THREE.MathUtils.lerp(player.group.rotation.y, targetYaw, rotLerp)
      player.group.rotation.x = THREE.MathUtils.lerp(player.group.rotation.x, targetPitch, rotLerp)
      if (barrelRollTimer > 0) {
        player.group.rotation.z = barrelRollStartZ + barrelRollOffset
      } else {
        const wrapped = ((player.group.rotation.z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const nearest = wrapped > Math.PI ? wrapped - Math.PI * 2 : wrapped
        player.group.rotation.z = THREE.MathUtils.lerp(nearest, targetRoll, rotLerp)
      }

      // Reticle = ship boresight (nose direction) projected to screen.
      updateReticle(reticleEl, player)
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

      if (shadowsEnabled) {
        playerShadow.position.set(player.group.position.x, envState.floorY + 0.02, player.group.position.z)
        for (let i = 0; i < targets.length; i += 1) {
          const t = targets[i]
          if (t.shadow) {
            t.shadow.position.set(t.mesh.position.x, envState.floorY + 0.02, t.mesh.position.z)
          }
        }
      }

      // Fire (space)
      fireCooldown = Math.max(0, fireCooldown - dt)
      fireCooldown = tryFireProjectile({
        state,
        fireCooldown,
        projectileCooldown,
        projectileSpeed,
        player,
        projectiles,
        scene,
      })

      // Update projectiles (forward +Z)
      updateProjectiles({
        projectiles,
        scene,
        dt,
        playerZ: player.group.position.z,
        projectileSpeed,
      })

      // Projectile vs target collisions (simple radius check).
      handleProjectileTargetCollisions({
        targets,
        projectiles,
        scene,
        effects,
        onHit: () => scoreSystem.addHit(10),
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
        playerHitInvuln,
        effects,
      })
      playerHitTimer = shipHit.playerHitTimer
      if (shipHit.hit) scoreSystem.resetCombo()

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

      if (debugEl && debugEnabled) {
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
      if (debugEl && debugEnabled) {
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
