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

const _box = new THREE.Box3();
const _wish = new THREE.Vector3();

export function createPlayer(colliders) {
  return {
    position: new THREE.Vector3(0, 0, 13),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    eye: STAND_EYE,
    onGround: true,
    crouching: false,
    height: STAND_HEIGHT,
    health: 100,
    alive: true,

    damage(dmg) {
      if (!this.alive) return false;
      this.health -= dmg;
      if (this.health <= 0) {
        this.health = 0;
        this.alive = false;
        return true;
      }
      return false;
    },

    spawn() {
      this.position.set(0, 0, 13);
      this.velocity.set(0, 0, 0);
      this.yaw = 0;
      this.pitch = 0;
      this.health = 100;
      this.alive = true;
      this.onGround = true;
      this.crouching = false;
      this.height = STAND_HEIGHT;
      this.eye = STAND_EYE;
    },

    step(dt, keys) {
      if (typeof keys.has !== 'function') keys = new Set(Object.keys(keys).filter(k => keys[k]));
      const wantCrouch = keys.has('ControlLeft') || keys.has('KeyC');
      const targetHeight = wantCrouch ? CROUCH_HEIGHT : STAND_HEIGHT;
      const targetEye = wantCrouch ? CROUCH_EYE : STAND_EYE;

      if (wantCrouch) {
        this.crouching = true;
        this.height = CROUCH_HEIGHT;
        this.eye = CROUCH_EYE;
      } else if (this.crouching) {
        _box.min.set(this.position.x - RADIUS, this.position.y, this.position.z - RADIUS);
        _box.max.set(this.position.x + RADIUS, this.position.y + STAND_HEIGHT, this.position.z + RADIUS);
        let fits = true;
        for (let i = 0; i < colliders.length; i++) {
          if (_box.intersectsBox(colliders[i])) {
            fits = false;
            break;
          }
        }
        if (fits) {
          this.crouching = false;
          this.height = STAND_HEIGHT;
          this.eye = STAND_EYE;
        }
      }

      const speed = this.crouching ? CROUCH_SPEED : WALK_SPEED;
      _wish.set(0, 0, 0);
      if (keys.has('KeyW')) _wish.z -= 1;
      if (keys.has('KeyS')) _wish.z += 1;
      if (keys.has('KeyA')) _wish.x -= 1;
      if (keys.has('KeyD')) _wish.x += 1;
      if (_wish.lengthSq() > 0) {
        _wish.normalize();
        _wish.applyAxisAngle(THREE.Vector3.Y, this.yaw);
      }

      const accel = this.onGround ? GROUND_ACCEL : AIR_ACCEL;
      if (this.onGround) {
        const drop = this.velocity.clone().multiplyScalar(FRICTION * dt);
        this.velocity.sub(drop);
        this.velocity.x += _wish.x * speed * accel * dt;
        this.velocity.z += _wish.z * speed * accel * dt;
        if (keys.has('Space')) {
          this.velocity.y = JUMP_SPEED;
          this.onGround = false;
        }
      } else {
        this.velocity.x += _wish.x * speed * accel * dt;
        this.velocity.z += _wish.z * speed * accel * dt;
        this.velocity.y -= GRAVITY * dt;
      }

      this.position.x += this.velocity.x * dt;
      _box.min.set(this.position.x - RADIUS, this.position.y, this.position.z - RADIUS);
      _box.max.set(this.position.x + RADIUS, this.position.y + this.height, this.position.z + RADIUS);
      for (let i = 0; i < colliders.length; i++) {
        if (_box.intersectsBox(colliders[i])) {
          if (this.velocity.x > 0) this.position.x = colliders[i].min.x - RADIUS;
          else if (this.velocity.x < 0) this.position.x = colliders[i].max.x + RADIUS;
          this.velocity.x = 0;
          break;
        }
      }

      this.position.z += this.velocity.z * dt;
      _box.min.set(this.position.x - RADIUS, this.position.y, this.position.z - RADIUS);
      _box.max.set(this.position.x + RADIUS, this.position.y + this.height, this.position.z + RADIUS);
      for (let i = 0; i < colliders.length; i++) {
        if (_box.intersectsBox(colliders[i])) {
          if (this.velocity.z > 0) this.position.z = colliders[i].min.z - RADIUS;
          else if (this.velocity.z < 0) this.position.z = colliders[i].max.z + RADIUS;
          this.velocity.z = 0;
          break;
        }
      }

      this.position.y += this.velocity.y * dt;
      _box.min.set(this.position.x - RADIUS, this.position.y, this.position.z - RADIUS);
      _box.max.set(this.position.x + RADIUS, this.position.y + this.height, this.position.z + RADIUS);
      this.onGround = false;
      for (let i = 0; i < colliders.length; i++) {
        if (_box.intersectsBox(colliders[i])) {
          if (this.velocity.y < 0) {
            this.position.y = colliders[i].max.y;
            this.onGround = true;
          } else if (this.velocity.y > 0) {
            this.position.y = colliders[i].min.y - this.height;
          }
          this.velocity.y = 0;
          break;
        }
      }
    },

    look(dx, dy, sensitivity = 0.0022) {
      this.yaw -= dx * sensitivity;
      this.pitch -= dy * sensitivity;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    },

    recoil(pitchKick, yawKick = 0) {
      this.pitch -= pitchKick;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
      this.yaw += (Math.random() - 0.5) * yawKick;
    },

    groundSpeed() {
      return Math.hypot(this.velocity.x, this.velocity.z);
    }
  };
}
