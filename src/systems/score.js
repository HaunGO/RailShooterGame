export function createScoreSystem({ scoreEl, comboEl }) {
  let score = 0
  let combo = 0

  const updateUI = () => {
    if (scoreEl) scoreEl.textContent = score.toString()
    if (comboEl) comboEl.textContent = combo > 0 ? `x${combo}` : 'x0'
  }

  updateUI()

  return {
    addHit(points = 100) {
      combo = Math.max(1, combo + 1)
      score += points * combo
      updateUI()
    },
    resetCombo() {
      combo = 0
      updateUI()
    },
  }
}
