import * as THREE from 'three';

// Walk 5.2 m/s, crouch 2.4: stopping to aim is the tactical choice.
const WALK_SPEED = 5.2;
const RADIUS = 0.34;
const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;
const STAND_EYE = 1.6;
const CROUCH_EYE = 1.02;
const CROUCH_SPEED = 2.4;
const GROUND_ACCEL = 42;
const AIR_ACCEL = 9;
const FRICTION = 9;
const GRAVITY = 20;
const JUMP_SPEED = 6.2;

export function createPlayer(colliders) {
  const position = new THREE.Vector3(0, 0, 14);
  const velocity = new THREE.Vector3();
  let yaw = 0;
  let pitch = 0;
  let eye = STAND_EYE;
  let onGround = true;
  let crouching = false;
  let height = STAND_HEIGHT;

  const probeBox = new THREE.Box3();
  const wishDir = new THREE.Vector3();

  function checkCollision(pos, h) {
    probeBox.min.set(pos.x - RADIUS, pos.y, pos.z - RADIUS);
    probeBox.max.set(pos.x + RADIUS, pos.y + h, pos.z + RADIUS);
    for (let i = 0; i < colliders.length; i++) {
      if (probeBox.intersectsBox(colliders[i])) return true;
    }
    return false;
  }

  function step(dt, keys) {
    const wantCrouch = keys.has('ControlLeft') || keys.has('KeyC');
    if (wantCrouch) {
      if (!crouching) {
        crouching = true;
        height = CROUCH_HEIGHT;
        position.y += STAND_HEIGHT - CROUCH_HEIGHT;
      }
    } else if (crouching) {
      probeBox.min.set(position.x - RADIUS, position.y, position.z - RADIUS);
      probeBox.max.set(position.x + RADIUS, position.y + STAND_HEIGHT, position.z + RADIUS);
      let blocked = false;
      for (let i = 0; i < colliders.length; i++) {
        if (probeBox.intersectsBox(colliders[i])) { blocked = true; break; }
      }
      if (!blocked) {
        crouching = false;
        height = STAND_HEIGHT;
      }
    }

    const targetEye = crouching ? CROUCH_EYE : STAND_EYE;
    eye += (targetEye - eye) * Math.min(1, dt * 15);

    wishDir.set(0, 0, 0);
    if (keys.has('KeyW')) wishDir.z -= 1;
    if (keys.has('KeyS')) wishDir.z += 1;
    if (keys.has('KeyA')) wishDir.x -= 1;
    if (keys.has('KeyD')) wishDir.x += 1;
    wishDir.normalize();
    wishDir.applyAxisAngle(THREE.YAxis, yaw);

    const speed = crouching ? CROUCH_SPEED : WALK_SPEED;
    const accel = onGround ? GROUND_ACCEL : AIR_ACCEL;

    if (onGround) {
      const drop = velocity.clone().multiplyScalar(FRICTION * dt);
      velocity.sub(drop);
      velocity.x += wishDir.x * speed * accel * dt;
      velocity.z += wishDir.z * speed * accel * dt;
      if (keys.has('Space')) {
        velocity.y = JUMP_SPEED;
        onGround = false;
      }
    } else {
      velocity.x += wishDir.x * speed * accel * dt;
      velocity.z += wishDir.z * speed * accel * dt;
      velocity.y -= GRAVITY * dt;
    }

    position.x += velocity.x * dt;
    if (checkCollision(position, height)) {
      position.x -= velocity.x * dt;
      velocity.x = 0;
    }

    position.z += velocity.z * dt;
    if (checkCollision(position, height)) {
      position.z -= velocity.z * dt;
      velocity.z = 0;
    }

    position.y += velocity.y * dt;
    if (checkCollision(position, height)) {
      position.y -= velocity.y * dt;
      if (velocity.y < 0) onGround = true;
      velocity.y = 0;
    } else {
      onGround = false;
    }
  }

  function look(dx, dy, sensitivity = 0.0022) {
    yaw -= dx * sensitivity;
    pitch = Math.max(-1.45, Math.min(1.45, pitch - dy * sensitivity));
  }

  function recoil(pitchKick, yawKick = 0) {
    pitch = Math.max(-1.45, Math.min(1.45, pitch - pitchKick));
    yaw += (Math.random() - 0.5) * yawKick;
  }

  function groundSpeed() {
    return Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
  }

  function spawn(side) {
    if (side === 'defend') { position.set(0, 0, -14); yaw = Math.PI; }
    else { position.set(0, 0, 14); yaw = 0; }
    velocity.set(0, 0, 0);
    pitch = 0;
    height = STAND_HEIGHT;
    eye = STAND_EYE;
    crouching = false;
    onGround = true;
  }

  return {
    get position() { return position; },
    get velocity() { return velocity; },
    get yaw() { return yaw; },
    set yaw(v) { yaw = v; },
    get pitch() { return pitch; },
    set pitch(v) { pitch = v; },
    get eye() { return eye; },
    get onGround() { return onGround; },
    get crouching() { return crouching; },
    get height() { return height; },
    step,
    look,
    recoil,
    groundSpeed,
    spawn
  };
}
