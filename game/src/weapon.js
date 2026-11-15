import * as THREE from 'three';
import { PALETTE } from './palette.js';

// One table drives the buy menu, the view model and the damage numbers.
const WEAPONS = {
pistol: { price: 0, mag: 12, reserve: 36, damage: 26, headMul: 2, fireGap: 0.16, reload: 1.1, spreadStill: 0.004, spreadMove: 0.02, recoil: 0.006, auto: false, label: 'P9 Sidearm' },
rifle: { price: 900, mag: 30, reserve: 90, damage: 34, headMul: 2, fireGap: 0.096, reload: 1.9, spreadStill: 0.0022, spreadMove: 0.028, recoil: 0.009, auto: true, label: 'KV-9 Carbine' },
sniper: { price: 2200, mag: 5, reserve: 15, damage: 95, headMul: 2, fireGap: 1.1, reload: 2.6, spreadStill: 0.0005, spreadMove: 0.05, recoil: 0.03, auto: false, label: 'Harborline-90' }
};

export { WEAPONS };

export function createWeapon(camera) {
  let currentKey = 'pistol';
  let def = WEAPONS[currentKey];
  let mag = def.mag;
  let reserve = def.reserve;
  let cooldown = 0;
  let reloadLeft = 0;
  let flashLeft = 0;
  let kickAmount = 0;

  const group = new THREE.Group();
  camera.add(group);

  const matBody = new THREE.MeshLambertMaterial({ color: PALETTE.surface });
  const matAccent = new THREE.MeshLambertMaterial({ color: PALETTE.hairline });
  const matMuzzle = new THREE.MeshBasicMaterial({ color: PALETTE.gold });

  const flashLight = new THREE.PointLight(PALETTE.accent, 2, 4);
  flashLight.position.set(0.15, -0.2, -0.8);
  flashLight.visible = false;
  group.add(flashLight);

  const flashGeom = new THREE.PlaneGeometry(0.12, 0.12);
  const flashMesh = new THREE.Mesh(flashGeom, new THREE.MeshBasicMaterial({ color: PALETTE.gold, side: THREE.DoubleSide }));
  flashMesh.position.set(0.15, -0.2, -0.7);
  flashMesh.visible = false;
  group.add(flashMesh);

  let meshParts = [];

  function rebuildModel() {
    meshParts.forEach(p => group.remove(p));
    meshParts = [];

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.4), matBody);
    body.position.set(0.18, -0.25, -0.45);
    group.add(body);
    meshParts.push(body);

    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), matAccent);
    barrel.position.set(0.18, -0.23, -0.7);
    group.add(barrel);
    meshParts.push(barrel);

    if (currentKey === 'sniper') {
      const scope = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.2), matAccent);
      scope.position.set(0.18, -0.17, -0.45);
      group.add(scope);
      meshParts.push(scope);
    } else if (currentKey === 'rifle') {
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.2), matAccent);
      stock.position.set(0.18, -0.27, -0.25);
      group.add(stock);
      meshParts.push(stock);
    }
  }

  rebuildModel();

  return {
    step(dt) {
      if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
      if (flashLeft > 0) {
        flashLeft -= dt;
        if (flashLeft <= 0) {
          flashMesh.visible = false;
          flashLight.visible = false;
        }
      }
      if (kickAmount > 0) kickAmount = Math.max(0, kickAmount - dt * 5);

      if (reloadLeft > 0) {
        reloadLeft -= dt;
        if (reloadLeft <= 0) {
          const needed = def.mag - mag;
          const take = Math.min(needed, reserve);
          mag += take;
          reserve -= take;
        }
      }

      // Bob & Kick visual
      group.position.set(0, 0, kickAmount * 0.1);
      group.rotation.x = kickAmount * 0.5;
    },
    ready() {
      return mag > 0 && cooldown <= 0 && reloadLeft <= 0;
    },
    pullTrigger() {
      cooldown = def.fireGap;
      flashLeft = 0.05;
      flashMesh.visible = true;
      flashLight.visible = true;
      kickAmount = def.recoil;
    },
    takeRound() {
      if (mag <= 0) return false;
      mag--;
      return true;
    },
    reload() {
      if (reloadLeft > 0 || mag >= def.mag || reserve <= 0) return;
      reloadLeft = def.reload;
    },
    spread(speed) {
      const moveFactor = Math.min(1, speed / 5.2);
      return def.spreadStill + moveFactor * def.spreadMove;
    },
    refill() {
      mag = def.mag;
      reserve = def.reserve;
      reloadLeft = 0;
      cooldown = 0;
    },
    equip(name) {
      if (!WEAPONS[name]) return;
      currentKey = name;
      def = WEAPONS[name];
      mag = def.mag;
      reserve = def.reserve;
      cooldown = 0;
      reloadLeft = 0;
      rebuildModel();
    },
    currentName() {
      return currentKey;
    },
    get def() {
      return def;
    },
    get mag() { return mag; },
    set mag(v) { mag = v; },
    get reserve() { return reserve; },
    set reserve(v) { reserve = v; },
    get reloadLeft() { return reloadLeft; }
  };
}
