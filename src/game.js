import * as THREE from 'three'
import { InputManager } from './input.js'
import { createPlayer, createProjectile } from './entities.js'

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

  const grid = new THREE.GridHelper(20, 20, 0x2a3355, 0x1a223a)
  grid.position.y = -2
  scene.add(grid)

  const player = createPlayer()
  player.group.position.set(0, 0, 0)
  scene.add(player.group)

  const input = new InputManager({ canvas: renderer.domElement, touchStick: null, touchFire: null })
  let mouseAimEnabled = true
  if (toggleMouseButton) {
    toggleMouseButton.textContent = mouseAimEnabled ? 'Mouse Aim: On' : 'Mouse Aim: Off'
    toggleMouseButton.addEventListener('click', () => {
      mouseAimEnabled = !mouseAimEnabled
      input.setMouseEnabled(mouseAimEnabled)
      toggleMouseButton.textContent = mouseAimEnabled ? 'Mouse Aim: On' : 'Mouse Aim: Off'
    })
  }
  const bounds = { x: 6, y: 3.5 }
  const baseSpeedX = 7.5 // units/sec
  const baseSpeedY = 7.5 // units/sec
  const projectileSpeed = 35
  const projectileCooldown = 0.12
  let fireCooldown = 0
  const projectiles = []

  const reticleEl = document.querySelector('#reticle')
  const aimMaxPx = 110

  const tuningState = {
    speedX: baseSpeedX,
    speedY: baseSpeedY,
    turnResponse: 0.07,
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
      if (tuning.turnResponseVal) tuning.turnResponseVal.textContent = tuningState.turnResponse.toFixed(2)
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

      if (reticleEl) {
        reticleEl.style.transform = `translate(calc(-50% + ${aim.x * aimMaxPx}px), calc(-50% + ${aim.y * aimMaxPx}px))`
      }

      // Movement
      // X: keep current "feels correct" mapping.
      const xInput = -steer.x
      // Y: keyboard/gamepad are "flight inverted", mouse is "screen direct".
      const yInput = usingMouseAim ? -steer.y : steer.y
      player.group.position.x += xInput * tuningState.speedX * dt
      player.group.position.y += yInput * tuningState.speedY * dt

      player.group.position.x = THREE.MathUtils.clamp(player.group.position.x, -bounds.x, bounds.x)
      player.group.position.y = THREE.MathUtils.clamp(player.group.position.y, -bounds.y, bounds.y)

      // Orientation: make the ship "point" where you're aiming/steering.
      const yawMax = usingMouseAim ? 0.55 : 0.32
      const pitchMax = usingMouseAim ? 0.45 : 0.4
      const rollMax = usingMouseAim ? 0.75 : 0.42
      const rotLerp = usingMouseAim ? 0.12 : tuningState.turnResponse

      // Match heading to actual movement X direction.
      const targetYaw = xInput * yawMax
      const pitchSign = usingMouseAim ? 1 : -1
      const targetPitch = pitchSign * aim.y * pitchMax
      // Bank into the turn (move right => clockwise bank on screen).
      const targetRoll = -xInput * rollMax

      player.group.rotation.y = THREE.MathUtils.lerp(player.group.rotation.y, targetYaw, rotLerp)
      player.group.rotation.x = THREE.MathUtils.lerp(player.group.rotation.x, targetPitch, rotLerp)
      player.group.rotation.z = THREE.MathUtils.lerp(player.group.rotation.z, targetRoll, rotLerp)

      // Fire (space)
      fireCooldown = Math.max(0, fireCooldown - dt)
      if (state.fire.pressed && fireCooldown <= 0) {
        const proj = createProjectile(false)
        proj.mesh.position.copy(player.group.position)
        proj.mesh.position.z += 2.2
        // Shoot along the ship's current forward direction.
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
        proj.velocity = forward.multiplyScalar(projectileSpeed)
        scene.add(proj.mesh)
        projectiles.push(proj)
        fireCooldown = projectileCooldown
      }

      // Update projectiles (forward +Z)
      for (let i = projectiles.length - 1; i >= 0; i -= 1) {
        const p = projectiles[i]
        if (p.velocity) {
          p.mesh.position.x += p.velocity.x * dt
          p.mesh.position.y += p.velocity.y * dt
          p.mesh.position.z += p.velocity.z * dt
        } else {
          p.mesh.position.z += projectileSpeed * dt
        }
        if (p.mesh.position.z > player.group.position.z + 120) {
          scene.remove(p.mesh)
          projectiles.splice(i, 1)
        }
      }

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
