# PRD — Rail Shooter MVP (Lean)

### Summary
- Build a small, performant, browser-based rail shooter MVP: chase camera, low-poly visuals, mobile-friendly, gamepad support.
- Ship **one** playable level (~4–5 minutes) with a complete playable loop and minimal HUD.

### Core gameplay loop (MVP)
- **Rail flight (auto-forward)** → target waves → rings/pickups → turret cluster → mid-boss → breather → final boss → score screen.

### Player actions (MVP)
- **Steer (Vector2)**: bounded movement box.
- **Fire**: rapid shots.
- **Charge shot**: hold fire then release (defer if needed).
- **Roll**: brief deflect/invulnerability window (defer if needed).
- **Boost / Brake**: speed control (defer if needed).
- **Dodge**: lateral burst + cooldown (defer if needed).
- **Missiles**: limited ammo + simple lock cone (defer if needed).

### Enemies (MVP set)
- **Drone**: simple forward target, low HP.
- **Strafe Fighter**: lateral sweep patterns, light fire.
- **Turret**: fixed position, burst fire, weak spot.
- **Mid-boss**: large target, 2 phases, slow telegraphs.
- **Final boss**: multi-phase, weak points, telegraphed attacks.

### Pickups (MVP)
- **Rings**: score/combo extender; light guidance to teach pathing.
- (Defer) **Shield restore**, **missile ammo**, **power-up tiers**.

### HUD (minimal)
- **Reticle** (boresight / gunsight).
- **Shield meter** (not required for earliest vertical slice).
- **Missiles count** (when missiles exist).
- **Score / combo** (simple).

### Accessibility toggles (minimum viable)
- **Input remapping** (keys + gamepad).
- **Reduced motion**: lower camera lag + reduce FOV kick on boost/brake.
- **Aim assist**: toggle (light cone snap / magnetism).
- (Optional) **Invert Y** separate per device (mouse vs stick).

### Input & platform specs (MVP)
- **Keyboard**: WASD/Arrows steer; Space fire (current); Shift roll (later); Q/E brake/boost (later).
- **Gamepad**: left stick steer; face button fire; shoulder buttons missiles/roll/boost (later).
- **Mouse (optional)**: cursor aim/steer toggle; reticle is boresight (current design direction).
- **Touch (later)**: two-thumb (left stick + right fire/charge) with big hit targets.

### Technical requirements (MVP)
- **Renderer**: Three.js + WebGL.
- **Loop**: fixed timestep update + render loop.
- **Performance**: pooling for projectiles/enemies; keep materials simple; avoid heavy postFX.
- **Controller support**: Web Gamepad API.

### Out of scope (explicit)
- Multiplayer.
- Branching campaign/progression.
- Advanced VFX, high-res textures, complex shaders.
- Large audio pipeline (voice acting, dynamic music).

### Milestones (lean)
- **Vertical slice (ASAP)**: auto-forward + chase cam + steer bounds + fire + one target type + hit feedback.
- **MVP level**: add 2–3 enemy types, rings, simple bosses, minimal HUD, end screen.

