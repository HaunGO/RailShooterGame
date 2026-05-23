import { GAME_CONFIG } from '../config/constants.js'

export function createScoreSystem({ scoreEl, comboEl, scoreHud }) {
  let score = 0
  let multiplier = 1
  let hyperGate = false
  let hyperHeat = 0
  let hyperTier = 0

  const updateUI = () => {
    if (scoreEl) scoreEl.textContent = score.toString()
    if (comboEl) {
      comboEl.textContent = hyperGate ? `HYPER x${multiplier}` : `x${multiplier}`
    }
    if (scoreHud) {
      scoreHud.dataset.hypersonic = hyperGate ? 'true' : 'false'
      scoreHud.dataset.hypersonicTier = String(hyperTier)
    }
  }

  updateUI()

  return {
    /** Call each frame before hits resolve so bonuses match current gate / heat / tier. */
    syncHypersonicFrame({ raw, heat, tier }) {
      hyperGate = Boolean(raw)
      hyperHeat = typeof heat === 'number' ? heat : 0
      hyperTier = typeof tier === 'number' ? tier : 0
      updateUI()
    },
    addHit(points = 10) {
      let pt = points
      if (hyperGate) {
        pt = Math.round(pt * GAME_CONFIG.hypersonicHitPointScale)
        pt += hyperTier * GAME_CONFIG.hypersonicTierFlatBonus
        pt += Math.round(points * hyperHeat * GAME_CONFIG.hypersonicHeatScoreFactor)
      }
      const comboStep = hyperGate ? GAME_CONFIG.hypersonicComboStep : 1
      score += pt * multiplier
      multiplier += comboStep
      updateUI()
    },
    resetCombo() {
      multiplier = 1
      updateUI()
    },
  }
}
