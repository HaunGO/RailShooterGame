/**
 * Wires all settings toggles and tuning sliders to DOM and callbacks.
 * Does not own game logic; mutates provided state and calls emitSettings / optional callbacks.
 *
 * HUD toggles use `.hud-toggle__state` for the value column; emojis in `.hud-toggle__ico` are decorative (`aria-hidden`).
 */

function hudStateEl(btn) {
  return btn?.querySelector?.('.hud-toggle__state') ?? null
}

function setHudStateText(btn, text) {
  const el = hudStateEl(btn)
  if (el) el.textContent = text
}

/** Binary On/Off toggles: updates state pill, `aria-pressed`, and `aria-label`. */
function setHudBinary(btn, name, isOn, onText = 'On', offText = 'Off') {
  if (!btn) return
  const shown = isOn ? onText : offText
  setHudStateText(btn, shown)
  btn.setAttribute('aria-pressed', isOn ? 'true' : 'false')
  btn.setAttribute('aria-label', `${name}, ${shown}`)
}

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
  onRailChange,
  onWorldVideoChange,
  onWorldImmersionChange,
  onWorldVideoDomeDepthChange,
  onLaserChange,
  debugEl,
}) {
  const {
    menuButton,
    toggleMouseButton,
    toggleCrosshairMouseButton,
    toggleTouchButton,
    toggleInstructionsButton,
    toggleInvertYButton,
    toggleHitboxesButton,
    toggleShadowsButton,
    toggleLevelMeshButton,
    toggleRailButton,
    toggleWorldVideoButton,
    toggleWorldImmersionButton,
    toggleLaserButton,
    toggleAutoLockButton,
    toggleAutoFireButton,
    toggleDebugButton,
    settingsPanel,
    instructionsEl,
    touchControls,
    worldView,
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
      const on = state.mouseMode !== 'off'
      setHudBinary(toggleMouseButton, 'Mouse aim', on)
    }
    updateLabel()
    toggleMouseButton.addEventListener('click', () => {
      state.mouseMode = state.mouseMode === 'off' ? 'normal' : 'off'
      input.setMouseMode(state.mouseMode)
      updateLabel()
      emitSettings()
    })
  }

  // Crosshair: Ship vs Mouse
  if (toggleCrosshairMouseButton) {
    const updateLabel = () => {
      const mouse = Boolean(state.crosshairFollowsMouse)
      setHudStateText(toggleCrosshairMouseButton, mouse ? 'Mouse' : 'Ship')
      toggleCrosshairMouseButton.setAttribute(
        'aria-label',
        mouse ? 'Crosshair follows cursor' : 'Crosshair follows ship aim'
      )
    }
    updateLabel()
    toggleCrosshairMouseButton.addEventListener('click', () => {
      state.crosshairFollowsMouse = !state.crosshairFollowsMouse
      updateLabel()
      emitSettings()
    })
  }

  // Touch (tri-state)
  if (toggleTouchButton) {
    const updateLabel = () => {
      const t = state.touchMode
      const label = t === 'off' ? 'Off' : t === 'drag' ? 'Drag' : 'Stick'
      setHudStateText(toggleTouchButton, label)
      toggleTouchButton.setAttribute('aria-label', `Touch controls, ${label.toLowerCase()}`)
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
      const open = state.settingsOpen
      menuButton.setAttribute('aria-expanded', open ? 'true' : 'false')
      menuButton.setAttribute('aria-label', open ? 'Close HUD settings' : 'Open HUD settings')
      const label = menuButton.querySelector('.hud-menu-btn__label')
      const ico = menuButton.querySelector('.hud-menu-btn__ico')
      if (label) label.textContent = open ? 'Close' : 'HUD'
      if (ico) ico.textContent = open ? '' : '⚙'
    }
    updateSettingsPanel()
    updateMenuLabel()
    menuButton.addEventListener('click', () => {
      state.settingsOpen = !state.settingsOpen
      updateSettingsPanel()
      updateMenuLabel()
    })
  }

  // Tips
  if (toggleInstructionsButton) {
    const updateInstructions = () => {
      if (instructionsEl) instructionsEl.style.display = state.instructionsVisible ? 'block' : 'none'
      setHudBinary(toggleInstructionsButton, 'Control tips on screen', state.instructionsVisible)
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
      setHudBinary(toggleInvertYButton, 'Invert vertical steering', state.invertY)
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
      setHudBinary(toggleHitboxesButton, 'Show hitboxes', state.hitboxesEnabled)
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
      setHudBinary(toggleShadowsButton, 'Ship and target shadows', state.shadowsEnabled)
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
      setHudBinary(toggleLevelMeshButton, 'Level grid mesh', state.levelMeshEnabled)
    }
    updateLabel()
    toggleLevelMeshButton.addEventListener('click', () => {
      state.levelMeshEnabled = !state.levelMeshEnabled
      if (onLevelMeshChange) onLevelMeshChange(state.levelMeshEnabled)
      updateLabel()
      emitSettings()
    })
  }

  // Rail path (scrolling track surface)
  if (toggleRailButton) {
    const updateLabel = () => {
      setHudBinary(toggleRailButton, 'Rail path surface', state.railVisible)
    }
    updateLabel()
    toggleRailButton.addEventListener('click', () => {
      state.railVisible = !state.railVisible
      if (onRailChange) onRailChange(state.railVisible)
      updateLabel()
      emitSettings()
    })
  }

  // World video
  if (toggleWorldVideoButton) {
    const updateLabel = () => {
      setHudBinary(toggleWorldVideoButton, 'World POV video backdrop', state.worldVideoEnabled)
    }
    updateLabel()
    toggleWorldVideoButton.addEventListener('click', () => {
      state.worldVideoEnabled = !state.worldVideoEnabled
      if (onWorldVideoChange) onWorldVideoChange(state.worldVideoEnabled)
      updateLabel()
      emitSettings()
    })
  }

  // World view — inner dome (concave POV billboard)
  if (toggleWorldImmersionButton) {
    const updateLabel = () => {
      setHudBinary(
        toggleWorldImmersionButton,
        'POV inner dome',
        state.worldVideoImmersionEnabled
      )
    }
    updateLabel()
    toggleWorldImmersionButton.addEventListener('click', () => {
      state.worldVideoImmersionEnabled = !state.worldVideoImmersionEnabled
      if (onWorldImmersionChange) onWorldImmersionChange(state.worldVideoImmersionEnabled)
      updateLabel()
      emitSettings()
    })
  }

  // Laser
  if (toggleLaserButton) {
    const updateLabel = () => {
      setHudBinary(toggleLaserButton, 'Laser sight line', state.laserEnabled)
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
      setHudBinary(toggleAutoLockButton, 'Instant laser on R', state.instantLaserEnabled)
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
      setHudBinary(toggleAutoFireButton, 'Auto fire when locked', state.autoFireEnabled)
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
      setHudBinary(toggleDebugButton, 'Debug stats overlay', state.debugEnabled)
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

  // World view — dome depth (POV inner bowl, local Z)
  if (worldView?.domeDepth) {
    const format = (v) => String(Math.round(v))
    const sync = () => {
      const value = Number(worldView.domeDepth.value)
      tuningState.worldVideoDomeDepth = value
      if (worldView.domeDepthVal) worldView.domeDepthVal.textContent = format(value)
      if (onWorldVideoDomeDepthChange) onWorldVideoDomeDepthChange(value)
      emitSettings()
    }
    worldView.domeDepth.value = String(tuningState.worldVideoDomeDepth ?? 0)
    worldView.domeDepth.addEventListener('input', sync)
    sync()
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

  bindSlider('forwardSpeed', tuning.forwardSpeed, tuning.forwardSpeedVal)
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
