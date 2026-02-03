import './style.css'
import { initGame } from './game.js'

const app = document.querySelector('#app')
app.innerHTML = `
  <div id="hud">
    <div id="reticle"></div>
    <div id="debug"></div>
    <button id="toggle-mouse" type="button">Mouse Aim: On</button>
    <div id="tuning">
      <div class="tuning-row">
        <label for="speed-x">Strafe speed <span id="speed-x-val">7.5</span></label>
        <input id="speed-x" type="range" min="2" max="14" step="0.5" value="7.5" />
      </div>
      <div class="tuning-row">
        <label for="speed-y">Vertical speed <span id="speed-y-val">7.5</span></label>
        <input id="speed-y" type="range" min="1" max="14" step="0.5" value="7.5" />
      </div>
      <div class="tuning-row">
        <label for="turn-response">Turn response <span id="turn-response-val">0.07</span></label>
        <input id="turn-response" type="range" min="0.03" max="0.18" step="0.01" value="0.07" />
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
  },
})
