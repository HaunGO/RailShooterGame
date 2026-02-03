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

  // Simple "fly through" floor segments for motion cues.
  const env = new THREE.Group()
  scene.add(env)

  const floorY = -2
  const segmentLength = 40
  const segmentCount = 10
  const floorWidth = 28
  const floorSegments = []

  for (let i = 0; i < segmentCount; i += 1) {
    const mat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0x141c33 : 0x10182d,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    })
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(floorWidth, segmentLength, 1, 1), mat)
    seg.rotation.x = -Math.PI / 2
    seg.position.set(0, floorY, i * segmentLength)
    env.add(seg)
    floorSegments.push(seg)
  }

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
  const minY = floorY + groundClearance
  const baseSpeedX = 3.0 // units/sec
  const baseSpeedY = 3.0 // units/sec
  const forwardSpeed = 12 // units/sec (auto-forward rail)
  const projectileSpeed = 35
  const projectileCooldown = 0.12
  let fireCooldown = 0
  const projectiles = []

  const reticleEl = document.querySelector('#reticle')
  const tmpForward = new THREE.Vector3()
  const tmpPoint = new THREE.Vector3()
  const tmpNdc = new THREE.Vector3()

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
      const wrapBehindZ = player.group.position.z - segmentLength
      for (let i = 0; i < floorSegments.length; i += 1) {
        const seg = floorSegments[i]
        if (seg.position.z < wrapBehindZ) {
          seg.position.z += segmentLength * segmentCount
        }
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
      if (reticleEl) {
        const rect = renderer.domElement.getBoundingClientRect()
        const halfW = rect.width / 2
        const halfH = rect.height / 2

        tmpForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
        tmpPoint.copy(player.group.position).addScaledVector(tmpForward, 25) // "where the nose points"

        tmpNdc.copy(tmpPoint).project(camera) // NDC: x,y in [-1,1], z in [-1,1]
        const padding = 12

        // If boresight is behind camera, hide reticle.
        if (tmpNdc.z < -1 || tmpNdc.z > 1) {
          reticleEl.style.opacity = '0'
        } else {
          reticleEl.style.opacity = '1'
          let xPx = tmpNdc.x * halfW
          let yPx = -tmpNdc.y * halfH
          xPx = THREE.MathUtils.clamp(xPx, -halfW + padding, halfW - padding)
          yPx = THREE.MathUtils.clamp(yPx, -halfH + padding, halfH - padding)
          reticleEl.style.transform = `translate(calc(-50% + ${xPx}px), calc(-50% + ${yPx}px))`
        }
      }

      // Fire (space)
      fireCooldown = Math.max(0, fireCooldown - dt)
      if (state.fire.pressed && fireCooldown <= 0) {
        const proj = createProjectile(false)
        proj.mesh.position.copy(player.group.position)
        proj.mesh.position.z += 2.2
        // Shoot along the ship's current forward direction.
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
        // Add rail speed so bullets always move forward relative to the ship.
        proj.velocity = forward.multiplyScalar(projectileSpeed + forwardSpeed)
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
