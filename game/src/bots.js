import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createBots(scene, world) {
  // Reaction delay keeps bots fair: they see you before they shoot you.
const REACTION_MIN = 0.3;
  const REACTION_MAX = 0.8;
  const BOT_SPEED = 3.2;
  const SEEK_SPEED = 4.6;
  const BURST = 3;
  const BURST_GAP = 0.12;
  const BURST_PAUSE = 0.9;
  const HEAR_RADIUS = 20;
  const SEE_DIST = 36;
  const BOT_HEALTH = 100;
  const RADIUS = 0.34;
  const HEIGHT = 1.72;

  const waypoints = {
    dune: [
      new THREE.Vector3(0, 0, 14),
      new THREE.Vector3(-12, 0, 4),
      new THREE.Vector3(12, 0, 4),
      new THREE.Vector3(-18, 0, -11),
      new THREE.Vector3(18, 0, -11),
      new THREE.Vector3(0, 0, 0)
    ],
    vulture: [
      new THREE.Vector3(0, 0, -14),
      new THREE.Vector3(-12, 0, -4),
      new THREE.Vector3(12, 0, -4),
      new THREE.Vector3(-18, 0, -11),
      new THREE.Vector3(18, 0, -11),
      new THREE.Vector3(0, 0, 0)
    ]
  };

  const botDefs = [
    { name: 'Sable', team: 'dune', role: 'follower', weapon: 'rifle', rx: [0.4, 0.6], spawn: new THREE.Vector3(-2, 0, 14) },
    { name: 'Kite', team: 'dune', role: 'flanker', weapon: 'smg', rx: [0.35, 0.5], spawn: new THREE.Vector3(2, 0, 14) },
    { name: 'Falcon', team: 'vulture', role: 'sniper', weapon: 'sniper', rx: [0.6, 0.8], spawn: new THREE.Vector3(0, 0, -14) },
    { name: 'Adder', team: 'vulture', role: 'rusher', weapon: 'smg', rx: [0.3, 0.45], spawn: new THREE.Vector3(-3, 0, -14) },
    { name: 'Rook', team: 'vulture', role: 'holder', weapon: 'rifle', rx: [0.35, 0.55], spawn: new THREE.Vector3(3, 0, -14) }
  ];

  const list = [];
  const hitMeshes = [];
  const probeBox = new THREE.Box3();
  const vTmp = new THREE.Vector3();
  const vTmp2 = new THREE.Vector3();

  function createNameSprite(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = PALETTE.ink;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 64, 16);
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.8, 0.2, 1);
    sprite.position.y = 1.1;
    return sprite;
  }

  for (let def of botDefs) {
    const group = new THREE.Group();
    const teamColor = def.team === 'dune' ? PALETTE.teal : PALETTE.crimson;

    const torsoMat = new THREE.MeshBasicMaterial({ color: teamColor });
    const headMat = new THREE.MeshBasicMaterial({ color: PALETTE.gold });
    const limbMat = new THREE.MeshBasicMaterial({ color: PALETTE.muted });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), torsoMat);
    torso.position.y = 0.75;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), headMat);
    head.position.y = 1.25;
    group.add(head);

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), limbMat);
    legs.position.y = 0.25;
    group.add(legs);

    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), limbMat);
    gun.position.set(0.2, 0.7, 0.25);
    group.add(gun);

    const sprite = createNameSprite(def.name);
    group.add(sprite);

    scene.add(group);

    const bot = {
      name: def.name,
      team: def.team,
      role: def.role,
      weapon: def.weapon,
      health: BOT_HEALTH,
      alive: true,
      state: 'patrol',
      pos: group.position,
      yaw: 0,
      lastKnown: null,
      reactAt: 0,
      burstLeft: 0,
      burstAt: 0,
      waypointIndex: 0,
      holdAt: null,
      shootCooldown: 0,
      reactionMin: def.rx[0],
      reactionMax: def.rx[1],
      group,
      spawnPos: def.spawn.clone(),
      targetTimer: Math.random() * 0.25,
      defusing: false
    };

    torso.userData = { bot, part: 'torso' };
    head.userData = { bot, part: 'head' };
    hitMeshes.push(torso, head);
    list.push(bot);
  }

  function moveBot(bot, dx, dz, dt) {
    if (dx === 0 && dz === 0) return;
    let x = bot.pos.x + dx * dt;
    let z = bot.pos.z + dz * dt;
    let y = bot.pos.y;

    // X axis collision
    probeBox.setFromCenterAndSize(vTmp.set(x, y + HEIGHT * 0.5, bot.pos.z), vTmp2.set(RADIUS * 2, HEIGHT, RADIUS * 2));
    if (world.checkCollision(probeBox)) x = bot.pos.x;

    // Z axis collision
    probeBox.setFromCenterAndSize(vTmp.set(x, y + HEIGHT * 0.5, z), vTmp2.set(RADIUS * 2, HEIGHT, RADIUS * 2));
    if (world.checkCollision(probeBox)) z = bot.pos.z;

    bot.pos.x = x;
    bot.pos.z = z;
    bot.group.rotation.y = Math.atan2(dx, dz);
  }

  function spawnAll() {
    for (let bot of list) {
      bot.alive = true;
      bot.health = BOT_HEALTH;
      bot.state = 'patrol';
      bot.pos.copy(bot.spawnPos);
      bot.group.rotation.set(0, 0, 0);
      bot.lastKnown = null;
      bot.burstLeft = 0;
      bot.defusing = false;
    }
  }

  function reset() {
    spawnAll();
  }

  function aliveCount(team) {
    return list.filter(b => b.team === team && b.alive).length;
  }

  function damage(mesh, amount) {
    const bot = mesh.userData.bot;
    if (!bot || !bot.alive) return false;
    bot.health -= amount;
    if (bot.health <= 0) {
      bot.alive = false;
      bot.group.rotation.x = -1.45;
      bot.group.position.y = 0.2;
      return true;
    }
    return false;
  }

  function step(dt, ctx) {
    const wps = waypoints;

    for (let bot of list) {
      if (!bot.alive) continue;

      bot.shootCooldown = Math.max(0, bot.shootCooldown - dt);

      // Hear check
      if (ctx.hearFrom && ctx.hearFrom.distanceTo(bot.pos) < HEAR_RADIUS) {
        bot.lastKnown = ctx.hearFrom.clone();
        if (bot.state === 'patrol') bot.state = 'seek';
      }

      // Vision & Target Scanning periodically
      bot.targetTimer -= dt;
      let visibleTarget = null;

      if (bot.targetTimer <= 0) {
        bot.targetTimer = 0.25;
        let enemies = [];
        if (bot.team === 'dune') {
          enemies = list.filter(b => b.team === 'vulture' && b.alive);
        } else {
          enemies = list.filter(b => b.team === 'dune' && b.alive);
          if (ctx.playerAlive) {
            enemies.push({ pos: ctx.playerPos, alive: true, isPlayer: true, crouching: ctx.playerCrouching });
          }
        }

        for (let e of enemies) {
          let dist = bot.pos.distanceTo(e.pos);
          if (dist < SEE_DIST) {
            vTmp.copy(e.pos).addY(1.0);
            vTmp2.copy(bot.pos).addY(1.0);
            if (ctx.canSee(vTmp2, vTmp)) {
              visibleTarget = e;
              break;
            }
          }
        }

        if (visibleTarget) {
          bot.lastKnown = visibleTarget.pos.clone();
          if (bot.state !== 'hold') {
            if (bot.reactAt === 0) {
              let r = bot.reactionMin + ctx.random() * (bot.reactionMax - bot.reactionMin);
              bot.reactAt = ctx.time + r;
            }
          }
        } else {
          bot.reactAt = 0;
        }
      }

      // Defusal behavior for Vulture if planted
      if (ctx.plantedSite && bot.team === 'vulture') {
        let distToPlant = bot.pos.distanceTo(ctx.plantedSite);
        if (distToPlant < 2.5) {
          bot.defusing = true;
          if (ctx.onDefused) ctx.onDefused(dt);
          continue;
        } else {
          bot.state = 'seek';
          bot.lastKnown = ctx.plantedSite.clone();
        }
      }

      // Firing logic
      if (visibleTarget && ctx.time >= bot.reactAt && bot.reactAt !== 0) {
        let targetPos = visibleTarget.pos.clone().addY(1.0);
        let angle = Math.atan2(targetPos.x - bot.pos.x, targetPos.z - bot.pos.z);
        bot.group.rotation.y = angle;

        if (bot.shootCooldown === 0) {
          ctx.fireBot(bot, targetPos, visibleTarget.isPlayer);
          bot.shootCooldown = 0.2;
        }
      }

      // Movement based on state and role
      let targetPos = null;
      let currentWps = wps[bot.team];

      if (bot.lastKnown && bot.state === 'seek') {
        targetPos = bot.lastKnown;
        if (bot.pos.distanceTo(targetPos) < 1.5) {
          bot.lastKnown = null;
          bot.state = 'patrol';
        }
      } else {
        // Role specific patrol/movement
        if (bot.role === 'follower' && ctx.playerAlive) {
          let dToPlayer = bot.pos.distanceTo(ctx.playerPos);
          if (dToPlayer > 4) {
            targetPos = ctx.playerPos;
          }
        } else if (bot.role === 'flanker') {
          targetPos = currentWps[(bot.waypointIndex + 1) % currentWps.length];
        } else if (bot.role === 'sniper') {
          targetPos = currentWps[0]; // Hold sniper spawn/ridge
        } else if (bot.role === 'rusher') {
          targetPos = currentWps[5]; // Mid
        } else {
          targetPos = currentWps[bot.waypointIndex];
        }

        if (targetPos && bot.pos.distanceTo(targetPos) < 1.5) {
          bot.waypointIndex = (bot.waypointIndex + 1) % currentWps.length;
        }
      }

      if (targetPos) {
        let speed = (bot.state === 'seek') ? SEEK_SPEED : BOT_SPEED;
        let dx = targetPos.x - bot.pos.x;
        let dz = targetPos.z - bot.pos.z;
        let len = Math.sqrt(dx * dx + dz * dz);
        if (len > 0.1) {
          moveBot(bot, (dx / len) * speed, (dz / len) * speed, dt);
        }
      }
    }
  }

  return {
    list,
    hitMeshes,
    spawnAll,
    step,
    damage,
    aliveCount,
    reset
  };
}
