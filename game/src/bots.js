import * as THREE from 'three';
import { PALETTE } from './palette.js';

export // Reaction delay keeps bots fair: they see you before they shoot you.
const REACTION_MIN = 0.35;
const REACTION_MAX = 0.6;
const BOT_SPEED = 3.2;
const SEEK_SPEED = 4.6;
const BURST = 3;
const BURST_GAP = 0.12;
const BURST_PAUSE = 0.9;
const HEAR_RADIUS = 20;
const SEE_DIST = 34;
const BOT_HEALTH = 100;
const RADIUS = 0.34;
const HEIGHT = 1.72;

export function createBots(scene, world) {
    const list = [];
    const hitMeshes = [];

    const definitions = [
        { name: 'Mara', team: 'TIDE', role: 'attack', spawn: new THREE.Vector3(0, 0.2, 13) },
        { name: 'Juno', team: 'TIDE', role: 'attack', spawn: new THREE.Vector3(-2, 0.2, 13) },
        { name: 'Dagger', team: 'REEF', role: 'defend', spawn: new THREE.Vector3(-16, 0.2, -13) },
        { name: 'Pike', team: 'REEF', role: 'defend', spawn: new THREE.Vector3(16, 0.2, -13) },
        { name: 'Wren', team: 'REEF', role: 'defend', spawn: new THREE.Vector3(0, 0.2, -13) }
    ];

    const waypointsTide = [
        new THREE.Vector3(0, 0.2, 8),
        new THREE.Vector3(-8, 0.2, 0),
        new THREE.Vector3(8, 0.2, 0),
        new THREE.Vector3(-15, 0.2, -8),
        new THREE.Vector3(15, 0.2, -8)
    ];

    const waypointsReef = [
        new THREE.Vector3(0, 0.2, -8),
        new THREE.Vector3(-14, 0.2, -10),
        new THREE.Vector3(14, 0.2, -10),
        new THREE.Vector3(0, 0.2, 0)
    ];

    function makeNameSprite(name, teamColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, 128, 32);
        ctx.fillStyle = teamColor;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, 64, 16);
        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1.2, 0.3, 1);
        sprite.position.y = 1.2;
        return sprite;
    }

    definitions.forEach(def => {
        const group = new THREE.Group();
        const teamColor = def.team === 'TIDE' ? PALETTE.cyan : PALETTE.coral;

        const torsoGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
        const torsoMat = new THREE.MeshStandardMaterial({ color: teamColor });
        const torso = new THREE.Mesh(torsoGeo, torsoMat);
        torso.position.y = 0.75;
        group.add(torso);

        const headGeo = new THREE.SphereGeometry(0.18, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({ color: PALETTE.gold });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.25;
        group.add(head);

        const legGeo = new THREE.BoxGeometry(0.44, 0.55, 0.28);
        const legMat = new THREE.MeshStandardMaterial({ color: PALETTE.surface });
        const legs = new THREE.Mesh(legGeo, legMat);
        legs.position.y = 0.28;
        group.add(legs);

        const gunGeo = new THREE.BoxGeometry(0.12, 0.12, 0.5);
        const gunMat = new THREE.MeshStandardMaterial({ color: PALETTE.ink });
        const gun = new THREE.Mesh(gunGeo, gunMat);
        gun.position.set(0.2, 0.65, 0.2);
        group.add(gun);

        const sprite = makeNameSprite(def.name, teamColor);
        group.add(sprite);

        torso.userData = { bot: null, part: 'torso' };
        head.userData = { bot: null, part: 'head' };

        scene.add(group);

        const bot = {
            name: def.name,
            team: def.team,
            role: def.role,
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
            holdAt: def.team === 'defend' ? def.spawn.clone() : null,
            shootCooldown: 0,
            group,
            defuseTimer: 0,
            scanTimer: Math.random() * 0.25,
            targetEntity: null
        };

        torso.userData.bot = bot;
        head.userData.bot = bot;
        hitMeshes.push(torso, head);
        list.push(bot);
    });

    const probeBox = new THREE.Box3();
    const moveVec = new THREE.Vector3();

    function resolveCollision(pos, radius, height, colliders) {
        probeBox.min.set(pos.x - radius, pos.y, pos.z - radius);
        probeBox.max.set(pos.x + radius, pos.y + height, pos.z + radius);
        for (let i = 0; i < colliders.length; i++) {
            const c = colliders[i];
            if (probeBox.intersectsBox(c)) {
                const center = new THREE.Vector3();
                c.getCenter(center);
                const size = new THREE.Vector3();
                c.getSize(size);
                const overlapX = (size.x / 2 + radius) - Math.abs(pos.x - center.x);
                const overlapZ = (size.z / 2 + radius) - Math.abs(pos.z - center.z);
                if (overlapX < overlapZ) {
                    pos.x += pos.x > center.x ? overlapX : -overlapX;
                } else {
                    pos.z += pos.z > center.z ? overlapZ : -overlapZ;
                }
                probeBox.min.set(pos.x - radius, pos.y, pos.z - radius);
                probeBox.max.set(pos.x + radius, pos.y + height, pos.z + radius);
            }
        }
    }

    return {
        list,
        hitMeshes,
        spawnAll() {
            list.forEach((bot, idx) => {
                bot.health = BOT_HEALTH;
                bot.alive = true;
                bot.state = 'patrol';
                bot.pos.copy(definitions[idx].spawn);
                bot.group.rotation.set(0, 0, 0);
                bot.group.visible = true;
                bot.lastKnown = null;
                bot.reactAt = 0;
                bot.burstLeft = 0;
                bot.defuseTimer = 0;
            });
        },
        step(dt, ctx) {
            list.forEach(bot => {
                if (!bot.alive) return;

                if (bot.shootCooldown > 0) bot.shootCooldown -= dt;
                bot.scanTimer -= dt;

                let targetPos = null;
                let targetIsPlayer = false;
                let targetCrouching = false;

                if (bot.scanTimer <= 0) {
                    bot.scanTimer = 0.25;
                    let bestDist = SEE_DIST;

                    if (ctx.playerAlive) {
                        const d = bot.pos.distanceTo(ctx.playerPos);
                        const visDist = ctx.playerCrouching ? d * 1.3 : d;
                        if (visDist < bestDist && ctx.canSee(bot.pos, ctx.playerPos)) {
                            bestDist = visDist;
                            targetPos = ctx.playerPos;
                            targetIsPlayer = true;
                            targetCrouching = ctx.playerCrouching;
                        }
                    }

                    ctx.targets.forEach(t => {
                        if (t.alive && t.team !== bot.team) {
                            const d = bot.pos.distanceTo(t.pos);
                            if (d < bestDist && ctx.canSee(bot.pos, t.pos)) {
                                bestDist = d;
                                targetPos = t.pos;
                                targetIsPlayer = false;
                            }
                        }
                    });

                    if (targetPos) {
                        if (!bot.lastKnown) {
                            const r = ctx.random ? ctx.random() : Math.random();
                            bot.reactAt = ctx.time + REACTION_MIN + r * (REACTION_MAX - REACTION_MIN);
                        }
                        bot.lastKnown = targetPos.clone();
                        bot.state = 'seek';
                    } else if (ctx.hearFrom && bot.pos.distanceTo(ctx.hearFrom) < HEAR_RADIUS) {
                        bot.lastKnown = ctx.hearFrom.clone();
                        bot.state = 'seek';
                    }
                } else if (bot.lastKnown) {
                    targetPos = bot.lastKnown;
                }

                if (ctx.plantedSite && bot.team === 'REEF' && bot.role === 'defend') {
                    bot.lastKnown = ctx.plantedSite.clone();
                    bot.state = 'seek';
                    if (bot.pos.distanceTo(ctx.plantedSite) < 2.5) {
                        bot.defuseTimer += dt;
                        if (bot.defuseTimer >= 4.0 && ctx.onDefused) {
                            ctx.onDefused();
                        }
                    }
                }

                let dest = null;
                const waypoints = bot.team === 'TIDE' ? waypointsTide : waypointsReef;

                if (bot.state === 'patrol') {
                    const wp = waypoints[bot.waypointIndex];
                    if (bot.pos.distanceTo(wp) < 1.5) {
                        bot.waypointIndex = (bot.waypointIndex + 1) % waypoints.length;
                    }
                    dest = waypoints[bot.waypointIndex];
                } else if (bot.state === 'seek') {
                    if (bot.lastKnown) {
                        dest = bot.lastKnown;
                        if (bot.pos.distanceTo(dest) < 1.0) {
                            bot.lastKnown = null;
                            bot.state = 'patrol';
                        }
                    } else {
                        bot.state = 'patrol';
                    }
                }

                if (dest) {
                    const speed = bot.state === 'seek' ? SEEK_SPEED : BOT_SPEED;
                    moveVec.subVectors(dest, bot.pos);
                    moveVec.y = 0;
                    const dist = moveVec.length();
                    if (dist > 0.1) {
                        moveVec.normalize();
                        bot.yaw = Math.atan2(moveVec.x, moveVec.z);
                        bot.pos.addScaledVector(moveVec, speed * dt);
                        resolveCollision(bot.pos, RADIUS, HEIGHT, world.colliders);
                    }
                }

                bot.group.rotation.y = bot.yaw;

                if (targetPos && ctx.time >= bot.reactAt) {
                    const aimAngle = Math.atan2(targetPos.x - bot.pos.x, targetPos.z - bot.pos.z);
                    bot.yaw = aimAngle;
                    if (bot.shootCooldown <= 0) {
                        ctx.fireBot(bot, targetPos, targetIsPlayer);
                        bot.shootCooldown = BURST_GAP;
                    }
                }
            });
        },
        damage(mesh, amount) {
            const bot = mesh.userData.bot;
            if (!bot || !bot.alive) return false;
            const isHead = mesh.userData.part === 'head';
            bot.health -= isHead ? amount * 2 : amount;
            if (bot.health <= 0) {
                bot.alive = false;
                bot.group.rotation.x = -1.45;
                bot.group.position.y = 0.2;
                return true;
            }
            return false;
        },
        aliveCount(team) {
            return list.filter(b => b.team === team && b.alive).length;
        },
        reset() {
            this.spawnAll();
        }
    };
}
