# TIDELOCK HARBOR

A tactical multiplayer-style first-person shooter built with Three.js (threejs-fps-02 entry). Pits TIDE against REEF in a classic plant-or-defuse bomb scenario. First team to 5 rounds wins.

## How to Run

Serve the repository root using any local static file server (e.g. `npx serve`) or open `game/index.html` directly in a modern browser with WebGL2 support.

## Controls

- **WASD** / **Arrows**: Move
- **Mouse**: Look around
- **Left Click**: Shoot
- **R**: Reload
- **E**: Plant or defuse spike
- **1-4**: Buy weapons and gear
- **G**: Throw grenade
- **Shift**: Walk
- **Ctrl**: Crouch

## Match Rules

- **Buy Phase**: Purchase weapons, shields, and utility at the start of each round.
- **Objective**: Attackers (TIDE) must plant the spike at site A or B. Defenders (REEF) must prevent the plant or defuse it.
- **Economy**: Earn credits based on kills, objectives, and round outcomes.

## Vendor Note

Three.js r187 is vendored locally in `game/vendor/three/` for offline play and stability.