const NS = 'http://www.w3.org/2000/svg'
/** Normalized panel; stretched with preserveAspectRatio none. */
const VB = 100
/** Vanishing point (comic “forward” bias slightly past center). */
const FP = { x: 54, y: 46 }
const RADIAL_COUNT = 68
const SWEEP_COUNT = 22

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function randomEdgePoint() {
  const L = VB
  const p = Math.random() * (4 * L)
  if (p < L) return { x: p, y: 0 }
  if (p < 2 * L) return { x: L, y: p - L }
  if (p < 3 * L) return { x: 3 * L - p, y: L }
  return { x: 0, y: 4 * L - p }
}

/**
 * Comic-book radial speed lines + horizontal sweeps in screen space (SVG overlay).
 * Strength drives opacity and a light whole-panel wobble.
 */
export function createHypersonicSpeedLines(svgEl) {
  if (!svgEl) {
    return { update() {} }
  }

  let built = false
  /** @type {SVGGElement | null} */
  let root = null

  function build() {
    svgEl.textContent = ''
    svgEl.setAttribute('viewBox', `0 0 ${VB} ${VB}`)
    svgEl.setAttribute('preserveAspectRatio', 'none')

    root = document.createElementNS(NS, 'g')
    root.setAttribute('class', 'hypersonic-speed-lines__root')

    for (let i = 0; i < RADIAL_COUNT; i += 1) {
      const outer = randomEdgePoint()
      const t0 = 0.05 + Math.random() * 0.26
      const inner = {
        x: FP.x + (outer.x - FP.x) * t0,
        y: FP.y + (outer.y - FP.y) * t0,
      }
      const line = document.createElementNS(NS, 'line')
      line.setAttribute('x1', inner.x.toFixed(2))
      line.setAttribute('y1', inner.y.toFixed(2))
      line.setAttribute('x2', outer.x.toFixed(2))
      line.setAttribute('y2', outer.y.toFixed(2))
      line.setAttribute('stroke-width', (0.09 + Math.random() * 0.28).toFixed(3))
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute(
        'class',
        Math.random() > 0.38
          ? 'hypersonic-speed-lines__stroke hypersonic-speed-lines__stroke--hot'
          : 'hypersonic-speed-lines__stroke hypersonic-speed-lines__stroke--ink'
      )
      line.style.animationDuration = `${0.22 + Math.random() * 0.55}s`
      line.style.animationDelay = `${-Math.random() * 0.8}s`
      root.appendChild(line)
    }

    for (let i = 0; i < SWEEP_COUNT; i += 1) {
      const y = 6 + Math.random() * 88
      const drift = (Math.random() - 0.5) * 7
      const line = document.createElementNS(NS, 'line')
      const fromLeft = Math.random() > 0.5
      line.setAttribute('x1', fromLeft ? '-4' : String(VB + 4))
      line.setAttribute('y1', String(y))
      line.setAttribute('x2', fromLeft ? String(VB + 4) : '-4')
      line.setAttribute('y2', String(y + drift))
      line.setAttribute('stroke-width', (0.06 + Math.random() * 0.14).toFixed(3))
      line.setAttribute('stroke-linecap', 'round')
      line.setAttribute('class', 'hypersonic-speed-lines__stroke hypersonic-speed-lines__stroke--sweep')
      line.style.opacity = String(0.28 + Math.random() * 0.42)
      line.style.animationDuration = `${0.35 + Math.random() * 0.5}s`
      line.style.animationDelay = `${-Math.random() * 0.6}s`
      root.appendChild(line)
    }

    svgEl.appendChild(root)
    built = true
  }

  /**
   * @param {object} h
   * @param {number} h.blend
   * @param {number} h.heat
   * @param {number} h.tier
   */
  function update(h) {
    const b = typeof h.fxBlend === 'number' ? h.fxBlend : h.blend
    const strength = clamp01(b * (0.48 + 0.52 * h.heat) * (1 + h.tier * 0.08))
    if (strength < 0.025) {
      svgEl.style.opacity = '0'
      if (root) root.setAttribute('transform', 'translate(0,0)')
      return
    }
    if (!built) build()

    svgEl.style.opacity = String(strength * 0.94)

    const t = performance.now() * 0.001
    const wx = Math.sin(t * 13.2) * 0.55 * strength + Math.sin(t * 7.1) * 0.25 * strength
    const wy = Math.cos(t * 11.4) * 0.4 * strength
    if (root) root.setAttribute('transform', `translate(${wx.toFixed(2)},${wy.toFixed(2)})`)
  }

  return { update }
}
