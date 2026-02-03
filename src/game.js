import * as THREE from 'three'
import { InputManager } from './input.js'
import { createPlayer, createProjectile } from './entities.js'

export function initGame({ container }) {
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
  const bounds = { x: 6, y: 3.5 }
  const moveSpeed = 7.5 // units/sec
  const projectileSpeed = 35
  const projectileCooldown = 0.12
  let fireCooldown = 0
  const projectiles = []

  let frame = 0
  let last = performance.now()
  function loop(now) {
    try {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      frame += 1

      input.update()
      const state = input.getState()
      const { steer } = state

      // Invert X so left/right feel correct from camera-behind view.
      player.group.position.x += -steer.x * moveSpeed * dt
      player.group.position.y += -steer.y * moveSpeed * dt

      player.group.position.x = THREE.MathUtils.clamp(player.group.position.x, -bounds.x, bounds.x)
      player.group.position.y = THREE.MathUtils.clamp(player.group.position.y, -bounds.y, bounds.y)

      // Fire (space)
      fireCooldown = Math.max(0, fireCooldown - dt)
      if (state.fire.pressed && fireCooldown <= 0) {
        const proj = createProjectile(false)
        proj.mesh.position.copy(player.group.position)
        proj.mesh.position.z += 2.2
        scene.add(proj.mesh)
        projectiles.push(proj)
        fireCooldown = projectileCooldown
      }

      // Update projectiles (forward +Z)
      for (let i = projectiles.length - 1; i >= 0; i -= 1) {
        const p = projectiles[i]
        p.mesh.position.z += projectileSpeed * dt
        if (p.mesh.position.z > player.group.position.z + 120) {
          scene.remove(p.mesh)
          projectiles.splice(i, 1)
        }
      }

      // Small "bank" for responsiveness.
      const targetRoll = steer.x * 0.45
      player.group.rotation.z = THREE.MathUtils.lerp(player.group.rotation.z, targetRoll, 0.15)
      const targetPitch = steer.y * 0.18
      player.group.rotation.x = THREE.MathUtils.lerp(player.group.rotation.x, targetPitch * 0.6, 0.15)

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
          `frame=${frame} dt=${dt.toFixed(3)} steer=(${steer.x.toFixed(2)},${steer.y.toFixed(2)}) ` +
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
