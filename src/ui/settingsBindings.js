/**
 * Wires all settings toggles and tuning sliders to DOM and callbacks.
 * Does not own game logic; mutates provided state and calls emitSettings / optional callbacks.
 */
export function bindSettingsUI({
  elements,
  state,
  tuningState,
  mouseIntensityRef,
  input,
  emitSettings,
  onHitboxesChange,
  onShadowsChange,
  onLevelMeshChange,
  onLaserChange,
  debugEl,
}) {
  const {
    menuButton,
    toggleMouseButton,
    toggleTouchButton,
    toggleInstructionsButton,
    toggleInvertYButton,
    toggleHitboxesButton,
    toggleShadowsButton,
    toggleLevelMeshButton,
    toggleLaserButton,
    toggleAutoLockButton,
    toggleAutoFireButton,
    toggleDebugButton,
    settingsPanel,
    instructionsEl,
    touchControls,
  } = elements

  const updateTouchControls = () => {
    if (touchControls) touchControls.dataset.mode = state.touchMode
  }
  const updateSettingsPanel = () => {
    if (settingsPanel) settingsPanel.dataset.open = state.settingsOpen ? 'true' : 'false'
  }

  // Mouse
  if (toggleMouseButton) {
    const updateLabel = () => {
      toggleMouseButton.textContent = state.mouseMode === 'off' ? 'Mouse Aim: Off' : 'Mouse Aim: On'
    }
    updateLabel()
    toggleMouseButton.addEventListener('click', () => {
      state.mouseMode = state.mouseMode === 'off' ? 'normal' : 'off'
      input.setMouseMode(state.mouseMode)
      updateLabel()
      emitSettings()
    })
  }

  // Touch
  if (toggleTouchButton) {
    const updateLabel = () => {
      const label =
        state.touchMode === 'off'
          ? 'Touch: Off'
          : state.touchMode === 'drag'
            ? 'Touch: Drag'
            : 'Touch: Stick'
      toggleTouchButton.textContent = label
    }
    updateTouchControls()
    updateLabel()
    toggleTouchButton.addEventListener('click', () => {
      state.touchMode =
        state.touchMode === 'off' ? 'stick' : state.touchMode === 'stick' ? 'drag' : 'off'
      input.setTouchMode(state.touchMode)
      updateTouchControls()
      updateLabel()
      emitSettings()
    })
  }

  // Menu
  if (menuButton) {
    const updateMenuLabel = () => {
      menuButton.textContent = state.settingsOpen ? 'Close' : 'Menu'
    }
    updateSettingsPanel()
    updateMenuLabel()
    menuButton.addEventListener('click', () => {
      state.settingsOpen = !state.settingsOpen
      updateSettingsPanel()
      updateMenuLabel()
    })
  }

  // Instructions / HUD Tips
  if (toggleInstructionsButton) {
    const updateInstructions = () => {
      if (instructionsEl) instructionsEl.style.display = state.instructionsVisible ? 'block' : 'none'
      toggleInstructionsButton.textContent = state.instructionsVisible ? 'HUD Tips: On' : 'HUD Tips: Off'
    }
    updateInstructions()
    toggleInstructionsButton.addEventListener('click', () => {
      state.instructionsVisible = !state.instructionsVisible
      updateInstructions()
      emitSettings()
    })
  }

  // Invert Y
  if (toggleInvertYButton) {
    const updateLabel = () => {
      toggleInvertYButton.textContent = state.invertY ? 'Invert Y: On' : 'Invert Y: Off'
    }
    updateLabel()
    toggleInvertYButton.addEventListener('click', () => {
      state.invertY = !state.invertY
      updateLabel()
      emitSettings()
    })
  }

  // Hitboxes
  if (toggleHitboxesButton) {
    const updateLabel = () => {
      toggleHitboxesButton.textContent = state.hitboxesEnabled ? 'Hitboxes: On' : 'Hitboxes: Off'
    }
    updateLabel()
    toggleHitboxesButton.addEventListener('click', () => {
      state.hitboxesEnabled = !state.hitboxesEnabled
      if (onHitboxesChange) onHitboxesChange(state.hitboxesEnabled)
      updateLabel()
      emitSettings()
    })
  }

  // Shadows
  if (toggleShadowsButton) {
    const updateLabel = () => {
      toggleShadowsButton.textContent = state.shadowsEnabled ? 'Shadows: On' : 'Shadows: Off'
    }
    updateLabel()
    toggleShadowsButton.addEventListener('click', () => {
      state.shadowsEnabled = !state.shadowsEnabled
      if (onShadowsChange) onShadowsChange(state.shadowsEnabled)
      updateLabel()
      emitSettings()
    })
  }

  // Level mesh
  if (toggleLevelMeshButton) {
    const updateLabel = () => {
      toggleLevelMeshButton.textContent = state.levelMeshEnabled ? 'Level Mesh: On' : 'Level Mesh: Off'
    }
    updateLabel()
    toggleLevelMeshButton.addEventListener('click', () => {
      state.levelMeshEnabled = !state.levelMeshEnabled
      if (onLevelMeshChange) onLevelMeshChange(state.levelMeshEnabled)
      updateLabel()
      emitSettings()
    })
  }

  // Laser
  if (toggleLaserButton) {
    const updateLabel = () => {
      toggleLaserButton.textContent = state.laserEnabled ? 'Laser Sight: On' : 'Laser Sight: Off'
    }
    updateLabel()
    toggleLaserButton.addEventListener('click', () => {
      state.laserEnabled = !state.laserEnabled
      if (onLaserChange) onLaserChange(state.laserEnabled)
      updateLabel()
      emitSettings()
    })
  }

  // Instant Laser
  if (toggleAutoLockButton) {
    const updateLabel = () => {
      toggleAutoLockButton.textContent = state.instantLaserEnabled ? 'Instant Laser: On' : 'Instant Laser: Off'
    }
    updateLabel()
    toggleAutoLockButton.addEventListener('click', () => {
      state.instantLaserEnabled = !state.instantLaserEnabled
      updateLabel()
      emitSettings()
    })
  }

  // Auto fire
  if (toggleAutoFireButton) {
    const updateLabel = () => {
      toggleAutoFireButton.textContent = state.autoFireEnabled ? 'Auto Fire: On' : 'Auto Fire: Off'
    }
    updateLabel()
    toggleAutoFireButton.addEventListener('click', () => {
      state.autoFireEnabled = !state.autoFireEnabled
      updateLabel()
      emitSettings()
    })
  }

  // Debug
  if (toggleDebugButton && debugEl) {
    const updateLabel = () => {
      toggleDebugButton.textContent = state.debugEnabled ? 'Debug: On' : 'Debug: Off'
      debugEl.style.display = state.debugEnabled ? 'block' : 'none'
      if (state.debugEnabled) debugEl.textContent = 'starting…'
    }
    updateLabel()
    toggleDebugButton.addEventListener('click', () => {
      state.debugEnabled = !state.debugEnabled
      updateLabel()
      emitSettings()
    })
  }

  // Tuning sliders
  const tuning = elements.tuning
  if (!tuning) return

  const bindSlider = (key, inputEl, valEl, format = (v) => v.toFixed(1)) => {
    if (!inputEl) return
    const sync = () => {
      const value = Number(inputEl.value)
      tuningState[key] = value
      if (valEl) valEl.textContent = format(value)
      emitSettings()
    }
    inputEl.value = tuningState[key]
    inputEl.addEventListener('input', sync)
    sync()
  }

  bindSlider('speedX', tuning.speedX, tuning.speedXVal)
  bindSlider('speedY', tuning.speedY, tuning.speedYVal)
  bindSlider('turnResponse', tuning.turnResponse, tuning.turnResponseVal)
  bindSlider('rollStrafeMultiplier', tuning.rollStrafe, tuning.rollStrafeVal)

  if (tuning.mouseIntensity) {
    const sync = () => {
      const value = Number(tuning.mouseIntensity.value)
      mouseIntensityRef.value = value
      if (tuning.mouseIntensityVal) tuning.mouseIntensityVal.textContent = value.toFixed(1)
      const sensitivity = 0.5 + (value / 10) * 2.5
      input.setMouseSensitivity(sensitivity)
      emitSettings()
    }
    tuning.mouseIntensity.value = mouseIntensityRef.value
    tuning.mouseIntensity.addEventListener('input', sync)
    sync()
  }

  bindSlider('camDistance', tuning.camDistance, tuning.camDistanceVal)
  bindSlider('camHeight', tuning.camHeight, tuning.camHeightVal)
}
