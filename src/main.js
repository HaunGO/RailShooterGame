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
    // Migrate old keys for existing sessionStorage
    const migrated = {
      ...parsed,
      instantLaserEnabled: parsed.instantLaserEnabled ?? parsed.autoLockEnabled,
      crosshairFollowsMouse: parsed.crosshairFollowsMouse ?? parsed.reticleFollowsMouse ?? defaults.crosshairFollowsMouse ?? false,
    }
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
  <div id="hud-laser-wrap">
    <svg id="hud-laser" class="hud-laser" aria-hidden="true"><line id="hud-laser-line" x1="0" y1="0" x2="0" y2="0" /></svg>
  </div>
  <div id="hypersonic-vignette" class="hypersonic-vignette" aria-hidden="true"></div>
  <svg id="hypersonic-speed-lines" class="hypersonic-speed-lines" aria-hidden="true"></svg>
  <div id="hud">
    <div id="crosshair" aria-hidden="true"><span class="crosshair-cross-h"></span><span class="crosshair-cross-v"></span></div>
    <div id="debug"></div>
    <button id="menu-button" type="button" class="hud-menu-btn" aria-controls="debug-panel" aria-expanded="false" aria-label="Open HUD settings">
      <span class="hud-menu-btn__ico" aria-hidden="true">⚙</span>
      <span class="hud-menu-btn__label">HUD</span>
    </button>
    <div id="score-panel">
      <div id="score-label">Score</div>
      <div id="score-value">0</div>
      <div id="combo-value">x0</div>
    </div>
    <div id="hypersonic-hud" class="hypersonic-hud" aria-hidden="true">
      <div class="hypersonic-hud__badge">HYPERSONIC</div>
      <div class="hypersonic-hud__heat-track"><div id="hypersonic-heat-fill" class="hypersonic-hud__heat-fill"></div></div>
      <div class="hypersonic-hud__row">
        <span id="hypersonic-tier" class="hypersonic-hud__tier">PULSE</span>
        <span id="hypersonic-streak" class="hypersonic-hud__streak"></span>
      </div>
    </div>
    <div id="debug-panel" class="hud-settings" data-open="false" role="region" aria-label="HUD settings and tuning">
      <div class="hud-settings__head">
        <div id="debug-title" class="hud-settings__title">Options</div>
        <p class="hud-settings__hint">Utility controls — icons are decorative.</p>
      </div>

      <section class="hud-settings__section" aria-labelledby="hud-sec-input">
        <h2 id="hud-sec-input" class="hud-settings__section-title"><span aria-hidden="true">🎮</span> Input</h2>
        <div class="hud-settings__grid">
          <button id="toggle-mouse" type="button" class="hud-toggle" aria-pressed="false" aria-label="Mouse aim, off">
            <span class="hud-toggle__ico" aria-hidden="true">🖱️</span>
            <span class="hud-toggle__name">Mouse aim</span>
            <span class="hud-toggle__state">Off</span>
          </button>
          <button id="toggle-crosshair-mouse" type="button" class="hud-toggle hud-toggle--mode" aria-label="Crosshair follows ship aim">
            <span class="hud-toggle__ico" aria-hidden="true">🎯</span>
            <span class="hud-toggle__name">Crosshair</span>
            <span class="hud-toggle__state">Ship</span>
          </button>
          <button id="toggle-touch" type="button" class="hud-toggle hud-toggle--mode" aria-label="Touch controls, off">
            <span class="hud-toggle__ico" aria-hidden="true">👆</span>
            <span class="hud-toggle__name">Touch</span>
            <span class="hud-toggle__state">Off</span>
          </button>
          <button id="toggle-invert-y" type="button" class="hud-toggle" aria-pressed="false" aria-label="Invert vertical steering, off">
            <span class="hud-toggle__ico" aria-hidden="true">↕️</span>
            <span class="hud-toggle__name">Invert Y</span>
            <span class="hud-toggle__state">Off</span>
          </button>
        </div>
      </section>

      <section class="hud-settings__section" aria-labelledby="hud-sec-view">
        <h2 id="hud-sec-view" class="hud-settings__section-title"><span aria-hidden="true">👁️</span> View</h2>
        <div class="hud-settings__grid">
          <button id="toggle-instructions" type="button" class="hud-toggle" aria-pressed="false" aria-label="Control tips on screen, off">
            <span class="hud-toggle__ico" aria-hidden="true">ℹ️</span>
            <span class="hud-toggle__name">Tips</span>
            <span class="hud-toggle__state">Off</span>
          </button>
          <button id="toggle-hitboxes" type="button" class="hud-toggle" aria-pressed="false" aria-label="Show hitboxes, off">
            <span class="hud-toggle__ico" aria-hidden="true">🔲</span>
            <span class="hud-toggle__name">Hitboxes</span>
            <span class="hud-toggle__state">Off</span>
          </button>
          <button id="toggle-shadows" type="button" class="hud-toggle" aria-pressed="false" aria-label="Ship and target shadows, off">
            <span class="hud-toggle__ico" aria-hidden="true">🌑</span>
            <span class="hud-toggle__name">Shadows</span>
            <span class="hud-toggle__state">Off</span>
          </button>
          <button id="toggle-levelmesh" type="button" class="hud-toggle" aria-pressed="false" aria-label="Level grid mesh, off">
            <span class="hud-toggle__ico" aria-hidden="true">📐</span>
            <span class="hud-toggle__name">Grid</span>
            <span class="hud-toggle__state">Off</span>
          </button>
          <button id="toggle-rail" type="button" class="hud-toggle" aria-pressed="true" aria-label="Rail path surface, on">
            <span class="hud-toggle__ico" aria-hidden="true">🛤️</span>
            <span class="hud-toggle__name">Rail path</span>
            <span class="hud-toggle__state">On</span>
          </button>
          <button id="toggle-laser" type="button" class="hud-toggle" aria-pressed="false" aria-label="Laser sight line, off">
            <span class="hud-toggle__ico" aria-hidden="true">🔦</span>
            <span class="hud-toggle__name">Laser sight</span>
            <span class="hud-toggle__state">Off</span>
          </button>
        </div>
      </section>

      <section class="hud-settings__section" aria-labelledby="hud-sec-world">
        <h2 id="hud-sec-world" class="hud-settings__section-title"><span aria-hidden="true">🌍</span> World view</h2>
        <div class="hud-settings__grid hud-settings__grid--narrow">
          <button id="toggle-world-video" type="button" class="hud-toggle" aria-pressed="false" aria-label="World POV video backdrop, off">
            <span class="hud-toggle__ico" aria-hidden="true">🎬</span>
            <span class="hud-toggle__name">POV video</span>
            <span class="hud-toggle__state">Off</span>
          </button>
          <button id="toggle-world-immersion" type="button" class="hud-toggle" aria-pressed="false" aria-label="POV inner dome, off">
            <span class="hud-toggle__ico" aria-hidden="true">🥣</span>
            <span class="hud-toggle__name">Inner dome</span>
            <span class="hud-toggle__state">Off</span>
          </button>
        </div>
        <div class="hud-settings__world-tuning hud-tuning" aria-label="World view tuning">
          <div class="hud-tuning__row">
            <label class="hud-tuning__label" for="world-dome-depth"><span class="hud-tuning__ico" aria-hidden="true">🥣</span> Dome + zoom <span class="hud-tuning__val" id="world-dome-depth-val">180</span></label>
            <input id="world-dome-depth" type="range" min="0" max="500" step="2" value="180" />
          </div>
        </div>
      </section>

      <section class="hud-settings__section" aria-labelledby="hud-sec-combat">
        <h2 id="hud-sec-combat" class="hud-settings__section-title"><span aria-hidden="true">⚡</span> Combat</h2>
        <div class="hud-settings__grid hud-settings__grid--narrow">
          <button id="toggle-auto-lock" type="button" class="hud-toggle" aria-pressed="false" aria-label="Instant laser on R, off">
            <span class="hud-toggle__ico" aria-hidden="true">⚡</span>
            <span class="hud-toggle__name">Instant laser</span>
            <span class="hud-toggle__state">Off</span>
          </button>
          <button id="toggle-auto-fire" type="button" class="hud-toggle" aria-pressed="false" aria-label="Auto fire when locked, off">
            <span class="hud-toggle__ico" aria-hidden="true">✳️</span>
            <span class="hud-toggle__name">Auto fire</span>
            <span class="hud-toggle__state">Off</span>
          </button>
        </div>
      </section>

      <section class="hud-settings__section" aria-labelledby="hud-sec-tuning">
        <h2 id="hud-sec-tuning" class="hud-settings__section-title"><span aria-hidden="true">🎚️</span> Tuning</h2>
        <div id="tuning" class="hud-tuning">
          <div class="hud-tuning__row">
            <label class="hud-tuning__label" for="forward-speed"><span class="hud-tuning__ico" aria-hidden="true">⏩</span> Forward <span class="hud-tuning__val" id="forward-speed-val">12.0</span></label>
            <input id="forward-speed" type="range" min="4" max="24" step="0.5" value="12.0" />
          </div>
          <div class="hud-tuning__row">
            <label class="hud-tuning__label" for="speed-x"><span class="hud-tuning__ico" aria-hidden="true">↔️</span> Strafe <span class="hud-tuning__val" id="speed-x-val">6.0</span></label>
            <input id="speed-x" type="range" min="1" max="10" step="0.1" value="6.0" />
          </div>
          <div class="hud-tuning__row">
            <label class="hud-tuning__label" for="speed-y"><span class="hud-tuning__ico" aria-hidden="true">↕️</span> Vertical <span class="hud-tuning__val" id="speed-y-val">6.0</span></label>
            <input id="speed-y" type="range" min="1" max="10" step="0.1" value="6.0" />
          </div>
          <div class="hud-tuning__row">
            <label class="hud-tuning__label" for="turn-response"><span class="hud-tuning__ico" aria-hidden="true">🔁</span> Turn <span class="hud-tuning__val" id="turn-response-val">3.0</span></label>
            <input id="turn-response" type="range" min="1" max="10" step="0.1" value="3.0" />
          </div>
          <div class="hud-tuning__row">
            <label class="hud-tuning__label" for="roll-strafe"><span class="hud-tuning__ico" aria-hidden="true">🔃</span> Roll strafe <span class="hud-tuning__val" id="roll-strafe-val">1.6</span></label>
            <input id="roll-strafe" type="range" min="1.0" max="3.0" step="0.1" value="1.6" />
          </div>
          <div class="hud-tuning__row">
            <label class="hud-tuning__label" for="mouse-intensity"><span class="hud-tuning__ico" aria-hidden="true">🖱️</span> Mouse aim <span class="hud-tuning__val" id="mouse-intensity-val">6.0</span></label>
            <input id="mouse-intensity" type="range" min="1" max="10" step="0.1" value="6.0" />
          </div>
          <div class="hud-tuning__row">
            <label class="hud-tuning__label" for="cam-distance"><span class="hud-tuning__ico" aria-hidden="true">📷</span> Cam distance <span class="hud-tuning__val" id="cam-distance-val">10.0</span></label>
            <input id="cam-distance" type="range" min="6.0" max="20.0" step="0.5" value="10.0" />
          </div>
          <div class="hud-tuning__row">
            <label class="hud-tuning__label" for="cam-height"><span class="hud-tuning__ico" aria-hidden="true">⬆️</span> Cam height <span class="hud-tuning__val" id="cam-height-val">1.8</span></label>
            <input id="cam-height" type="range" min="0.5" max="6.0" step="0.1" value="1.8" />
          </div>
        </div>
      </section>

      <section class="hud-settings__section hud-settings__section--footer" aria-labelledby="hud-sec-util">
        <h2 id="hud-sec-util" class="hud-settings__section-title"><span aria-hidden="true">🛠️</span> Utility</h2>
        <div class="hud-settings__grid hud-settings__grid--narrow">
          <button id="reset-settings" type="button" class="hud-toggle hud-toggle--action" aria-label="Reset all settings to defaults and reload">
            <span class="hud-toggle__ico" aria-hidden="true">🔄</span>
            <span class="hud-toggle__name">Reset</span>
            <span class="hud-toggle__state hud-toggle__state--muted">↻</span>
          </button>
          <button id="toggle-debug" type="button" class="hud-toggle" aria-pressed="false" aria-label="Debug stats overlay, off">
            <span class="hud-toggle__ico" aria-hidden="true">🐛</span>
            <span class="hud-toggle__name">Debug</span>
            <span class="hud-toggle__state">Off</span>
          </button>
        </div>
      </section>
    </div>
    <div id="instructions">
      <div><strong>Move:</strong> WASD/Arrows or left stick</div>
      <div><strong>Fire:</strong> Space</div>
      <div><strong>Instant Laser:</strong> R</div>
      <div><strong>Boost/Brake:</strong> E / Q</div>
      <div><strong>Hypersonic:</strong> hold boost while your nose-velocity beats bullet speed — FX ramp in smoothly; max tier bonuses while you stay in the gate.</div>
      <div><strong>Roll:</strong> Shift</div>
      <div><strong>Barrel roll:</strong> Shift + Left/Right</div>
      <div><strong>Touch:</strong> Stick + Fast/Slow + Fire + Instant Laser + Roll</div>
    </div>
    <div id="touch-controls" data-mode="off">
      <button id="touch-fast" class="touch-fast" type="button">Fast</button>
      <div id="touch-stick" class="touch-zone" aria-label="Touch stick"></div>
      <button id="touch-slow" class="touch-slow" type="button">Slow</button>
      <button id="touch-fire" class="touch-zone" type="button">Fire</button>
      <button id="touch-laser" class="touch-laser" type="button">Instant Laser</button>
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
  toggleCrosshairMouseButton: document.querySelector('#toggle-crosshair-mouse'),
  toggleTouchButton: document.querySelector('#toggle-touch'),
  toggleInstructionsButton: document.querySelector('#toggle-instructions'),
  toggleInvertYButton: document.querySelector('#toggle-invert-y'),
  toggleHitboxesButton: document.querySelector('#toggle-hitboxes'),
  toggleShadowsButton: document.querySelector('#toggle-shadows'),
  toggleLevelMeshButton: document.querySelector('#toggle-levelmesh'),
  toggleRailButton: document.querySelector('#toggle-rail'),
  toggleWorldVideoButton: document.querySelector('#toggle-world-video'),
  toggleWorldImmersionButton: document.querySelector('#toggle-world-immersion'),
  toggleLaserButton: document.querySelector('#toggle-laser'),
  toggleAutoLockButton: document.querySelector('#toggle-auto-lock'),
  toggleAutoFireButton: document.querySelector('#toggle-auto-fire'),
  toggleDebugButton: document.querySelector('#toggle-debug'),
  settings,
  onSettingsChange: saveSettings,
  touchControls: document.querySelector('#touch-controls'),
  touchStick: document.querySelector('#touch-stick'),
  touchFast: document.querySelector('#touch-fast'),
  touchSlow: document.querySelector('#touch-slow'),
  touchFire: document.querySelector('#touch-fire'),
  touchLaser: document.querySelector('#touch-laser'),
  touchRoll: document.querySelector('#touch-roll'),
  worldView: {
    domeDepth: document.querySelector('#world-dome-depth'),
    domeDepthVal: document.querySelector('#world-dome-depth-val'),
  },
  tuning: {
    forwardSpeed: document.querySelector('#forward-speed'),
    forwardSpeedVal: document.querySelector('#forward-speed-val'),
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
    scoreHud: document.querySelector('#score-panel'),
  },
})
