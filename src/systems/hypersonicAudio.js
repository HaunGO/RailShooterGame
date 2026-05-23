/** Tiny procedural cues for hypersonic tier-ups (requires a user gesture to unlock). */
let audioCtx = null

export function unlockHypersonicAudio() {
  if (typeof AudioContext === 'undefined') return
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
}

export function playHypersonicTierUp(tier) {
  if (!audioCtx) return
  if (audioCtx.state !== 'running') {
    audioCtx.resume().catch(() => {})
    return
  }
  const t0 = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(180 + tier * 100, t0)
  osc.frequency.exponentialRampToValueAtTime(320 + tier * 120, t0 + 0.08)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(0.065, t0 + 0.025)
  gain.gain.linearRampToValueAtTime(0, t0 + 0.14)
  osc.connect(gain).connect(audioCtx.destination)
  osc.start(t0)
  osc.stop(t0 + 0.16)
}
