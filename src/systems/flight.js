import * as THREE from 'three'
import { GAME_CONFIG, loopForwardCarry } from '../config/constants.js'

/** Player movement, barrel roll, and loop-the-loop. Updates position and rotation from input and tuning. */
export function createFlightSystem({ player, bounds, minY }) {
  const shipVelocity = new THREE.Vector3()
  let barrelRollTimer = 0
  let barrelRollDir = 0
  let barrelRollStartZ = 0
  let barrelRollCooldown = 0
  let loopTimer = 0
  let loopDir = 0
  let loopCooldown = 0
  let loopWasActive = false
  let loopPitchPrev = 0
  let loopBlendInTimer = 0
  let loopStartPitch = 0
  const loopBlendStartPos = new THREE.Vector3()
  let loopBlendOutTimer = 0
  let loopEndPitch = 0
  let loopEndRoll = 0
  const loopStartPos = new THREE.Vector3()
  const loopForward = new THREE.Vector3()
  const loopRight = new THREE.Vector3()
  const loopWorldUp = new THREE.Vector3(0, 1, 0)
  const tmpLoopOffset = new THREE.Vector3()
  const tmpLoopTarget = new THREE.Vector3()
  const tmpLoopOffset2 = new THREE.Vector3()

  function update(dt, inputState, tuningState, invertY) {
    const { steer, usingMouseAim } = inputState
    const xInput = -steer.x
    const yInput = invertY ? steer.y : -steer.y
    const speedScale = inputState.boost.held
      ? GAME_CONFIG.boostMultiplier
      : inputState.brake.held
        ? GAME_CONFIG.brakeMultiplier
        : 1
    const rollStrafe =
      barrelRollTimer > 0 && barrelRollDir !== 0
        ? tuningState.rollStrafeMultiplier * -barrelRollDir
        : 0
    shipVelocity.set(
      xInput * tuningState.speedX + rollStrafe * tuningState.speedX,
      yInput * tuningState.speedY,
      GAME_CONFIG.forwardSpeed * speedScale
    )
    player.group.position.x += shipVelocity.x * dt
    player.group.position.y += shipVelocity.y * dt
    player.group.position.z += shipVelocity.z * dt

    player.group.position.x = THREE.MathUtils.clamp(player.group.position.x, -bounds.x, bounds.x)
    player.group.position.y = THREE.MathUtils.clamp(player.group.position.y, minY, bounds.y)

    // Orientation
    const yawMax = usingMouseAim ? 0.55 : 0.32
    const pitchMax = usingMouseAim ? 0.45 : 0.4
    const rollMax = usingMouseAim ? 0.75 : 0.42
    const tr01 = THREE.MathUtils.clamp((tuningState.turnResponse - 1) / 9, 0, 1)
    const rotLerp = usingMouseAim ? 0.12 : THREE.MathUtils.lerp(0.03, 0.18, tr01)
    const targetYaw = xInput * yawMax
    const targetPitch = -yInput * pitchMax
    const targetRoll = -xInput * rollMax

    // Barrel roll (Shift + Left/Right)
    barrelRollCooldown = Math.max(0, barrelRollCooldown - dt)
    if (barrelRollTimer <= 0 && barrelRollCooldown <= 0 && inputState.roll.held) {
      const rollThreshold = usingMouseAim ? 0.1 : 0.6
      if (inputState.steer.x <= -rollThreshold) {
        barrelRollTimer = GAME_CONFIG.barrelRollDuration
        barrelRollDir = -1
        barrelRollStartZ = player.group.rotation.z
        barrelRollCooldown = GAME_CONFIG.barrelRollCooldownTime
      } else if (inputState.steer.x >= rollThreshold) {
        barrelRollTimer = GAME_CONFIG.barrelRollDuration
        barrelRollDir = 1
        barrelRollStartZ = player.group.rotation.z
        barrelRollCooldown = GAME_CONFIG.barrelRollCooldownTime
      }
    }
    // Loop (Shift + Up)
    loopCooldown = Math.max(0, loopCooldown - dt)
    const loopThreshold = usingMouseAim ? 0.3 : 0.55
    if (
      loopTimer <= 0 &&
      loopCooldown <= 0 &&
      barrelRollTimer <= 0 &&
      inputState.roll.held &&
      yInput >= loopThreshold
    ) {
      loopTimer = GAME_CONFIG.loopDuration
      loopDir = -1
      loopStartPos.copy(player.group.position)
      loopBlendStartPos.copy(player.group.position)
      loopForward.set(0, 0, 1).applyQuaternion(player.group.quaternion).normalize()
      loopRight.crossVectors(loopForward, loopWorldUp).normalize()
      loopPitchPrev = player.group.rotation.x
      loopStartPitch = player.group.rotation.x
      loopBlendInTimer = GAME_CONFIG.loopBlendInDuration
      loopBlendOutTimer = 0
      loopCooldown = GAME_CONFIG.loopCooldownTime
    }
    if (barrelRollTimer > 0) {
      barrelRollTimer = Math.max(0, barrelRollTimer - dt)
    }
    const wasLooping = loopTimer > 0
    if (loopTimer > 0) {
      loopTimer = Math.max(0, loopTimer - dt)
      if (loopTimer === 0) {
        loopEndPitch = player.group.rotation.x
        loopEndRoll = player.group.rotation.z
        loopBlendOutTimer = 0
      }
    }
    if (loopBlendInTimer > 0) {
      loopBlendInTimer = Math.max(0, loopBlendInTimer - dt)
    }
    if (loopBlendOutTimer > 0) {
      loopBlendOutTimer = Math.max(0, loopBlendOutTimer - dt)
    }
    loopWasActive = wasLooping

    const rollPhase = barrelRollTimer > 0 ? 1 - barrelRollTimer / GAME_CONFIG.barrelRollDuration : 0
    const easedPhase = rollPhase * rollPhase * (3 - 2 * rollPhase)
    const barrelRollOffset = barrelRollTimer > 0 ? barrelRollDir * easedPhase * Math.PI * 2 : 0
    const loopPhase = loopTimer > 0 ? 1 - loopTimer / GAME_CONFIG.loopDuration : 0
    const loopTheta = loopPhase * Math.PI * 2
    const loopBlendIn =
      GAME_CONFIG.loopBlendInDuration > 0
        ? 1 - loopBlendInTimer / GAME_CONFIG.loopBlendInDuration
        : 1
    const loopBlendT = Math.min(1, Math.max(0, loopBlendIn))
    const loopBlendScale = loopBlendT * loopBlendT * (3 - 2 * loopBlendT)

    player.group.rotation.y = THREE.MathUtils.lerp(player.group.rotation.y, targetYaw, rotLerp)
    if (loopTimer > 0) {
      const dTheta = 0.02
      const theta2 = Math.min(loopTheta + dTheta, Math.PI * 2)
      const phase2 = theta2 / (Math.PI * 2)
      const verticalOffset = GAME_CONFIG.loopRadius * (1 - Math.cos(loopTheta))
      const forwardOffset =
        GAME_CONFIG.loopRadius * Math.sin(loopTheta) * -loopDir + loopForwardCarry * loopPhase
      const verticalOffset2 = GAME_CONFIG.loopRadius * (1 - Math.cos(theta2))
      const forwardOffset2 =
        GAME_CONFIG.loopRadius * Math.sin(theta2) * -loopDir + loopForwardCarry * phase2
      tmpLoopOffset
        .copy(loopStartPos)
        .addScaledVector(loopForward, forwardOffset)
        .addScaledVector(loopWorldUp, verticalOffset)
      tmpLoopOffset2
        .copy(loopStartPos)
        .addScaledVector(loopForward, forwardOffset2)
        .addScaledVector(loopWorldUp, verticalOffset2)
      const tangent = tmpLoopOffset2.sub(tmpLoopOffset).normalize()
      let desiredX = -Math.atan2(tangent.y, tangent.dot(loopForward))
      const holdPhase = 0.1
      if (loopPhase < holdPhase) {
        desiredX = loopStartPitch
      } else {
        const rampT = Math.min(1, (loopPhase - holdPhase) / 0.25)
        const ramp = rampT * rampT * (3 - 2 * rampT)
        desiredX = loopStartPitch + (desiredX - loopStartPitch) * ramp
      }
      let adjusted = desiredX
      while (adjusted - loopPitchPrev > Math.PI) adjusted -= Math.PI * 2
      while (adjusted - loopPitchPrev < -Math.PI) adjusted += Math.PI * 2
      loopPitchPrev = adjusted
      player.group.rotation.x = THREE.MathUtils.lerp(loopStartPitch, adjusted, loopBlendScale)
    } else if (loopBlendOutTimer > 0) {
      const t = 1 - loopBlendOutTimer / GAME_CONFIG.loopBlendOutDuration
      const blend = t * t * (3 - 2 * t)
      let adjustedTarget = targetPitch
      while (adjustedTarget - loopEndPitch > Math.PI) adjustedTarget -= Math.PI * 2
      while (adjustedTarget - loopEndPitch < -Math.PI) adjustedTarget += Math.PI * 2
      player.group.rotation.x = THREE.MathUtils.lerp(loopEndPitch, adjustedTarget, blend)
    } else {
      if (loopWasActive) {
        let adjusted = player.group.rotation.x
        while (adjusted - targetPitch > Math.PI) adjusted -= Math.PI * 2
        while (adjusted - targetPitch < -Math.PI) adjusted += Math.PI * 2
        player.group.rotation.x = adjusted
      }
      player.group.rotation.x = THREE.MathUtils.lerp(player.group.rotation.x, targetPitch, rotLerp)
    }

    if (barrelRollTimer > 0) {
      player.group.rotation.z = barrelRollStartZ + barrelRollOffset
    } else if (loopTimer > 0) {
      const spiralRoll = Math.sin(loopTheta * 2) * 0.25 * Math.max(0.2, Math.abs(xInput))
      const wrapped = ((player.group.rotation.z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const nearest = wrapped > Math.PI ? wrapped - Math.PI * 2 : wrapped
      player.group.rotation.z = THREE.MathUtils.lerp(nearest, targetRoll + spiralRoll, rotLerp)
    } else if (loopBlendOutTimer > 0) {
      const t = 1 - loopBlendOutTimer / GAME_CONFIG.loopBlendOutDuration
      const blend = t * t * (3 - 2 * t)
      let adjustedTarget = targetRoll
      while (adjustedTarget - loopEndRoll > Math.PI) adjustedTarget -= Math.PI * 2
      while (adjustedTarget - loopEndRoll < -Math.PI) adjustedTarget += Math.PI * 2
      player.group.rotation.z = THREE.MathUtils.lerp(loopEndRoll, adjustedTarget, blend)
    } else {
      const wrapped = ((player.group.rotation.z % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const nearest = wrapped > Math.PI ? wrapped - Math.PI * 2 : wrapped
      player.group.rotation.z = THREE.MathUtils.lerp(nearest, targetRoll, rotLerp)
    }

    if (loopTimer > 0) {
      const spiralBias = Math.sin(loopTheta * 2) * xInput
      const verticalOffset = GAME_CONFIG.loopRadius * (1 - Math.cos(loopTheta))
      const forwardOffset =
        GAME_CONFIG.loopRadius * Math.sin(loopTheta) * -loopDir + loopForwardCarry * loopPhase
      tmpLoopTarget
        .copy(loopStartPos)
        .addScaledVector(loopForward, forwardOffset)
        .addScaledVector(loopWorldUp, verticalOffset)
        .addScaledVector(loopRight, spiralBias * GAME_CONFIG.loopRadius * 0.35)
      if (loopBlendScale < 1) {
        tmpLoopOffset.copy(loopBlendStartPos).lerp(tmpLoopTarget, loopBlendScale)
        player.group.position.copy(tmpLoopOffset)
      } else {
        player.group.position.copy(tmpLoopTarget)
      }
    }
  }

  return { update }
}
