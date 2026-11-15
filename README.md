# EMBER CANYON — a three.js tactical FPS

A dawn desert-canyon tactical FPS for the make.fun threejs-fps-02 bounty.

EMBER CANYON is round 2 of the threejs-fps-02 entry, an improved tactical shooter building directly on round 1's TIDELOCK HARBOR.

## How to play

1. Open `game/index.html` in desktop Chrome.
2. Click the screen to capture the mouse.
3. **WASD** to move, **Mouse** to look, **Left-Click** to fire.
4. **R** to reload, **E** (hold) to plant the charge.
5. **G** for frag grenade, **H** for smoke grenade.
6. **B** to open the buy menu, **M** to toggle audio.

## Match rules

- First to 5 rounds wins the match (max 9 rounds).
- Attackers win by planting the charge at A or B, or by eliminating all defenders (VULTURE).
- Defenders win by defusing the charge, preventing the plant, or eliminating all attackers.
- Earn money each round for kills and objectives to spend during the buy phase.

## Weapons

- **Sidearm / Pistol**: Lightweight backup with reliable accuracy.
- **SMG**: High rate of fire for close-quarters engagements.
- **Rifle**: Versatile automatic weapon for mid-to-long ranges.
- **Sniper**: High-damage precision rifle with scoped zoom.
- **Grenades**: Lethal frag grenades and tactical smoke for cover.

## Bots

- **Enemies (VULTURE)**: Falcon (sniper), Adder (rusher), Rook (holder).
- **Allies**: Sable and Kite fight alongside you.

## Tech

- **three.js 0.187.0**: Vendored locally with ES modules.
- **Zero Build**: No bundlers, npm install, or build steps required.
- **Offline**: Entirely self-contained with no external network requests.
- **Deterministic**: Fixed 1/60s physics and simulation tick rate.
- **Audio**: Fully procedural WebAudio synthesis for all sound effects.