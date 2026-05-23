# Project Status Summary

## Overview
- Web-based rail shooter MVP prototype in Three.js.
- Chase camera, low‑poly visuals, auto‑forward rail, basic combat loop.
- Local Git repo with multiple commits; latest work is saved.

## Current Gameplay Features
- **Auto‑forward movement** on a rail with bounds (wider horizontal + taller vertical).
- **Player controls**: keyboard/gamepad steering; optional mouse aim modes (Off/On/Direct).
- **Barrel roll**: Shift + Left/Right, full 360° roll with adjustable strafe burst.
- **Boost / Brake**: E/Q modifies forward speed.
- **Projectiles**: fire with Space; bullets keep their own heading after firing.
- **Targets**: simple red drones spawn ahead; disappear on hit; impact flashes.
- **Player hits**: ship flickers on impact; multi‑sphere hitbox for better fit.
- **Scoring**: score + combo HUD; hits add points, player hit resets combo.

## Visuals & HUD
- **Ship color**: deep pale royal blue.
- **Crosshair**: boresight projection (ship nose direction).
- **World video**: optional POV backdrop from `public/video/pov-sample.mp4` (`worldVideoEnabled`, **World video** in Settings) — camera-local frustum fill + **cover** UVs (`src/systems/worldVideoLayout.js`).
- **Level mesh**: translucent grid plane + tinted plane at ship height, tiled forward; toggle on/off.
- **Shadows**: fake circular shadows for ship/targets; toggle on/off (default on).
- **HUD layout**: score at top center; instructions bottom right; settings panel top left.

## Debug / Settings Panel
- Toggle buttons: Mouse Aim, Hitboxes, Shadows, Level Mesh, Debug.
- Sliders:
  - Strafe Speed (default 6.0)
  - Vertical Speed (default 6.0)
  - Turn Response (default 3.0)
  - Roll Strafe (default 1.6)
  - Mouse Tightness (default 10.0)
  - Camera Distance (default 10.0)
  - Camera Height (default 1.8)

## File/Module Structure
- `src/game.js`: main orchestration (render loop, wiring systems).
- `src/input.js`: input abstraction + mouse modes.
- `src/entities.js`: player/target/projectile geometry.
- `src/systems/`:
  - `environment.js`, `crosshair.js`, `targets.js`,
  - `projectiles.js`, `collisions.js`, `effects.js`,
  - `score.js`.
- `docs/ProjectBrief.md`, `docs/PRD.md`: planning artifacts.

## Current Network Access
- Dev server: `npm run dev` — see [vite.config.js](../vite.config.js) (default port **1001**, `--host` enabled in config).
- **Project board:** [http://localhost:1001/dashboard.html](http://localhost:1001/dashboard.html) (Kanban-style view; data in [public/project-board.json](../public/project-board.json)).
- LAN URL is printed by Vite (e.g. `http://<your-LAN-IP>:1001/`); it changes with your network interface.

## Known TODO / Next Steps
- Mobile-friendly touch controls (two‑thumb layout) and responsive HUD scaling.
- Enemy behaviors beyond static targets (strafe, turret, mid-boss).
- Level beats / pacing script.
- Optional camera smoothing + FOV kick polish.
- Optional shield/health and damage UI.

