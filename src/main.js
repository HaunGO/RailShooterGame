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
    <button id="toggle-mouse" type="button">Mouse Aim: Off</button>
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
    </div>
    <div id="instructions">
      <div><strong>Move:</strong> WASD/Arrows or left stick</div>
      <div><strong>Fire:</strong> Space</div>
      <div><strong>Boost/Brake:</strong> E / Q</div>
      <div><strong>Roll:</strong> Shift</div>
      <div><strong>Missiles:</strong> R</div>
    </div>
  </div>
`

initGame({
  container: app,
  toggleMouseButton: document.querySelector('#toggle-mouse'),
  tuning: {
    speedX: document.querySelector('#speed-x'),
    speedY: document.querySelector('#speed-y'),
    turnResponse: document.querySelector('#turn-response'),
    speedXVal: document.querySelector('#speed-x-val'),
    speedYVal: document.querySelector('#speed-y-val'),
    turnResponseVal: document.querySelector('#turn-response-val'),
    rollStrafe: document.querySelector('#roll-strafe'),
    rollStrafeVal: document.querySelector('#roll-strafe-val'),
  },
  score: {
    scoreEl: document.querySelector('#score-value'),
    comboEl: document.querySelector('#combo-value'),
  },
})
