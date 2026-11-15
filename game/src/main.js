import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createWeapon, WEAPONS } from './weapon.js';
import { createBots } from './bots.js';
import { createSounds } from './sounds.js';
import { createHud } from './hud.js';
import { createMatch } from './match.js';

const FIXED_STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5; // spiral-of-death guard

window.__shotError = null;
window.addEventListener('error', (e) => { window.__shotError = e.message; });
window.addEventListener('unhandledrejection', (e) => { window.__shotError = e.reason; });

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedVal = parseInt(params.get('seed') || '1', 10);

let seedState = seedVal;
function seededRandom() {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.FogExp2(PALETTE.canvas, 0.008);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);

const world = createWorld(scene);
const player = createPlayer(world.colliders);
const weapon = createWeapon(camera);
weapon.equip('rifle');
const sounds = createSounds();
const hud = createHud();
const bots = createBots(scene, world, sounds);
const match = createMatch({ world, player, bots, weapon, hud, sounds });

const raycaster = new THREE.Raycaster();
raycaster.far = 80;
const dirVec = new THREE.Vector3();

const tracers = [];
const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const tracerMat = new THREE.LineBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.8 });
for (let i = 0; i < 4; i++) {
  const line = new THREE.Line(tracerGeo, tracerMat);
  line.visible = false;
  scene.add(line);
  tracers.push({ line, life: 0 });
}

const sparks = [];
const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
const sparkMat = new THREE.MeshBasicMaterial({ color: PALETTE.gold });
for (let i = 0; i < 8; i++) {
  const mesh = new THREE.Mesh(sparkGeo, sparkMat);
  mesh.visible = false;
  scene.add(mesh);
  sparks.push({ mesh, life: 0 });
}

const grenades = [];
const grenadeGeo = new THREE.SphereGeometry(0.12, 8, 8);
const grenadeMat = new THREE.MeshBasicMaterial({ color: PALETTE.surface });

function spawnTracer(start, end) {
  const t = tracers.find(x => x.life <= 0);
  if (!t) return;
  const positions = t.line.geometry.attributes.position;
  positions.setXYZ(0, start.x, start.y, start.z);
  positions.setXYZ(1, end.x, end.y, end.z);
  positions.needsUpdate = true;
  t.line.visible = true;
  t.life = 0.06;
}

function spawnSpark(pos) {
  const s = sparks.find(x => x.life <= 0);
  if (!s) return;
  s.mesh.position.copy(pos);
  s.mesh.visible = true;
  s.life = 0.15;
}

function playerShoot() {
  if (!weapon.ready() || !weapon.takeRound()) return;
  weapon.pullTrigger();
  player.recoil(weapon.def.recoil);
  sounds.shoot(weapon.currentName());

  const spread = weapon.spread(player.groundSpeed());
  const rx = (seededRandom() - 0.5) * spread;
  const ry = (seededRandom() - 0.5) * spread;
  const rz = (seededRandom() - 0.5) * spread;

  camera.getWorldDirection(dirVec);
  dirVec.add(new THREE.Vector3(rx, ry, rz)).normalize();

  raycaster.set(camera.position, dirVec);
  const hitMeshes = bots.hitMeshes;
  const hits = raycaster.intersectObjects([...world.shootables, ...hitMeshes], true);

  let hitPoint = camera.position.clone().addScaledVector(dirVec, 50);
  if (hits.length > 0) {
    const hit = hits[0];
    hitPoint.copy(hit.point);
    if (hitMeshes.includes(hit.object)) {
      const bot = hit.object.userData.bot;
      if (bot) {
        const isHead = hit.object.userData.part === 'head';
        const killed = bots.damage(hit.object, weapon.def.damage);
        hud.hitMarker();
        hud.feed('You', bot.name, isHead);
        match.addKillMoney();
        sounds.hit(killed);
      }
    } else {
      spawnSpark(hitPoint);
      sounds.impact('concrete');
    }
  }
  spawnTracer(camera.position, hitPoint);
  hud.setAmmo(weapon.mag, weapon.reserve);
  lastHearFrom = player.position.clone();
}

function throwGrenade() {
  if (!match.useGrenade()) return;
  camera.getWorldDirection(dirVec);
  const vel = dirVec.clone().multiplyScalar(14).add(new THREE.Vector3(0, 4, 0));
  const mesh = new THREE.Mesh(grenadeGeo, grenadeMat);
  mesh.position.copy(camera.position);
  scene.add(mesh);
  grenades.push({ mesh, vel, fuse: 2.2, active: true });
  sounds.throw();
}

function explodeGrenade(pos) {
  sounds.explode();
  const light = new THREE.PointLight(PALETTE.accent, 3, 15);
  light.position.copy(pos);
  scene.add(light);
  setTimeout(() => scene.remove(light), 250);

  const targets = [...bots.list, player];
  for (const t of targets) {
    if (!t.alive) continue;
    const dist = t.position.distanceTo(pos);
    if (dist < 6) {
      if (t === player) {
        const dmg = Math.floor(90 * (1 - dist / 6));
        player.damage(dmg);
        hud.setHealth(player.health);
        hud.flashDamage();
        sounds.hurt();
        if (player.health <= 0) {
          match.playerDied();
        }
      } else {
        bots.damage(t, Math.floor(90 * (1 - dist / 6)));
      }
    }
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let pointerLocked = false;
document.addEventListener('click', () => {
  if (match.isOver() || !match.isPlaying()) return;
  if (!pointerLocked && !shotName) {
    renderer.domElement.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  if (pointerLocked) hud.hideOverlay();
  else if (!match.isOver()) hud.showOverlayPaused();
});

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked || shotName) return;
  player.look(e.movementX, e.movementY);
});

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR') weapon.reload();
  if (e.code === 'KeyG') throwGrenade();
  if (e.code === 'KeyB') hud.toggleBuy(match.isBuyPhase());
  if (e.code === 'KeyM') sounds.toggleMute();
  if (e.code === 'Digit1') match.buyWeapon('pistol');
  if (e.code === 'Digit2') match.buyWeapon('rifle');
  if (e.code === 'Digit3') match.buyWeapon('sniper');
  if (e.code === 'Digit4') match.buyGrenade();
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

hud.onPlay(() => {
  if (!shotName) renderer.domElement.requestPointerLock();
});
hud.onBuy((key) => {
  if (key === '4') match.buyGrenade();
  else if (key === '1') match.buyWeapon('pistol');
  else if (key === '2') match.buyWeapon('rifle');
  else if (key === '3') match.buyWeapon('sniper');
});
hud.onRestart(() => { match.startMatch(); });

let lastTime = performance.now();
let accumulator = 0;

// ---- step context: line of sight + bot fire resolution ----
let simTime = 0;
let lastHearFrom = null;
const _losRay = new THREE.Raycaster();
const _losDir = new THREE.Vector3();
function canSee(from, to) {
  _losDir.subVectors(to, from);
  const dist = _losDir.length();
  if (dist < 0.01) return true;
  _losDir.normalize();
  _losRay.set(from, _losDir);
  _losRay.far = dist;
  return _losRay.intersectObjects(world.shootables, false).length === 0;
}
function fireBot(bot, targetPos, targetIsPlayer) {
  if (targetIsPlayer) {
    if (!player.alive) return;
    const died = player.damage(12);
    hud.setHealth(player.health);
    hud.flashDamage();
    sounds.hurt();
    if (died) match.playerDied();
    return;
  }
  let target = null;
  let best = 2.0;
  for (const t of bots.list) {
    if (!t.alive || t === bot) continue;
    const d = t.pos.distanceTo(targetPos);
    if (d < best) { best = d; target = t; }
  }
  if (!target) return;
  for (const m of bots.hitMeshes) {
    if (m.userData.bot === target) { bots.damage(m, 12); break; }
  }
}
function botCtx() {
  const planted = match.state.plantSite;
  const plantedPos = planted ? world.sites[planted] : null;
  let defuserNear = false;
  if (plantedPos) {
    for (const b of bots.list) {
      if (b.alive && b.team === 'REEF' && b.pos.distanceTo(plantedPos) < 2.5) { defuserNear = true; break; }
    }
  }
  return {
    playerAlive: player.alive,
    playerPos: player.position,
    playerCrouching: player.crouching,
    canSee,
    targets: bots.list,
    time: simTime,
    hearFrom: lastHearFrom,
    plantedSite: plantedPos,
    onDefused: planted ? () => match.endRound('REEF', 'Charge defused') : null,
    fireBot
  };
}

document.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    keys['Mouse0'] = true;
    if (pointerLocked && !weapon.def.auto) playerShoot();
  }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) keys['Mouse0'] = false;
});

function syncCamera() {
  camera.position.copy(player.position).add(new THREE.Vector3(0, player.eye, 0));
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function simStep() {
  simTime += FIXED_STEP;
  player.step(FIXED_STEP, keys);
  weapon.step(FIXED_STEP);

  if (pointerLocked && keys['Mouse0'] && weapon.def.auto) {
    playerShoot();
  }

  const ctx = botCtx();
  bots.step(FIXED_STEP, ctx);
  match.step(FIXED_STEP, { plantHeld: !!keys['KeyE'] }, simTime, {
    playerAlive: player.alive,
    playerPos: player.position,
    defuserNear: ctx.defuserNear
  });

  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    if (!g.active) continue;
    g.vel.y -= 12 * FIXED_STEP;
    g.mesh.position.addScaledVector(g.vel, FIXED_STEP);
    g.fuse -= FIXED_STEP;
    if (g.mesh.position.y < world.groundHeight(g.mesh.position)) {
      g.active = false;
      setTimeout(() => {
        explodeGrenade(g.mesh.position);
        scene.remove(g.mesh);
        grenades.splice(grenades.indexOf(g), 1);
      }, 400);
    } else if (g.fuse <= 0) {
      g.active = false;
      explodeGrenade(g.mesh.position);
      scene.remove(g.mesh);
      grenades.splice(grenades.indexOf(g), 1);
    }
  }

  for (const t of tracers) {
    if (t.life > 0) {
      t.life -= FIXED_STEP;
      if (t.life <= 0) t.line.visible = false;
    }
  }
  for (const s of sparks) {
    if (s.life > 0) {
      s.life -= FIXED_STEP;
      if (s.life <= 0) s.mesh.visible = false;
    }
  }

  if (match.spectating()) {
    const specTarget = match.getSpectateTarget();
    if (specTarget) camera.position.copy(specTarget.position).add(new THREE.Vector3(0, 0.5, 0));
  } else {
    syncCamera();
  }
}

function frame(now) {
  if (shotName) return;
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < 5) {
    simStep();
    accumulator -= FIXED_STEP;
    steps++;
  }
  renderer.render(scene, camera);
  hud.update(match, weapon, player);
  requestAnimationFrame(frame);
}

function runShot(name) {
  hud.hideOverlay();
  seedState = seedVal;
  if (name === 'start') {
    match.startMatch();
    player.position.set(0, 0, 13);
    player.yaw = 0;
    player.pitch = 0;
    hud.hideOverlay();
    hud.toggleBuy(true);
  } else if (name === 'play') {
    match.startMatch();
    match.forcePhase('round', 87);
    hud.hideOverlay();
    bots.spawnAll();
    const byName = {};
    for (const b of bots.list) byName[b.name] = b;
    if (byName['Dagger']) byName['Dagger'].pos.set(-3, 0.2, -2);
    if (byName['Pike']) byName['Pike'].pos.set(4, 0.2, -4);
    if (byName['Mara']) byName['Mara'].pos.set(1, 0.2, 13);
    player.position.set(0, 0, 10);
    player.yaw = 0;
    player.pitch = 0;
    syncCamera();
    weapon.mag = 28;
    weapon.reserve = 90;
    playerShoot();
    hud.feed('You', 'Dagger', false);
  } else if (name === 'end') {
    match.startMatch();
    match.state.score.TIDE = 1;
    match.state.score.REEF = 0;
    match.endRound('TIDE', 'REEF eliminated');
  }
  syncCamera();
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  window.__shotReady = true;
}

if (shotName) {
  runShot(shotName);
} else {
  match.startMatch();
  requestAnimationFrame(frame);
}
