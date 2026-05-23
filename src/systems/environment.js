import * as THREE from 'three'
import {
  SCENE_CLEAR_COLOR,
  WORLD_VIDEO_DOME_DEPTH,
  WORLD_VIDEO_DOME_DEPTH_HARD_MAX,
  WORLD_VIDEO_DOME_SLIDER_MAX,
  WORLD_VIDEO_DISTANCE,
  WORLD_VIDEO_DISTANCE_MIN,
  WORLD_VIDEO_FLIP_Y,
  WORLD_VIDEO_MIRROR_X,
  WORLD_VIDEO_BOWL_AMP_HARD_CAP,
  WORLD_VIDEO_BOWL_BOOST_MUL_MAX,
  WORLD_VIDEO_BOOST_DOME_ZOOM_MUL,
  WORLD_VIDEO_DISTANCE_MIN_BOOST,
  WORLD_VIDEO_HYPERSONIC_PLAYBACK_MAX,
  WORLD_VIDEO_HYPERSONIC_PLAYBACK_TIER_ADD,
  WORLD_VIDEO_PLAYBACK_BASE,
  WORLD_VIDEO_OVERSCALE_BOOST_EXTRA,
  WORLD_VIDEO_OVERSCALE_MAX,
  WORLD_VIDEO_URL,
  WORLD_VIDEO_ZOOM_CURVE,
  WORLD_VIDEO_ZOOM_LERP,
} from '../config/constants.js'
import { applyCoverUv } from './worldVideoLayout.js'
import {
  createWorldVideoShaderMaterial,
  syncWorldVideoMapUniforms,
  worldVideoBowlAmpFromDepth,
  worldVideoBowlAmpFromLinear,
} from './worldVideoMaterial.js'

/**
 * Scrolling floor + optional POV world video (toggle via `setWorldVideoEnabled`).
 * Inner-dome POV: concave billboard (`setWorldVideoImmersion`) — center recedes, rim stays forward.
 * With Inner dome on, **Dome depth** also pulls the backdrop closer and slightly overscales it
 * so the frame wraps more (see `WORLD_VIDEO_DISTANCE` / `WORLD_VIDEO_DISTANCE_MIN` in constants).
 *
 * Video v2: parented to the **camera** at a short distance ahead, scaled each frame to the
 * view frustum at that distance, with **cover** UVs (immersive full-frame, crop edges as needed).
 * Renders as a backdrop (`depthTest: false`) so it never z-fights the rail floor.
 * Half-transparent so the clear sky / scene still reads through (`opacity` ~0.5).
 *
 * **Mirroring:** The plane sits in camera space with its default +Z normal toward the eye (no `Y=π`
 * flip — that was flipping the texture left/right). Per-clip fixes: `WORLD_VIDEO_MIRROR_X` /
 * `WORLD_VIDEO_FLIP_Y` in `config/constants.js`.
 */
export function createEnvironment(scene, options = {}) {
  const worldVideoUrl = options.worldVideoUrl ?? WORLD_VIDEO_URL
  const initialWorldVideoEnabled = Boolean(options.initialWorldVideoEnabled)
  let worldVideoImmersionEnabled = Boolean(options.initialWorldVideoImmersion ?? false)
  let worldVideoDomeDepth = Math.max(
    0,
    Number(options.initialWorldVideoDomeDepth ?? WORLD_VIDEO_DOME_DEPTH) || 0
  )
  const camera = options.camera ?? null

  /** Scrolling floor strips = visible “rail” path (toggle independently of debug grid / level mesh). */
  const railGroup = new THREE.Group()
  scene.add(railGroup)

  const floorY = -2
  const segmentLength = 40
  const segmentCount = 10
  const floorWidth = 36
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
    railGroup.add(seg)
    floorSegments.push(seg)
  }

  const setRailVisible = (visible) => {
    railGroup.visible = Boolean(visible)
  }
  setRailVisible(options.initialRailVisible ?? true)

  const worldVideoGroup = new THREE.Group()
  worldVideoGroup.visible = false
  if (camera) {
    camera.add(worldVideoGroup)
    worldVideoGroup.position.set(0, 0, -WORLD_VIDEO_DISTANCE)
  }

  const videoEl = document.createElement('video')
  videoEl.muted = true
  videoEl.loop = true
  videoEl.playsInline = true
  videoEl.setAttribute('playsinline', '')
  videoEl.setAttribute('webkit-playsinline', '')
  videoEl.preload = 'auto'

  let playKickInstalled = false
  const ensurePlayKick = () => {
    if (playKickInstalled) return
    playKickInstalled = true
    window.addEventListener(
      'pointerdown',
      () => {
        if (worldVideoEnabled && !loadFailed && videoEl.readyState >= 2) {
          videoEl.play().catch(() => {})
        }
      },
      { once: true, passive: true }
    )
  }

  let videoTexture = null
  let videoMesh = null
  let loadStarted = false
  let videoReady = false
  let worldVideoEnabled = false
  let loadFailed = false

  const clearColor = new THREE.Color(SCENE_CLEAR_COLOR)

  const teardownVideoMesh = () => {
    if (videoMesh) {
      worldVideoGroup.remove(videoMesh)
      if (videoMesh.geometry) videoMesh.geometry.dispose()
      if (videoMesh.material && videoMesh.material.map) {
        videoMesh.material.map.dispose()
      }
      if (videoMesh.material) videoMesh.material.dispose()
      videoMesh = null
    }
    if (videoTexture) {
      videoTexture.dispose()
      videoTexture = null
    }
    videoReady = false
  }

  const applyImmersionUniform = () => {
    const u = videoMesh?.material?.uniforms?.immersion
    if (u) u.value = worldVideoImmersionEnabled ? 1 : 0
  }

  const applyDomeDepthUniform = () => {
    const u = videoMesh?.material?.uniforms?.bowlAmp
    if (u) u.value = worldVideoBowlAmpFromDepth(worldVideoDomeDepth)
  }

  const buildVideoMesh = () => {
    teardownVideoMesh()
    videoTexture = new THREE.VideoTexture(videoEl)
    videoTexture.colorSpace = THREE.SRGBColorSpace
    videoTexture.flipY = WORLD_VIDEO_FLIP_Y
    videoTexture.wrapS = THREE.ClampToEdgeWrapping
    videoTexture.wrapT = THREE.ClampToEdgeWrapping

    const mat = createWorldVideoShaderMaterial(videoTexture, {
      opacity: 0.5,
      domeDepth: worldVideoDomeDepth,
    })
    const geo = new THREE.PlaneGeometry(1, 1, 96, 96)
    videoMesh = new THREE.Mesh(geo, mat)
    applyImmersionUniform()
    applyDomeDepthUniform()
    videoMesh.frustumCulled = false
    videoMesh.renderOrder = -1000
    worldVideoGroup.add(videoMesh)
    videoReady = true
  }

  const pauseVideo = () => {
    videoEl.playbackRate = WORLD_VIDEO_PLAYBACK_BASE
    videoEl.pause()
  }

  const applySceneBackground = () => {
    scene.background = clearColor.clone()
  }

  const startLoadIfNeeded = () => {
    if (loadStarted || loadFailed) return
    loadStarted = true
    ensurePlayKick()
    videoEl.src = worldVideoUrl
    try {
      videoEl.load()
    } catch (_) {
      /* ignore */
    }

    const onError = () => {
      if (loadFailed) return
      loadFailed = true
      console.warn('[world video] Failed to load or decode:', worldVideoUrl)
      worldVideoEnabled = false
      worldVideoGroup.visible = false
      pauseVideo()
      teardownVideoMesh()
      applySceneBackground()
    }

    videoEl.addEventListener(
      'error',
      () => {
        onError()
      },
      { once: true }
    )

    let readyHandled = false
    const onReadyForPlayback = () => {
      if (readyHandled || loadFailed) return
      if (!videoEl.videoWidth || !videoEl.videoHeight) return
      readyHandled = true
      try {
        buildVideoMesh()
      } catch (e) {
        console.warn('[world video] Texture init failed', e)
        onError()
        return
      }
      if (!worldVideoEnabled) {
        worldVideoGroup.visible = false
        pauseVideo()
        return
      }
      worldVideoGroup.visible = true
      videoEl.removeEventListener('loadedmetadata', onReadyForPlayback)
      videoEl.removeEventListener('canplay', onReadyForPlayback)
      videoEl.play().catch((err) => {
        console.warn('[world video] play() failed', err)
        onError()
      })
    }

    videoEl.addEventListener('loadedmetadata', onReadyForPlayback)
    videoEl.addEventListener('canplay', onReadyForPlayback)
  }

  const setWorldVideoEnabled = (enabled) => {
    worldVideoEnabled = Boolean(enabled)
    if (!worldVideoEnabled) {
      worldVideoGroup.visible = false
      worldVideoGroup.position.set(0, 0, -WORLD_VIDEO_DISTANCE)
      pauseVideo()
      applySceneBackground()
      return
    }
    if (loadFailed) {
      worldVideoGroup.visible = false
      applySceneBackground()
      return
    }
    if (!camera) {
      worldVideoGroup.visible = false
      return
    }
    startLoadIfNeeded()
    if (videoReady && videoMesh) {
      worldVideoGroup.visible = true
      videoEl.play().catch((err) => {
        console.warn('[world video] play() failed', err)
        loadFailed = true
        worldVideoGroup.visible = false
        pauseVideo()
        applySceneBackground()
      })
    }
  }

  setWorldVideoEnabled(initialWorldVideoEnabled)

  return {
    floorY,
    segmentLength,
    segmentCount,
    floorSegments,
    /** Show or hide the rail path mesh (future: procedural geometry, banking, elevation). */
    setRailVisible,
    setWorldVideoEnabled,
    getWorldVideoEnabled: () => worldVideoEnabled,
    setWorldVideoImmersion: (enabled) => {
      worldVideoImmersionEnabled = Boolean(enabled)
      applyImmersionUniform()
    },
    setWorldVideoDomeDepth: (depth) => {
      const n = Number(depth)
      worldVideoDomeDepth = Number.isFinite(n)
        ? Math.max(0, Math.min(WORLD_VIDEO_DOME_DEPTH_HARD_MAX, n))
        : WORLD_VIDEO_DOME_DEPTH
      applyDomeDepthUniform()
    },
    /**
     * Scale frustum-fill plane + cover UVs (call every frame so resize / FOV stay correct).
     */
    updateWorldVideo(cam, opts = {}) {
      if (!worldVideoEnabled || !videoReady || !videoMesh || loadFailed || !cam) return
      if (!cam.aspect || cam.aspect <= 0) return

      const boostMul = opts?.speedBoostHeld ? WORLD_VIDEO_BOOST_DOME_ZOOM_MUL : 1
      const rawLinear =
        worldVideoImmersionEnabled && worldVideoDomeDepth > 0
          ? worldVideoDomeDepth / WORLD_VIDEO_DOME_SLIDER_MAX
          : 0
      const drive = rawLinear * boostMul
      const linear = Math.min(1, drive)
      const overshoot = Math.max(0, drive - 1)
      const zoomT = linear > 0 ? Math.pow(linear, WORLD_VIDEO_ZOOM_CURVE) : 0

      const minDist = THREE.MathUtils.lerp(
        WORLD_VIDEO_DISTANCE_MIN,
        WORLD_VIDEO_DISTANCE_MIN_BOOST,
        overshoot
      )
      const dist = THREE.MathUtils.lerp(
        WORLD_VIDEO_DISTANCE,
        minDist,
        zoomT * WORLD_VIDEO_ZOOM_LERP
      )
      worldVideoGroup.position.z = -dist

      const vFovRad = THREE.MathUtils.degToRad(cam.fov)
      const overscale =
        1 +
        WORLD_VIDEO_OVERSCALE_MAX * zoomT +
        WORLD_VIDEO_OVERSCALE_BOOST_EXTRA * overshoot * zoomT
      const frustumH = 2 * Math.tan(vFovRad / 2) * dist
      const frustumW = frustumH * cam.aspect
      videoMesh.scale.set(
        frustumW * WORLD_VIDEO_MIRROR_X * overscale,
        frustumH * overscale,
        1
      )

      const vw = videoEl.videoWidth
      const vh = videoEl.videoHeight
      if (vw > 0 && vh > 0 && videoTexture) {
        applyCoverUv(videoTexture, vw / vh, cam.aspect)
      }
      if (videoTexture) syncWorldVideoMapUniforms(videoMesh.material, videoTexture)

      const bowlU = videoMesh.material?.uniforms?.bowlAmp
      if (bowlU) {
        const bowlBase = worldVideoBowlAmpFromLinear(linear)
        const bowlMul = THREE.MathUtils.lerp(1, WORLD_VIDEO_BOWL_BOOST_MUL_MAX, overshoot)
        bowlU.value = Math.min(
          WORLD_VIDEO_BOWL_AMP_HARD_CAP,
          bowlBase * bowlMul
        )
      }

      const hypBlend = THREE.MathUtils.clamp(Number(opts?.hypersonicBlend) || 0, 0, 1)
      const hypTier = Math.max(0, Math.min(2, Math.floor(Number(opts?.hypersonicTier) || 0)))
      const rate = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(WORLD_VIDEO_PLAYBACK_BASE, WORLD_VIDEO_HYPERSONIC_PLAYBACK_MAX, hypBlend) +
          hypTier * WORLD_VIDEO_HYPERSONIC_PLAYBACK_TIER_ADD,
        0.25,
        4
      )
      if (videoEl.playbackRate !== rate) {
        try {
          videoEl.playbackRate = rate
        } catch (_) {
          /* ignore unsupported rates */
        }
      }
    },
  }
}

export function updateEnvironment(envState, playerZ) {
  const { floorSegments, segmentLength, segmentCount } = envState
  const wrapBehindZ = playerZ - segmentLength
  for (let i = 0; i < floorSegments.length; i += 1) {
    const seg = floorSegments[i]
    if (seg.position.z < wrapBehindZ) {
      seg.position.z += segmentLength * segmentCount
    }
  }
}
