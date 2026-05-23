import * as THREE from 'three'

/**
 * World / POV video layout helpers (distortion / framing modes).
 *
 * Modes we may add later:
 * - `cover` — fill view, crop excess (default; like CSS object-fit: cover)
 * - `contain` — full frame visible, letterbox (object-fit: contain)
 * - `fill` — stretch to view (avoid; looks wrong on mixed aspects)
 * - `offset` / `parallax` — UV scroll tied to rail speed (disabled for v1 simplicity)
 * - equirectangular / dome — for 360° or hemispherical sources
 *
 * **Mirroring** (see `WORLD_VIDEO_MIRROR_X` / `WORLD_VIDEO_FLIP_Y` in `config/constants.js`):
 * horizontal = negative X scale on the billboard; vertical = `VideoTexture.flipY`.
 */

export const WorldVideoLayoutMode = {
  Cover: 'cover',
}

/**
 * @param {THREE.Texture} texture
 * @param {number} videoAspect width / height of the decoded video
 * @param {number} viewAspect width / height of the viewport (canvas)
 */
export function applyCoverUv(texture, videoAspect, viewAspect) {
  if (!videoAspect || !viewAspect || videoAspect <= 0 || viewAspect <= 0) return

  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping

  if (videoAspect > viewAspect) {
    const rx = viewAspect / videoAspect
    texture.repeat.set(rx, 1)
    texture.offset.set((1 - rx) / 2, 0)
  } else {
    const ry = videoAspect / viewAspect
    texture.repeat.set(1, ry)
    texture.offset.set(0, (1 - ry) / 2)
  }
  texture.needsUpdate = true
}
