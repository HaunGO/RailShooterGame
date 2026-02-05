export function createScoreSystem({ scoreEl, comboEl }) {
  let score = 0
  let multiplier = 1

  const updateUI = () => {
    if (scoreEl) scoreEl.textContent = score.toString()
    if (comboEl) comboEl.textContent = `x${multiplier}`
  }

  updateUI()

  return {
    addHit(points = 10) {
      score += points * multiplier
      multiplier += 1
      updateUI()
    },
    resetCombo() {
      multiplier = 1
      updateUI()
    },
  }
}
