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

// Seeded random (mulberry32)
let seedVal = 1;
function setSeed(s) { seedVal = s >>> 0; }
function random() {
  seedVal += 0x6D2B79F5;
  let t = Math.imul(seedVal ^ (seedVal >>> 15), 1 | seedVal);
  t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Error handling
window.onerror = (msg, src, line, col, err) => {
  window.__shotError = msg;
};
window.addEventListener('unhandledrejection', (e) => {
  window.__shotError = e.reason;
});

const urlParams = new URLSearchParams(window.location.search);
const shotName = urlParams.get('shot');
const seedParam = urlParams.get('seed');
if (seedParam) setSeed(parseInt(seedParam, 10));

// Renderer setup
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.FogExp2(PALETTE.canvas, 0.012);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);

// Lighting
const ambientLight = new THREE.AmbientLight(PALETTE.muted, 1.2);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(PALETTE.accent, 2.2);
sunLight.position.set(20, 30, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 100;
const d = 30;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
scene.add(sunLight);

// Modules
const world = createWorld(scene);
const player = createPlayer(world.colliders);
const weapon = createWeapon(camera);
const sounds = createSounds();
const hud = createHud();
const bots = createBots(scene, world);
const match = createMatch({ world, player, bots, weapon, hud, sounds });

// Player health and camera sync (player.js tracks movement only).
let playerHealth = 100;
let playerAlive = true;
let plantHeld = false;
let singleShotTrigger = false;
let simTime = 0;
let lastShotPos = null;
let buyMenuOpen = false;
const buyItems = [
  { key: '1', label: 'P9 Sidearm', price: 0, stats: '12 rounds, 26 dmg' },
  { key: '2', label: 'Dune-9 SMG', price: 700, stats: '25 rounds, 22 dmg' },
  { key: '3', label: 'KV-9 Carbine', price: 900, stats: '30 rounds, 34 dmg' },
  { key: '4', label: 'Canyon-90', price: 2200, stats: '5 rounds, 95 dmg' },
  { key: '5', label: 'Frag grenade', price: 300, stats: 'explosive' },
  { key: '6', label: 'Smoke grenade', price: 250, stats: 'blocks sight' }
];
function damagePlayer(amount) {
  if (!playerAlive) return;
  playerHealth = Math.max(0, playerHealth - amount);
  hud.setHealth(playerHealth);
  hud.flashDamage();
  if (playerHealth <= 0) playerAlive = false;
}
function syncCamera() {
  camera.position.set(player.position.x, player.position.y + player.eye, player.position.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}
function fireBot(bot, targetPos, isPlayer) {
  sounds.shoot('smg');
  spawnTracer(bot.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), targetPos);
  if (isPlayer && playerAlive) damagePlayer(12);
}
hud.onBuy((key) => {
  if (key === '5') match.buyGrenade('frag');
  else if (key === '6') match.buyGrenade('smoke');
  else {
    const names = { '1': 'pistol', '2': 'smg', '3': 'rifle', '4': 'sniper' };
    if (names[key]) match.buyWeapon(names[key]);
  }
});

// Raycaster and vectors
const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const dirVec = new THREE.Vector3();
const hitPointVec = new THREE.Vector3();

// Pools
const sparks = [];
const sparkGeo = new THREE.SphereGeometry(0.08, 4, 4);
const sparkMat = new THREE.MeshBasicMaterial({ color: PALETTE.gold });
for (let i = 0; i < 8; i++) {
  const m = new THREE.Mesh(sparkGeo, sparkMat);
  m.visible = false;
  scene.add(m);
  sparks.push({ mesh: m, life: 0 });
}

const tracers = [];
const tracerMat = new THREE.LineBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.8 });
for (let i = 0; i < 4; i++) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geo, tracerMat);
  line.visible = false;
  scene.add(line);
  tracers.push({ line, life: 0 });
}

const grenades = [];
const fragGeo = new THREE.SphereGeometry(0.12, 6, 6);
const fragMat = new THREE.MeshStandardMaterial({ color: PALETTE.surface, roughness: 0.8 });

const smokeGeo = new THREE.SphereGeometry(0.6, 6, 6);
const smokeMat = new THREE.MeshStandardMaterial({ color: PALETTE.muted, transparent: true, opacity: 0.6, roughness: 1 });

function spawnSpark(pos) {
  const s = sparks.find(x => x.life <= 0) || sparks[0];
  s.mesh.position.copy(pos);
  s.mesh.visible = true;
  s.life = 0.1;
}

function spawnTracer(from, to) {
  const t = tracers.find(x => x.life <= 0) || tracers[0];
  const pos = t.line.geometry.attributes.position;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  t.line.visible = true;
  t.life = 0.06;
}

// Smoke check for visibility
function canSee(from, to) {
  raycaster.set(from, dirVec.subVectors(to, from).normalize());
  raycaster.far = from.distanceTo(to);
  const hits = raycaster.intersectObjects(world.shootables.map(s => s.mesh), true);
  if (hits.length > 0 && hits[0].distance < raycaster.far) return false;

  for (const g of grenades) {
    if (g.type === 'smoke' && g.bloomed) {
      // Check segment to smoke center distance
      const dist = pointLineSegmentDistance(g.mesh.position, from, to);
      if (dist < 2.5) return false;
    }
  }
  return true;
}
// canSee is passed to bots.step via its context object (see step()).

function pointLineSegmentDistance(p, a, b) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ap = new THREE.Vector3().subVectors(p, a);
  let t = ap.dot(ab) / ab.dot(ab);
  t = Math.max(0, Math.min(1, t));
  const c = new THREE.Vector3().copy(a).addScaledVector(ab, t);
  return p.distanceTo(c);
}

// Input state
let isLocked = false;
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyM') sounds.toggleMute();
  if (e.code === 'KeyB' && match.phase === 'buy') {
    if (buyMenuOpen) { hud.hideBuy(); buyMenuOpen = false; }
    else { hud.showBuy(buyItems); buyMenuOpen = true; }
  }
  if (e.code === 'KeyR' && isLocked) weapon.reload();
  if (e.code === 'KeyG' && isLocked && match.useGrenade('frag')) throwGrenade('frag');
  if (e.code === 'KeyH' && isLocked && match.useGrenade('smoke')) throwGrenade('smoke');
  if (e.code === 'KeyE' && isLocked) plantHeld = true;

  if (match.phase === 'buy') {
    if (e.code === 'Digit1') match.buyWeapon('pistol');
    if (e.code === 'Digit2') match.buyWeapon('smg');
    if (e.code === 'Digit3') match.buyWeapon('rifle');
    if (e.code === 'Digit4') match.buyWeapon('sniper');
    if (e.code === 'Digit5') match.buyGrenade('frag');
    if (e.code === 'Digit6') match.buyGrenade('smoke');
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyE') plantHeld = false;
});

canvas.addEventListener('click', () => {
  if (!isLocked && !shotName) {
    canvas.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === canvas;
  if (isLocked) hud.hideOverlay(); else if (!shotName) hud.showOverlay('paused');
});

window.addEventListener('mousemove', (e) => {
  if (!isLocked) return;
  player.look(e.movementX, e.movementY);
});

let mouseDown = false;
window.addEventListener('mousedown', (e) => {
  if (e.button === 0 && isLocked) { mouseDown = true; singleShotTrigger = true; }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDown = false;
});

function throwGrenade(type) {
  const group = new THREE.Group();
  if (type === 'frag') {
    const mesh = new THREE.Mesh(fragGeo, fragMat);
    group.add(mesh);
  } else {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(smokeGeo, smokeMat);
      m.position.set((random()-0.5)*0.4, (random()-0.5)*0.4, (random()-0.5)*0.4);
      group.add(m);
    }
  }
  group.position.copy(camera.position);
  scene.add(group);
  
  camera.getWorldDirection(dirVec);
  const vel = dirVec.clone().multiplyScalar(14).add(new THREE.Vector3(0, 4, 0));
  
  grenades.push({
    mesh: group,
    vel,
    type,
    fuse: 2.2,
    bloomed: false,
    bounceCount: 0
  });
  if (type === 'frag') sounds.shoot();
  else sounds.smoke();
}

function firePlayerWeapon() {
  if (!weapon.ready() || !weapon.takeRound()) return;
  weapon.pullTrigger();
  sounds.shoot(weapon.currentName());
  player.recoil(weapon.def().recoil);

  const spreadVal = weapon.spread(player.groundSpeed());
  camera.getWorldDirection(dirVec);
  dirVec.x += (random() - 0.5) * spreadVal;
  dirVec.y += (random() - 0.5) * spreadVal;
  dirVec.z += (random() - 0.5) * spreadVal;
  dirVec.normalize();

  raycaster.set(camera.position, dirVec);
  const targets = [...world.shootables.map(s => s.mesh), ...bots.hitMeshes];
  const hits = raycaster.intersectObjects(targets, true);

  const muzzlePos = camera.position.clone().add(new THREE.Vector3(0.2, -0.2, -0.5));

  if (hits.length > 0) {
    const hit = hits[0];
    spawnTracer(muzzlePos, hit.point);
    const hitBot = hit.object.userData ? hit.object.userData.bot : null;
    if (hitBot && hitBot.team !== 'DUNE') {
      const isHead = hit.object.geometry && hit.object.geometry.type === 'SphereGeometry';
      const dmg = weapon.def().damage * (isHead ? 2 : 1);
      const killed = bots.damage(hit.object, dmg);
      hud.hitMarker();
      const screenPos = hit.point.clone().project(camera);
      hud.damageNumber(Math.round(dmg), (screenPos.x * 0.5 + 0.5) * window.innerWidth, (-screenPos.y * 0.5 + 0.5) * window.innerHeight);
      if (killed) {
        hud.feed('You', hitBot.name, isHead);
        match.addKillMoney();
        match.addKill('You');
      }
      sounds.hit(killed);
    } else {
      spawnSpark(hit.point);
    }
  } else {
    spawnTracer(muzzlePos, camera.position.clone().addScaledVector(dirVec, 50));
  }
  lastShotPos = player.position.clone();
}

// Simulation loop
let accumulator = 0;
let lastTime = 0;

function step() {
  simTime += FIXED_STEP;
  player.step(FIXED_STEP, keys);
  weapon.step(FIXED_STEP);
  bots.step(FIXED_STEP, {
    hearFrom: lastShotPos,
    playerAlive,
    playerPos: player.position,
    playerCrouching: player.crouching,
    canSee,
    random,
    time: simTime,
    plantedSite: match.plantSite ? world.sites[match.plantSite] : null,
    fireBot
  });
  match.step(FIXED_STEP, { plantHeld }, simTime, {
    playerAlive,
    playerPos: player.position,
    defuserNear: false
  });

  if (mouseDown && (weapon.def().auto || singleShotTrigger)) {
    firePlayerWeapon();
    singleShotTrigger = false;
  }

  // Grenade physics
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.fuse -= FIXED_STEP;
    g.vel.y -= 12 * FIXED_STEP;
    g.mesh.position.addScaledVector(g.vel, FIXED_STEP);

    if (g.mesh.position.y < world.getFloorHeight(g.mesh.position.x, g.mesh.position.z) + 0.2) {
      g.mesh.position.y = world.getFloorHeight(g.mesh.position.x, g.mesh.position.z) + 0.2;
      g.vel.multiplyScalar(0.4);
    }

    if (g.type === 'smoke' && !g.bloomed && g.fuse < 1.2) {
      g.bloomed = true;
    }

    if (g.fuse <= 0) {
      if (g.type === 'frag') {
        sounds.explode();
        if (player.position.distanceTo(g.mesh.position) < 6) {
          const dmg = Math.round(90 * (1 - player.position.distanceTo(g.mesh.position) / 6));
          damagePlayer(dmg);
          sounds.hurt();
        }
        for (const b of bots.list) {
          if (!b.alive) continue;
          const d = b.pos.distanceTo(g.mesh.position);
          if (d < 6) {
            const edmg = Math.round(90 * (1 - d / 6));
            b.health -= edmg;
            if (b.health <= 0) {
              b.alive = false;
              b.group.rotation.x = -1.45;
              b.group.position.y = 0.2;
              hud.feed('You', b.name, false);
              match.addKillMoney();
              match.addKill('You');
            }
          }
        }
      } else {
        scene.remove(g.mesh);
      }
      grenades.splice(i, 1);
    }
  }

  // Sparks & tracers
  for (const s of sparks) {
    if (s.life > 0) {
      s.life -= FIXED_STEP;
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
  for (const t of tracers) {
    if (t.life > 0) {
      t.life -= FIXED_STEP;
      if (t.life <= 0) t.line.visible = false;
    }
  }
}

function runShot(name) {
  match.startMatch();
  syncCamera();
  if (name === 'start') {
    match.phase = 'buy';
    hud.hideOverlay();
    player.position.set(0, 0, 14);
    player.yaw = 0;
    syncCamera();
    hud.showBuy(buyItems);
  } else if (name === 'play') {
    match.phase = 'round';
    hud.hideOverlay();
    match.timer = 87;
    bots.spawnAll();
    player.position.set(0, 0, 0);
    player.yaw = 0;
    syncCamera();
    weapon.mag = 28;
    weapon.reserve = 90;
    firePlayerWeapon();
    hud.feed('You', 'Adder', false);
    hud.damageNumber(34, 640, 300);
  } else if (name === 'end') {
    match.phase = 'round';
    match.score.DUNE = 1;
    match.score.VULTURE = 0;
    match.endRound('DUNE', 'VULTURE eliminated');
  }
}

if (shotName) {
  runShot(shotName);
  renderer.render(scene, camera);
  renderer.render(scene, camera); // Double render for staging
  window.__shotReady = true;
} else {
  match.startMatch();
  requestAnimationFrame(function frame(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (dt > 0.1) dt = 0.1;

    accumulator += dt;
    while (accumulator >= FIXED_STEP) {
      step();
      accumulator -= FIXED_STEP;
    }

    if (playerAlive) syncCamera();

    renderer.render(scene, camera);

    hud.setAmmo(weapon.mag, weapon.reserve);
    hud.setHealth(playerHealth);
    hud.setTimer(match.timer);
    hud.setScore(match.score.DUNE, match.score.VULTURE);
    hud.setRound(match.round, 9);
    hud.setMoney(match.money);
    hud.setWeapon(weapon.def().label);
    hud.setSmoke(grenades.some(g => g.type === 'smoke' && g.bloomed));

    requestAnimationFrame(frame);
  });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
