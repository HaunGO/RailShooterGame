/**
 * Hypersonic HUD (heat bar, tier, streak) — hidden for now; hypersonic feedback is FX + POV only.
 */
export function createHypersonicHud({ root }) {
  if (root) {
    root.style.display = 'none'
    root.setAttribute('aria-hidden', 'true')
  }

  function update() {}

  return { update }
}
