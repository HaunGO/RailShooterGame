import * as THREE from 'three'
import { SCENE_CLEAR_COLOR } from '../config/constants.js'

/** Creates WebGLRenderer, sets size/pixel ratio/clear color, appends canvas to container. Returns null on failure. */
export function createRenderer(container, debugEl = null) {
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
    return null
  }

  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setClearColor(SCENE_CLEAR_COLOR, 1)
  const canvas = renderer.domElement
  canvas.style.position = 'absolute'
  canvas.style.left = '0'
  canvas.style.top = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.zIndex = '1'
  canvas.id = 'three-canvas'
  container.prepend(canvas)

  return { renderer, canvas }
}

/** Creates scene with default background color. */
export function createScene() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(SCENE_CLEAR_COLOR)
  return scene
}

/** Creates perspective camera with default aspect, near/far, and initial position. */
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  )
  camera.position.set(0, 1.8, -10)
  return camera
}

/** Creates renderer, scene, camera, and default lights. Returns null if renderer creation fails. */
export function createCore(container, debugEl = null) {
  const rendererResult = createRenderer(container, debugEl)
  if (!rendererResult) return null

  const { renderer, canvas } = rendererResult
  const scene = createScene()
  const camera = createCamera()
  // Camera must live in the scene graph so children (e.g. world video backdrop) are rendered.
  scene.add(camera)

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6)
  keyLight.position.set(6, 10, -6)
  scene.add(keyLight)
  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  scene.add(new THREE.HemisphereLight(0xbad3ff, 0x203050, 0.45))

  return { renderer, scene, camera, canvas }
}
