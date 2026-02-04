import './style.css'
import { initGame } from './game.js'

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="hud">
    <div id="reticle"></div>
    <div id="debug"></div>
    <div id="score-panel">
      <div id="score-label">Score</div>
      <div id="score-value">0</div>
      <div id="combo-value">x0</div>
    </div>
    <div id="debug-panel">
      <div id="debug-title">Settings</div>
      <div class="debug-buttons">
        <button id="toggle-mouse" type="button">Mouse Aim: Off</button>
        <button id="toggle-hitboxes" type="button">Hitboxes: Off</button>
        <button id="toggle-shadows" type="button">Shadows: Off</button>
        <button id="toggle-levelmesh" type="button">Level Mesh: On</button>
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
        <label for="mouse-tightness">Mouse tightness <span id="mouse-tightness-val">10.0</span></label>
        <input id="mouse-tightness" type="range" min="1.0" max="10.0" step="0.1" value="10.0" />
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
      <div><strong>Boost/Brake:</strong> E / Q</div>
      <div><strong>Roll:</strong> Shift</div>
      <div><strong>Barrel roll:</strong> Shift + Left/Right</div>
    </div>
  </div>
`

initGame({
  container: app,
  toggleMouseButton: document.querySelector('#toggle-mouse'),
  toggleHitboxesButton: document.querySelector('#toggle-hitboxes'),
  toggleShadowsButton: document.querySelector('#toggle-shadows'),
  toggleLevelMeshButton: document.querySelector('#toggle-levelmesh'),
  toggleDebugButton: document.querySelector('#toggle-debug'),
  tuning: {
    speedX: document.querySelector('#speed-x'),
    speedY: document.querySelector('#speed-y'),
    turnResponse: document.querySelector('#turn-response'),
    speedXVal: document.querySelector('#speed-x-val'),
    speedYVal: document.querySelector('#speed-y-val'),
    turnResponseVal: document.querySelector('#turn-response-val'),
    rollStrafe: document.querySelector('#roll-strafe'),
    rollStrafeVal: document.querySelector('#roll-strafe-val'),
    mouseTightness: document.querySelector('#mouse-tightness'),
    mouseTightnessVal: document.querySelector('#mouse-tightness-val'),
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
