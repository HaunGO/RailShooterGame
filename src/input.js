const KEY_BINDINGS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'fire',
  ShiftLeft: 'roll',
  ShiftRight: 'roll',
  KeyQ: 'brake',
  KeyE: 'boost',
  KeyR: 'missiles',
  KeyJ: 'fire',
}

export class InputManager {
  constructor({ canvas, touchStick, touchFire }) {
    this.canvas = canvas
    this.touchStick = touchStick
    this.touchFire = touchFire
    this.keys = new Set()
    this.pointerDown = false
    this.touchSteer = { x: 0, y: 0 }
    this.touchFireHeld = false
    this.mouseAim = { x: 0, y: 0 }
    this.mouseActive = false
    this.mouseEnabled = true
    this.prevState = this._emptyState()
    this.state = this._emptyState()

    window.addEventListener('keydown', (event) => {
      const action = KEY_BINDINGS[event.code]
      if (action) {
        this.keys.add(action)
        event.preventDefault()
      }
    })

    window.addEventListener('keyup', (event) => {
      const action = KEY_BINDINGS[event.code]
      if (action) {
        this.keys.delete(action)
        event.preventDefault()
      }
    })

    this.canvas.addEventListener('pointerdown', () => {
      this.pointerDown = true
    })

    window.addEventListener('pointerup', () => {
      this.pointerDown = false
    })

    // Mouse-driven steering/aiming (cursor position relative to canvas center).
    this.canvas.addEventListener('pointerenter', (event) => {
      if (!this.mouseEnabled) return
      if (event.pointerType === 'mouse') this.mouseActive = true
    })
    this.canvas.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') {
        this.mouseActive = false
        this.mouseAim.x = 0
        this.mouseAim.y = 0
      }
    })
    this.canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return
      if (!this.mouseEnabled) return
      const rect = this.canvas.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const halfW = Math.max(1, rect.width / 2)
      const halfH = Math.max(1, rect.height / 2)
      this.mouseAim.x = this._clampAxis((event.clientX - cx) / halfW)
      this.mouseAim.y = this._clampAxis((event.clientY - cy) / halfH)
      this.mouseActive = true
    })

    this._initTouch()
  }

  setMouseEnabled(enabled) {
    this.mouseEnabled = Boolean(enabled)
    if (!this.mouseEnabled) {
      this.mouseActive = false
      this.mouseAim.x = 0
      this.mouseAim.y = 0
    }
  }

  _emptyState() {
    return {
      steer: { x: 0, y: 0 },
      aim: { x: 0, y: 0 },
      usingMouseAim: false,
      fire: { held: false, pressed: false, released: false },
      boost: { held: false, pressed: false, released: false },
      brake: { held: false, pressed: false, released: false },
      roll: { held: false, pressed: false, released: false },
      dodge: { held: false, pressed: false, released: false },
      missiles: { held: false, pressed: false, released: false },
    }
  }

  _initTouch() {
    if (!this.touchStick || !this.touchFire) return

    let active = false
    let startX = 0
    let startY = 0
    const radius = 50

    this.touchStick.addEventListener('pointerdown', (event) => {
      active = true
      startX = event.clientX
      startY = event.clientY
      this.touchStick.setPointerCapture(event.pointerId)
    })

    this.touchStick.addEventListener('pointermove', (event) => {
      if (!active) return
      const dx = event.clientX - startX
      const dy = event.clientY - startY
      const length = Math.hypot(dx, dy)
      const clamped = Math.min(length, radius)
      const norm = length > 0 ? clamped / length : 0
      this.touchSteer.x = (dx * norm) / radius
      this.touchSteer.y = (dy * norm) / radius
    })

    const endTouch = (event) => {
      if (!active) return
      active = false
      this.touchSteer.x = 0
      this.touchSteer.y = 0
      this.touchStick.releasePointerCapture(event.pointerId)
    }

    this.touchStick.addEventListener('pointerup', endTouch)
    this.touchStick.addEventListener('pointercancel', endTouch)

    this.touchFire.addEventListener('pointerdown', (event) => {
      this.touchFireHeld = true
      this.touchFire.setPointerCapture(event.pointerId)
    })

    const endFire = (event) => {
      this.touchFireHeld = false
      this.touchFire.releasePointerCapture(event.pointerId)
    }

    this.touchFire.addEventListener('pointerup', endFire)
    this.touchFire.addEventListener('pointercancel', endFire)
  }

  _applyButton(state, action, held) {
    state[action].held = held
    state[action].pressed = held && !this.prevState[action].held
    state[action].released = !held && this.prevState[action].held
  }

  _applyDeadzone(value, deadzone = 0.2) {
    if (Math.abs(value) < deadzone) return 0
    return value
  }

  update() {
    const state = this._emptyState()

    const keyboardX = (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0)
    const keyboardY = (this.keys.has('down') ? 1 : 0) - (this.keys.has('up') ? 1 : 0)

    const pad = navigator.getGamepads ? navigator.getGamepads()[0] : null
    const padX = pad ? this._applyDeadzone(pad.axes[0]) : 0
    const padY = pad ? this._applyDeadzone(pad.axes[1]) : 0

    const usingMouse = this.mouseEnabled && this.mouseActive
    const mouseX = usingMouse ? this.mouseAim.x : 0
    const mouseY = usingMouse ? this.mouseAim.y : 0

    state.steer.x = this._clampAxis(keyboardX + padX + this.touchSteer.x + mouseX)
    state.steer.y = this._clampAxis(keyboardY + padY + this.touchSteer.y + mouseY)
    state.aim.x = usingMouse ? this.mouseAim.x : state.steer.x
    state.aim.y = usingMouse ? this.mouseAim.y : state.steer.y
    state.usingMouseAim = usingMouse

    const fireHeld =
      this.pointerDown ||
      this.keys.has('fire') ||
      this.touchFireHeld ||
      (pad && (pad.buttons[0]?.pressed || pad.buttons[2]?.pressed))

    const boostHeld = this.keys.has('boost') || (pad && pad.buttons[3]?.pressed)
    const brakeHeld = this.keys.has('brake') || (pad && pad.buttons[4]?.pressed)
    const rollHeld = this.keys.has('roll') || (pad && pad.buttons[1]?.pressed)
    const dodgeHeld = this.keys.has('dodge') || (pad && pad.buttons[0]?.pressed)
    const missilesHeld = this.keys.has('missiles') || (pad && pad.buttons[5]?.pressed)

    this._applyButton(state, 'fire', fireHeld)
    this._applyButton(state, 'boost', boostHeld)
    this._applyButton(state, 'brake', brakeHeld)
    this._applyButton(state, 'roll', rollHeld)
    this._applyButton(state, 'dodge', dodgeHeld)
    this._applyButton(state, 'missiles', missilesHeld)

    this.prevState = this.state
    this.state = state
  }

  _clampAxis(value) {
    return Math.max(-1, Math.min(1, value))
  }

  getState() {
    return this.state
  }
}
