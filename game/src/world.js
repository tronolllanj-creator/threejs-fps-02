import * as THREE from 'three';
import { PALETTE } from './palette.js';

export // The canyon: 48 m wide, 36 m deep, walls 5.2 m high.
const MAP_W = 48;
export const MAP_D = 36;

export function createWorld(scene) {
    const group = new THREE.Group();
    scene.add(group);

    const colliders = [];
    const shootables = [];

    const matSand = new THREE.MeshStandardMaterial({ color: PALETTE.surface, roughness: 0.9, metalness: 0.05 });
    const matRiver = new THREE.MeshStandardMaterial({ color: 0x221a12, roughness: 0.95, metalness: 0.02 });
    const matWall = new THREE.MeshStandardMaterial({ color: 0x36281c, roughness: 0.95, metalness: 0.03 });
    const matRock = new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 0.9, metalness: 0.05 });
    const matCrate = new THREE.MeshStandardMaterial({ color: PALETTE.muted, roughness: 0.85, metalness: 0.08 });
    const matPylon = new THREE.MeshStandardMaterial({ color: PALETTE.accent, emissive: PALETTE.accent, emissiveIntensity: 0.5, roughness: 0.5 });
    const matFuel = new THREE.MeshStandardMaterial({ color: PALETTE.crimson, roughness: 0.6, metalness: 0.2 });
    const matA = new THREE.MeshStandardMaterial({ color: PALETTE.teal, roughness: 0.5 });
    const matB = new THREE.MeshStandardMaterial({ color: PALETTE.crimson, roughness: 0.5 });

    function addBox(x, y, z, w, h, d, mat, isCollider = true, isShootable = true) {
        const geom = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        const box3 = new THREE.Box3().setFromObject(mesh);
        if (isCollider) colliders.push(box3);
        if (isShootable) shootables.push({ mesh, box: box3 });
        return mesh;
    }

    // Floor & Riverbed
    addBox(0, -0.25, 0, MAP_W, 0.5, MAP_D, matSand);
    addBox(0, -0.2, 0, 8, 0.1, MAP_D, matRiver, false, false);

    // Canyon Perimeter Walls (5.2m high)
    const halfW = MAP_W / 2;
    const halfD = MAP_D / 2;
    addBox(-halfW - 1, 2.6, 0, 2, 5.2, MAP_D + 4, matWall);
    addBox(halfW + 1, 2.6, 0, 2, 5.2, MAP_D + 4, matWall);
    addBox(0, 2.6, -halfD - 1, MAP_W + 4, 5.2, 2, matWall);
    addBox(0, 2.6, halfD + 1, MAP_W + 4, 5.2, 2, matWall);

    // Raised Ridges (West & East, 1.2m high with ramps)
    addBox(-14, 0.6, 4, 6, 1.2, 4, matRock);
    addBox(-14, 0.3, 7, 4, 0.6, 3, matRock); // ramp
    addBox(14, 0.6, 4, 6, 1.2, 4, matRock);
    addBox(14, 0.3, 7, 4, 0.6, 3, matRock); // ramp

    // Riverbed Rocks (6 irregular rock boxes, 0.8-1.4m tall)
    const rockData = [
        [-2, 0.5, 2, 2, 1.0, 1.5],
        [2, 0.6, -2, 1.8, 1.2, 2.0],
        [-1, 0.4, -6, 1.5, 0.8, 1.5],
        [1, 0.7, 6, 2.2, 1.4, 1.8],
        [-3, 0.5, -10, 1.6, 1.0, 1.6],
        [3, 0.6, 9, 1.7, 1.2, 1.7]
    ];
    rockData.forEach(([rx, ry, rz, rw, rh, rd]) => addBox(rx, ry, rz, rw, rh, rd, matRock));

    // Lanes Cover
    addBox(-12, 0.5, 4, 2, 1, 2, matCrate);
    addBox(-12, 0.5, -6, 2, 1, 2, matCrate);
    addBox(12, 0.5, 4, 2, 1, 2, matCrate);
    addBox(12, 0.5, -6, 2, 1, 2, matCrate);

    // Corner Rock Stacks & Crates
    addBox(-20, 0.6, 12, 3, 1.2, 3, matRock);
    addBox(20, 0.6, 12, 3, 1.2, 3, matRock);
    addBox(-20, 0.6, -12, 3, 1.2, 3, matRock);
    addBox(20, 0.6, -12, 3, 1.2, 3, matRock);

    addBox(-8, 0.4, 12, 1.5, 0.8, 1.5, matCrate);
    addBox(8, 0.4, 12, 1.5, 0.8, 1.5, matCrate);

    // Site A: Radar Dish at (-18, -11)
    addBox(-18, 0.1, -11, 6, 0.2, 6, matSand, false, false);
    addBox(-18, 0.6, -11, 2, 1.2, 2, matCrate);
    const dishMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.2, 0.8, 8), matPylon);
    dishMesh.position.set(-18, 1.4, -11);
    dishMesh.rotation.x = 0.4;
    group.add(dishMesh);
    shootables.push({ mesh: dishMesh, box: new THREE.Box3().setFromObject(dishMesh) });
    colliders.push(new THREE.Box3().setFromObject(dishMesh));

    // Site B: Fuel Depot at (18, -11)
    addBox(18, 0.1, -11, 6, 0.2, 6, matSand, false, false);
    addBox(16, 0.8, -11, 1.2, 1.6, 1.2, matFuel);
    addBox(20, 0.8, -11, 1.2, 1.6, 1.2, matFuel);
    const pylonB = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 6), matPylon);
    pylonB.position.set(18, 1, -9);
    group.add(pylonB);
    shootables.push({ mesh: pylonB, box: new THREE.Box3().setFromObject(pylonB) });
    colliders.push(new THREE.Box3().setFromObject(pylonB));

    // Lighting
    const ambientLight = new THREE.HemisphereLight(0xfff0dd, 0x443322, 1.1);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(PALETTE.accent, 2.6);
    dirLight.position.set(20, 25, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 70;
    dirLight.shadow.camera.left = -26;
    dirLight.shadow.camera.right = 26;
    dirLight.shadow.camera.top = 26;
    dirLight.shadow.camera.bottom = -26;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(PALETTE.teal, 0.4);
    fillLight.position.set(-20, 15, -20);
    scene.add(fillLight);

    scene.fog = new THREE.Fog(PALETTE.canvas, 24, 70);

    function checkCollision(box) {
      for (let i = 0; i < colliders.length; i++) {
        if (box.intersectsBox(colliders[i])) return true;
      }
      return false;
    }

    // The canyon floor is flat at y = 0 (the floor box top); ridges are visual.
    function getFloorHeight(x, z) { return 0; }

    return {
        colliders,
        shootables,
        group,
        sites: {
            A: new THREE.Vector3(-18, 0, -11),
            B: new THREE.Vector3(18, 0, -11)
        },
        spawns: {
            attack: [[-6, 14], [0, 14.5], [6, 14]],
            defend: [[-6, -14], [0, -14.5], [6, -14]]
        },
        waypoints: {
            attack: [[-12, 9], [-12, 0], [-16, -7], [0, 5], [0, -5], [12, 9], [12, 0], [16, -7]],
            defend: [[-18, -11], [18, -11], [-8, -9], [8, -9], [0, -13], [-18, -3], [18, -3]],
            mid: [[0, 9], [0, 0], [0, -9]],
            ridge: [[-14, 4], [14, 4]]
        },
        bounds: { x: 23, z: 17 },
        checkCollision,
        getFloorHeight
    };
}
