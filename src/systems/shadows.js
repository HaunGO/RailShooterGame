import * as THREE from 'three'

/** Ground shadows for player and targets. Creates material; addPlayerShadow, refreshTargetShadows, updatePositions. */
export function createShadowsSystem(scene) {
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
  })

  function addPlayerShadow() {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), shadowMaterial)
    mesh.rotation.x = -Math.PI / 2
    scene.add(mesh)
    return {
      setPosition(x, y, z) {
        mesh.position.set(x, y, z)
      },
      setVisible(visible) {
        mesh.visible = visible
      },
    }
  }

  function refreshTargetShadows(targets, enabled) {
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i]
      if (enabled) {
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

  function updatePositions(playerShadowHandle, playerPosition, targets, floorY) {
    const y = floorY + 0.02
    playerShadowHandle.setPosition(playerPosition.x, y, playerPosition.z)
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i]
      if (t.shadow) {
        t.shadow.position.set(t.mesh.position.x, y, t.mesh.position.z)
      }
    }
  }

  return { shadowMaterial, addPlayerShadow, refreshTargetShadows, updatePositions }
}
