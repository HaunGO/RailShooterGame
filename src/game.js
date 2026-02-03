import * as THREE from 'three'
import { InputManager } from './input.js'
import { createPlayer } from './entities.js'
import { createEnvironment, updateEnvironment } from './systems/environment.js'
import { createReticleSystem } from './systems/reticle.js'
import { updateTargets } from './systems/targets.js'
import { tryFireProjectile, updateProjectiles } from './systems/projectiles.js'
import { createEffectsSystem } from './systems/effects.js'
import { handleProjectileTargetCollisions, handleTargetShipCollisions } from './systems/collisions.js'

export function initGame({ container, toggleMouseButton, tuning }) {
  const debugEl = document.querySelector('#debug')
  const debugEnabled = new URLSearchParams(window.location.search).has('debug')
  if (debugEl && !debugEnabled) debugEl.style.display = 'none'
  if (debugEl && debugEnabled) debugEl.textContent = 'starting…'

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
  let mouseAimEnabled = false
  input.setMouseEnabled(mouseAimEnabled)
  if (toggleMouseButton) {
    toggleMouseButton.textContent = mouseAimEnabled ? 'Mouse Aim: On' : 'Mouse Aim: Off'
    toggleMouseButton.addEventListener('click', () => {
      mouseAimEnabled = !mouseAimEnabled
      input.setMouseEnabled(mouseAimEnabled)
      toggleMouseButton.textContent = mouseAimEnabled ? 'Mouse Aim: On' : 'Mouse Aim: Off'
    })
  }
  const bounds = { x: 7.5, y: 7.0 }
  const groundClearance = 0.4
  const minY = envState.floorY + groundClearance
  const baseSpeedX = 3.0 // units/sec
  const baseSpeedY = 3.0 // units/sec
  const forwardSpeed = 12 // units/sec (auto-forward rail)
  const projectileSpeed = 35
  const projectileCooldown = 0.12
  let fireCooldown = 0
  const projectiles = []
  const targets = []
  let targetSpawnTimer = 0
  let playerHitTimer = 0
  const playerHitInvuln = 0.6
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

  const tuningState = {
    speedX: baseSpeedX,
    speedY: baseSpeedY,
    // UI scale 1..10. We'll map it to an internal lerp factor.
    turnResponse: 3.0,
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
      player.group.position.x += xInput * tuningState.speedX * dt
      player.group.position.y += yInput * tuningState.speedY * dt
      player.group.position.z += forwardSpeed * dt

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

      player.group.rotation.y = THREE.MathUtils.lerp(player.group.rotation.y, targetYaw, rotLerp)
      player.group.rotation.x = THREE.MathUtils.lerp(player.group.rotation.x, targetPitch, rotLerp)
      player.group.rotation.z = THREE.MathUtils.lerp(player.group.rotation.z, targetRoll, rotLerp)

      // Reticle = ship boresight (nose direction) projected to screen.
      updateReticle(reticleEl, player)

      // Fire (space)
      fireCooldown = Math.max(0, fireCooldown - dt)
      fireCooldown = tryFireProjectile({
        state,
        fireCooldown,
        projectileCooldown,
        projectileSpeed,
        forwardSpeed,
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
      handleProjectileTargetCollisions({ targets, projectiles, scene, effects })

      // Target hits ship (multi-sphere). Despawn target + flicker ship + impact flash.
      playerHitTimer = handleTargetShipCollisions({
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

      // Update explosions.
      effects.update(dt)

      // (bank/pitch handled above in the "Orientation" block)

      // Camera behind ship, looking forward toward the horizon.
      const horizon = new THREE.Vector3(player.group.position.x, player.group.position.y, player.group.position.z + 25)
      camera.position.set(player.group.position.x, player.group.position.y + 1.8, player.group.position.z - 10)
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
