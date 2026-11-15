import * as THREE from 'three';
import { PALETTE } from './palette.js';

export // One table drives the buy menu, the view model and the damage numbers.
const WEAPONS = {
    pistol: { price: 0, mag: 12, reserve: 36, damage: 26, headMul: 2, fireGap: 0.16, reload: 1.1, spreadStill: 0.004, spreadMove: 0.02, recoil: 0.006, auto: false, label: 'P9 Sidearm' },
    smg: { price: 700, mag: 25, reserve: 75, damage: 22, headMul: 2, fireGap: 0.07, reload: 1.6, spreadStill: 0.003, spreadMove: 0.03, recoil: 0.005, auto: true, label: 'Dune-9 SMG' },
    rifle: { price: 900, mag: 30, reserve: 90, damage: 34, headMul: 2, fireGap: 0.096, reload: 1.9, spreadStill: 0.0022, spreadMove: 0.028, recoil: 0.009, auto: true, label: 'KV-9 Carbine' },
    sniper: { price: 2200, mag: 5, reserve: 15, damage: 95, headMul: 2, fireGap: 1.1, reload: 2.6, spreadStill: 0.0005, spreadMove: 0.05, recoil: 0.03, auto: false, label: 'Canyon-90' }
};

export function createWeapon(camera) {
    let currentKey = 'pistol';
    let defObj = WEAPONS[currentKey];
    let mag = defObj.mag;
    let reserve = defObj.reserve;
    let cooldown = 0;
    let reloadLeft = 0;
    let flash = 0;
    let kick = 0;
    let reloadDip = 0;

    const group = new THREE.Group();
    camera.add(group);

    let flashLight = new THREE.PointLight(PALETTE.accent, 0, 4);
    flashLight.position.set(0.18, -0.15, -0.7);
    group.add(flashLight);

    let flashMesh = null;

    function buildModel() {
        while (group.children.length > 0) {
            group.remove(group.children[0]);
        }
        group.add(flashLight);

        const bodyMat = new THREE.MeshLambertMaterial({ color: PALETTE.surface });
        const accMat = new THREE.MeshLambertMaterial({ color: PALETTE.hairline });
        const accentMat = new THREE.MeshLambertMaterial({ color: PALETTE.accent });

        let receiverGeom = new THREE.BoxGeometry(0.08, 0.09, 0.35);
        let receiver = new THREE.Mesh(receiverGeom, bodyMat);
        receiver.position.set(0.18, -0.18, -0.4);
        group.add(receiver);

        let barrelGeom = new THREE.BoxGeometry(0.04, 0.04, 0.25);
        let barrel = new THREE.Mesh(barrelGeom, accMat);
        barrel.position.set(0.18, -0.16, -0.6);
        group.add(barrel);

        if (currentKey === 'sniper') {
            let scopeGeom = new THREE.BoxGeometry(0.05, 0.06, 0.2);
            let scope = new THREE.Mesh(scopeGeom, accentMat);
            scope.position.set(0.18, -0.11, -0.45);
            group.add(scope);
        }

        let flashGeom = new THREE.PlaneGeometry(0.1, 0.1);
        let flashMat = new THREE.MeshBasicMaterial({ color: PALETTE.gold, side: THREE.DoubleSide, transparent: true, opacity: 0 });
        flashMesh = new THREE.Mesh(flashGeom, flashMat);
        flashMesh.position.set(0.18, -0.16, -0.75);
        group.add(flashMesh);
    }

    buildModel();

    return {
        get mag() { return mag; },
        set mag(v) { mag = v; },
        get reserve() { return reserve; },
        set reserve(v) { reserve = v; },
        get cooldown() { return cooldown; },
        get reloadLeft() { return reloadLeft; },
        step(dt) {
            if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
            if (flash > 0) {
                flash = Math.max(0, flash - dt);
                if (flashMesh) flashMesh.material.opacity = flash > 0 ? 1 : 0;
                flashLight.intensity = flash > 0 ? 2 : 0;
            }
            if (kick > 0) {
                kick = Math.max(0, kick - dt * 6);
            }
            if (reloadLeft > 0) {
                reloadLeft -= dt;
                reloadDip = Math.sin((1 - reloadLeft / defObj.reload) * Math.PI) * 0.15;
                if (reloadLeft <= 0) {
                    let needed = defObj.mag - mag;
                    let take = Math.min(needed, reserve);
                    mag += take;
                    reserve -= take;
                    reloadDip = 0;
                }
            }
            group.position.y = -0.05 - reloadDip - kick * 0.3;
            group.rotation.x = kick;
        },
        ready() {
            return mag > 0 && cooldown <= 0 && reloadLeft <= 0;
        },
        pullTrigger() {
            cooldown = defObj.fireGap;
            flash = 0.06;
            kick = defObj.recoil;
        },
        takeRound() {
            if (mag <= 0) return false;
            mag--;
            return true;
        },
        reload() {
            if (reloadLeft > 0 || mag >= defObj.mag || reserve <= 0) return;
            reloadLeft = defObj.reload;
        },
        spread(speed) {
            let moveFactor = Math.min(1, speed / 5.2);
            return defObj.spreadStill + moveFactor * defObj.spreadMove;
        },
        refill() {
            mag = defObj.mag;
            reserve = defObj.reserve * 2;
            cooldown = 0;
            reloadLeft = 0;
        },
        equip(name) {
            if (!WEAPONS[name]) return;
            currentKey = name;
            defObj = WEAPONS[name];
            mag = defObj.mag;
            reserve = defObj.reserve;
            cooldown = 0;
            reloadLeft = 0;
            buildModel();
        },
        currentName() {
            return currentKey;
        },
        def() {
            return defObj;
        }
    };
}
