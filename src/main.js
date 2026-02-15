import './style.css'
import defaults from './settings.defaults.json'
import descriptions from './settings.descriptions.json'
import { initGame } from './game.js'

const SETTINGS_KEY = 'railShooter.settings'

const mergeSettings = (base, override) => ({
  ...base,
  ...override,
  tuning: {
    ...base.tuning,
    ...(override?.tuning ?? {}),
  },
})

const loadSettings = () => {
  const stored = sessionStorage.getItem(SETTINGS_KEY)
  if (!stored) {
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(defaults))
    return mergeSettings(defaults, {})
  }
  try {
    const parsed = JSON.parse(stored)
    // Migrate old key for existing sessionStorage
    const migrated = { ...parsed, instantLaserEnabled: parsed.instantLaserEnabled ?? parsed.autoLockEnabled }
    return mergeSettings(defaults, migrated)
  } catch (err) {
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(defaults))
    return mergeSettings(defaults, {})
  }
}

const saveSettings = (settings) => {
  sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="hud">
    <div id="reticle"></div>
    <div id="debug"></div>
    <button id="menu-button" type="button" aria-label="Toggle settings">Menu</button>
    <div id="score-panel">
      <div id="score-label">Score</div>
      <div id="score-value">0</div>
      <div id="combo-value">x0</div>
    </div>
    <div id="debug-panel" data-open="false">
      <div id="debug-title">Settings</div>
      <div class="debug-buttons">
        <button id="toggle-mouse" type="button">Mouse Aim: Off</button>
        <button id="toggle-touch" type="button">Touch: Off</button>
        <button id="toggle-instructions" type="button">HUD Tips: On</button>
        <button id="toggle-invert-y" type="button">Invert Y: Off</button>
        <button id="toggle-hitboxes" type="button">Hitboxes: Off</button>
        <button id="toggle-shadows" type="button">Shadows: Off</button>
        <button id="toggle-levelmesh" type="button">Level Mesh: On</button>
        <button id="toggle-laser" type="button">Laser Sight: On</button>
        <button id="toggle-auto-lock" type="button">Instant Laser: Off</button>
        <button id="toggle-auto-fire" type="button">Auto Fire: Off</button>
        <button id="reset-settings" type="button">Reset Settings</button>
        <button id="toggle-debug" type="button">Debug: Off</button>
      </div>
      <div id="tuning">
      <div class="tuning-row">
        <label for="speed-x">Strafe speed <span id="speed-x-val">6.0</span></label>
        <input id="speed-x" type="range" min="1" max="10" step="0.1" value="6.0" />
      </div>
      <div class="tuning-row">
        <label for="speed-y">Vertical speed <span id="speed-y-val">6.0</span></label>
        <input id="speed-y" type="range" min="1" max="10" step="0.1" value="6.0" />
      </div>
      <div class="tuning-row">
        <label for="turn-response">Turn response <span id="turn-response-val">3.0</span></label>
        <input id="turn-response" type="range" min="1" max="10" step="0.1" value="3.0" />
      </div>
      <div class="tuning-row">
        <label for="roll-strafe">Roll strafe <span id="roll-strafe-val">1.6</span></label>
        <input id="roll-strafe" type="range" min="1.0" max="3.0" step="0.1" value="1.6" />
      </div>
      <div class="tuning-row">
        <label for="mouse-intensity">Mouse aim intensity <span id="mouse-intensity-val">6.0</span></label>
        <input id="mouse-intensity" type="range" min="1" max="10" step="0.1" value="6.0" />
      </div>
      <div class="tuning-row">
        <label for="cam-distance">Camera distance <span id="cam-distance-val">10.0</span></label>
        <input id="cam-distance" type="range" min="6.0" max="20.0" step="0.5" value="10.0" />
      </div>
      <div class="tuning-row">
        <label for="cam-height">Camera height <span id="cam-height-val">1.8</span></label>
        <input id="cam-height" type="range" min="0.5" max="6.0" step="0.1" value="1.8" />
      </div>
      </div>
    </div>
    <div id="instructions">
      <div><strong>Move:</strong> WASD/Arrows or left stick</div>
      <div><strong>Fire:</strong> Space</div>
      <div><strong>Instant Laser:</strong> R</div>
      <div><strong>Boost/Brake:</strong> E / Q</div>
      <div><strong>Roll:</strong> Shift</div>
      <div><strong>Barrel roll:</strong> Shift + Left/Right</div>
      <div><strong>Touch:</strong> Stick + Fire button</div>
    </div>
    <div id="touch-controls" data-mode="off">
      <div id="touch-stick" class="touch-zone" aria-label="Touch stick"></div>
      <button id="touch-fire" class="touch-zone" type="button">Fire</button>
      <button id="touch-roll" class="touch-roll" type="button">Roll</button>
    </div>
  </div>
`

const applySettingTooltips = () => {
  if (!descriptions) return
  for (const [id, text] of Object.entries(descriptions)) {
    const el = document.querySelector(`#${id}`)
    if (!el) continue
    el.setAttribute('title', String(text))
  }
}

applySettingTooltips()

const settings = loadSettings()
const resetSettingsButton = document.querySelector('#reset-settings')
if (resetSettingsButton) {
  resetSettingsButton.addEventListener('click', () => {
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(defaults))
    window.location.reload()
  })
}

initGame({
  container: app,
  menuButton: document.querySelector('#menu-button'),
  toggleMouseButton: document.querySelector('#toggle-mouse'),
  toggleTouchButton: document.querySelector('#toggle-touch'),
  toggleInstructionsButton: document.querySelector('#toggle-instructions'),
  toggleInvertYButton: document.querySelector('#toggle-invert-y'),
  toggleHitboxesButton: document.querySelector('#toggle-hitboxes'),
  toggleShadowsButton: document.querySelector('#toggle-shadows'),
  toggleLevelMeshButton: document.querySelector('#toggle-levelmesh'),
  toggleLaserButton: document.querySelector('#toggle-laser'),
  toggleAutoLockButton: document.querySelector('#toggle-auto-lock'),
  toggleAutoFireButton: document.querySelector('#toggle-auto-fire'),
  toggleDebugButton: document.querySelector('#toggle-debug'),
  settings,
  onSettingsChange: saveSettings,
  touchControls: document.querySelector('#touch-controls'),
  touchStick: document.querySelector('#touch-stick'),
  touchFire: document.querySelector('#touch-fire'),
  touchRoll: document.querySelector('#touch-roll'),
  tuning: {
    speedX: document.querySelector('#speed-x'),
    speedY: document.querySelector('#speed-y'),
    turnResponse: document.querySelector('#turn-response'),
    speedXVal: document.querySelector('#speed-x-val'),
    speedYVal: document.querySelector('#speed-y-val'),
    turnResponseVal: document.querySelector('#turn-response-val'),
    rollStrafe: document.querySelector('#roll-strafe'),
    rollStrafeVal: document.querySelector('#roll-strafe-val'),
    mouseIntensity: document.querySelector('#mouse-intensity'),
    mouseIntensityVal: document.querySelector('#mouse-intensity-val'),
    camDistance: document.querySelector('#cam-distance'),
    camDistanceVal: document.querySelector('#cam-distance-val'),
    camHeight: document.querySelector('#cam-height'),
    camHeightVal: document.querySelector('#cam-height-val'),
  },
  score: {
    scoreEl: document.querySelector('#score-value'),
    comboEl: document.querySelector('#combo-value'),
  },
})
