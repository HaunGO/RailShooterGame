import * as THREE from 'three'
import { GAME_CONFIG } from '../config/constants.js'

/** Debug overlay: plane + grid segments that wrap with the player and track height. */
export function createLevelMesh(scene, envState) {
  const { segmentLength, segmentCount } = envState
  const levelWidth = GAME_CONFIG.levelWidth
  const segments = []

  for (let i = 0; i < segmentCount; i += 1) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(levelWidth, segmentLength, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    )
    plane.rotation.x = -Math.PI / 2
    plane.position.set(0, 0, i * segmentLength)
    scene.add(plane)

    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(levelWidth, segmentLength, 20, 10),
      new THREE.MeshBasicMaterial({
        color: 0x5ac8ff,
        wireframe: true,
        transparent: true,
        opacity: 0.03,
      })
    )
    grid.rotation.x = -Math.PI / 2
    grid.position.set(0, 0.01, i * segmentLength)
    scene.add(grid)

    segments.push({ plane, grid })
  }

  function setVisible(value) {
    for (let i = 0; i < segments.length; i += 1) {
      segments[i].plane.visible = value
      segments[i].grid.visible = value
    }
  }

  function update(playerPosition) {
    const levelWrapBehindZ = playerPosition.z - segmentLength
    const offset = segmentLength * segmentCount
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i]
      seg.plane.position.y = playerPosition.y - 0.01
      seg.grid.position.y = playerPosition.y
      if (seg.plane.position.z < levelWrapBehindZ) {
        seg.plane.position.z += offset
        seg.grid.position.z += offset
      }
    }
  }

  return { setVisible, update }
}
