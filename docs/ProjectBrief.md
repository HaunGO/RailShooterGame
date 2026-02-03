# Project Brief — Rail Shooter MVP (Web)

### Game concept & target platforms
- **Concept**: Web-based rail shooter inspired by StarFox 64. Auto-forward flight down a “rail” with a chase camera. Low‑poly visuals, flat colors, performance-first.
- **Platforms**: Mobile phones + laptops (modern browsers). Supports keyboard and gamepads; optional mouse/touch control.

### MVP success criteria (measurable)
- **One playable level**: ~4–5 minutes start-to-finish on a fixed rail path.
- **Performance**: \(\ge 30\) FPS on a mid-range phone; \(\ge 60\) FPS on a mid-range laptop.
- **Input**: Keyboard + at least one gamepad profile works end-to-end (move + shoot + core actions).
- **Playable loop**: Player can steer within bounds, shoot targets, take hits (feedback), and finish the level.

### Non-goals (explicit)
- Multiplayer / online features.
- Procedural generation or branching paths.
- High-end rendering (PBR pipelines, heavy post-processing, high-poly assets, large textures).
- Full settings suite (beyond minimum accessibility toggles).
- Complex physics simulation.

### Key risks + mitigations
- **Performance risk (mobile)**:
  - Mitigate with low-poly meshes, minimal materials, object pooling, and simple effects.
  - Prefer fewer draw calls over fancy visuals; add optional dynamic resolution toggle.
- **Controls risk (feel across devices)**:
  - Input abstraction early; keep “flight invert” as a toggle later.
  - Provide on-screen instructions and quick tuning controls during development.
- **Scope risk (feature creep)**:
  - Ship a vertical slice early; lock MVP to one level + minimal enemy set + minimal HUD.
  - Defer non-essential systems (upgrades, campaign, cutscenes, advanced bosses).

