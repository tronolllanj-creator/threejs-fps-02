import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const MAP_W = 44;
const WALL_HEIGHT = 4.6;
export const MAP_D = 34;

export function createWorld(scene) {
    const colliders = [];
    const shootables = [];
    const group = new THREE.Group();
    scene.add(group);

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.9, metalness: 0.05 });
    const wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.surface, roughness: 0.92, metalness: 0.03 });
    const crateMat = new THREE.MeshStandardMaterial({ color: PALETTE.hairline, roughness: 0.88, metalness: 0.04 });
    const accentMat = new THREE.MeshStandardMaterial({ color: PALETTE.accent, emissive: PALETTE.accent, emissiveIntensity: 0.5, roughness: 0.85, metalness: 0.05 });
    const drumMat = new THREE.MeshStandardMaterial({ color: PALETTE.muted, roughness: 0.85, metalness: 0.1 });
    const siteRingMat = new THREE.MeshStandardMaterial({ color: PALETTE.cyan, roughness: 0.9, metalness: 0.05 });

    function addBox(x, y, z, w, h, d, mat, isShootable = true) {
        const geom = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(x, y + h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        colliders.push(box);
        if (isShootable) shootables.push(mesh);
        return mesh;
    }

    function addCylinder(x, y, z, r, h, mat) {
        const geom = new THREE.CylinderGeometry(r, r, h, 16);
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(x, y + h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        colliders.push(box);
        shootables.push(mesh);
        return mesh;
    }

    // Floor
    addBox(0, -0.1, 0, MAP_W, 0.2, MAP_D, floorMat, false);

    // Perimeter walls (4.6m high, thickness 1)
    const wallH = 4.6;
    const halfW = MAP_W / 2;
    const halfD = MAP_D / 2;
    addBox(0, 0, -halfD - 0.5, MAP_W + 2, wallH, 1, wallMat);
    addBox(0, 0, halfD + 0.5, MAP_W + 2, wallH, 1, wallMat);
    addBox(-halfW - 0.5, 0, 0, 1, wallH, MAP_D + 2, wallMat);
    addBox(halfW + 0.5, 0, 0, 1, wallH, MAP_D + 2, wallMat);

    // Sites A & B markers (-16, -10) and (16, -10)
    const sitesData = [{ x: -16, z: -10 }, { x: 16, z: -10 }];
    sitesData.forEach(s => {
        addBox(s.x, 0, s.z, 4, 0.1, 4, siteRingMat, false);
        addBox(s.x, 0.05, s.z, 2.4, 0.2, 2.4, accentMat, false);
        const pylon = addBox(s.x, 0.25, s.z, 0.4, 2.2, 0.4, accentMat, true);
        pylon.userData.isPylon = true;
    });

    // Mid container stacks around (0,0)
    addBox(0, 0, 0, 3, 1.6, 6, crateMat);
    addBox(-2.2, 0, 1, 2.5, 1.6, 4, crateMat);
    addBox(2.2, 0, -1, 2.5, 1.1, 4, crateMat);

    // West lane cover (-10, 2), (-10, -6)
    addBox(-10, 0, 2, 2, 1.6, 3, crateMat);
    addBox(-10, 0, -6, 2, 1.6, 3, crateMat);

    // East lane cover (10, 2), (10, -6)
    addBox(10, 0, 2, 2, 1.6, 3, crateMat);
    addBox(10, 0, -6, 2, 1.6, 3, crateMat);

    // Raised loading dock (6 x 0.5 x 3) at (0, -13) with ramp
    addBox(0, 0, -13, 6, 0.5, 3, crateMat);
    addBox(0, 0, -11, 2, 0.25, 1.5, crateMat);

    // Corner container stacks
    addBox(-18, 0, 12, 3, 2.2, 5, crateMat);
    addBox(18, 0, 12, 3, 2.2, 5, crateMat);
    addBox(-18, 0, -12, 3, 2.2, 5, crateMat);
    addBox(18, 0, -12, 3, 2.2, 5, crateMat);

    // Scattered oil drums
    addCylinder(-4, 0, 4, 0.4, 1.0, drumMat);
    addCylinder(4, 0, 4, 0.4, 1.0, drumMat);
    addCylinder(-6, 0, -2, 0.4, 1.0, drumMat);
    addCylinder(6, 0, -2, 0.4, 1.0, drumMat);
    addCylinder(0, 0, 6, 0.4, 1.0, drumMat);

    // Lighting
    scene.fog = new THREE.Fog(PALETTE.canvas, 20, 60);

    const hemiLight = new THREE.HemisphereLight(PALETTE.ink, PALETTE.surface, 1.6);
    scene.add(hemiLight);
    const ambLight = new THREE.AmbientLight(0x8899aa, 0.4);
    scene.add(ambLight);

    const dirLight = new THREE.DirectionalLight(PALETTE.accent, 2.6);
    dirLight.position.set(15, 25, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;
    const d = 24;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(PALETTE.cyan, 0.9);
    fillLight.position.set(-15, 20, -10);
    scene.add(fillLight);

    return {
        colliders,
        shootables,
        group,
        sites: {
            A: new THREE.Vector3(-16, 0, -10),
            B: new THREE.Vector3(16, 0, -10)
        },
        spawns: {
            attack: [[-6, 13], [0, 13.5], [6, 13]],
            defend: [[-6, -13], [0, -13.5], [6, -13]]
        },
        waypoints: {
            attack: [[-10, 8], [-10, 0], [-14, -6], [0, 4], [0, -4], [10, 8], [10, 0], [14, -6]],
            defend: [[-16, -10], [16, -10], [-8, -8], [8, -8], [0, -12], [-16, -2], [16, -2]],
            mid: [[0, 8], [0, 0], [0, -8]]
        },
        bounds: { x: 21, z: 16 },
        checkSite(pos) {
            const dA = (pos.x + 16) * (pos.x + 16) + (pos.z + 10) * (pos.z + 10);
            const dB = (pos.x - 16) * (pos.x - 16) + (pos.z + 10) * (pos.z + 10);
            if (dA <= 2.5 * 2.5) return 'A';
            if (dB <= 2.5 * 2.5) return 'B';
            return null;
        },
        groundHeight() {
            return 0;
        }
    };
}
