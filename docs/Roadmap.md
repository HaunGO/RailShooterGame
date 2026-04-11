# Roadmap — Rail Shooter

Checkpoint-oriented plan from the current **web MVP** toward a **shippable product** and **App Store** presence. Detailed product intent remains in [PRD.md](PRD.md); implementation snapshot in [Status.md](Status.md).

## Phase 0 — Baseline (done)

- Vite + Three.js loop, rail flight, combat slice, settings panel, modular `src/systems/`.
- Docs: brief, PRD, status, deploy notes, refactor plan.

## Phase 1 — Stabilize and polish the web game

Priorities aligned with [Status.md](Status.md):

- Touch-friendly controls and responsive HUD.
- Enemy variety beyond static drones (behaviors, waves).
- Level pacing / beats (scripted segments, breather, boss-shaped targets).
- Optional: camera smoothing, FOV kick, shield/health UI.

**Exit criteria:** one ~4–5 minute level feels complete on keyboard, gamepad, and a mid-range phone target.

## Phase 2 — Ship the web build

- Production builds (`npm run build`), performance pass on low-end mobile.
- Hosting per [DeployToWebUrl.md](DeployToWebUrl.md) (e.g. Vercel/Netlify); optional portfolio redirect or subpath `base`.
- Smoke-test production: asset paths, deploy reload behavior ([index.html](../index.html) production check), offline/cache expectations.

## Phase 3 — App Store track (native shell)

The game stays a **web app** at its core; the App Store deliverable is typically a **thin native wrapper** around a **WKWebView** (or equivalent) plus store metadata.

Suggested toolchain (decide explicitly before heavy investment):

- **Capacitor** (or similar): iOS project generation, splash/icon pipeline, safe-area handling, optional native plugins later.
- **Apple Developer:** bundle ID, signing, provisioning, TestFlight, App Review notes (controls, privacy nutrition, data collection if any).

**Technical checklist:**

- Full-screen layout, orientation policy, safe areas, notches.
- Input: touch targets, gamepad/MFi if claimed, no broken keyboard focus on webview.
- Audio session / mute switch behavior if sound is added.
- Performance: same 30+ FPS targets on reference devices; avoid desktop-only assumptions.
- Offline: if the app must work offline, bundle assets and define update strategy (store updates vs OTA web — OTA has policy constraints).

**Exit criteria:** TestFlight build playable end-to-end; no critical WebView or input regressions vs mobile Safari.

## Phase 4 — Store listing and release

- Screenshots, preview video, age rating, review notes (how to play in ~30s).
- Versioning scheme; release notes habit.
- Post-launch: crash/analytics (minimal, privacy-respecting) if desired.

## Repository / code organization

**Done incrementally (avoid big-bang moves):**

- Continue extracting responsibilities per [GameRefactorPlan.md](GameRefactorPlan.md) so `game.js` stays orchestration-only.
- Keep `src/systems/` as the home for gameplay verticals; add thin `src/course/` or `src/level/` when scripting grows.

**Optional later splits** (only when a folder is crowded):

- `src/audio/`, `src/ui/` beyond settings, `src/level/` for data-driven segments.

## How to use this doc

- Treat phases as **gates**: finish exit criteria before shifting primary focus (e.g. do not chase App Store signing while core level design is still a placeholder).
- Update **Phase 1** bullets as items ship; keep **Phase 3** checklist in sync with the wrapper tool you choose.
