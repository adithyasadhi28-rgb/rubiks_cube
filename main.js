import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =====================================================
// MOBILE CSS INJECTION (Prevents pull-to-refresh & screen bouncing)
// =====================================================
const style = document.createElement('style');
style.innerHTML = `
    body, html {
        margin: 0;
        padding: 0;
        overflow: hidden;
        width: 100%;
        height: 100%;
        touch-action: none; /* Disables native smartphone browser gestures */
    }
    canvas {
        display: block;
        touch-action: none;
    }
`;
document.head.appendChild(style);

// =====================================================
// SCENE
// =====================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(6, 6, 6);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// =====================================================
// CONTROLS
// =====================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// =====================================================
// LIGHT
// =====================================================
scene.add(new THREE.AmbientLight(0xffffff, 2));

// =====================================================
// MATERIALS
// =====================================================
const materials = [
    new THREE.MeshBasicMaterial({ color: 0xb7121f }), // Right
    new THREE.MeshBasicMaterial({ color: 0x009b48 }), // Left
    new THREE.MeshBasicMaterial({ color: 0xffffff }), // Top
    new THREE.MeshBasicMaterial({ color: 0xffd500 }), // Bottom
    new THREE.MeshBasicMaterial({ color: 0xff5800 }), // Front
    new THREE.MeshBasicMaterial({ color: 0x0046ad })  // Back
];

// =====================================================
// RUBIK'S CUBE
// =====================================================
const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

const spacing = 1.05;

for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
            if (x === 0 && y === 0 && z === 0) continue;

            const cubie = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                materials
            );
            cubie.position.set(x * spacing, y * spacing, z * spacing);
            cubeGroup.add(cubie);
        }
    }
}

// =====================================================
// PIVOT
// =====================================================
const pivot = new THREE.Group();
scene.add(pivot);

// =====================================================
// ROTATION STATE
// =====================================================
let isRotating = false;
let rotationAxis = '';
let rotationDirection = 1;
let remainingRotation = 0;

// =====================================================
// POINTER STATE
// =====================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let startX = 0;
let startY = 0;

let selectedCubie = null;
let selectedFace = null;
let dragTriggered = false;

// =====================================================
// ANIMATION LOOP
// =====================================================
function animate() {
    requestAnimationFrame(animate);

    if (isRotating) {
        const step = 0.10;
        const rotateAmount = Math.min(step, Math.abs(remainingRotation)) * rotationDirection;
        remainingRotation -= Math.abs(rotateAmount);

        if (rotationAxis === 'x') pivot.rotation.x += rotateAmount;
        if (rotationAxis === 'y') pivot.rotation.y += rotateAmount;
        if (rotationAxis === 'z') pivot.rotation.z += rotateAmount;

        if (remainingRotation <= 0.0001) {
            completeRotation();
        }
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();

// =====================================================
// COMPLETE ROTATION
// =====================================================
function completeRotation() {
    pivot.updateMatrixWorld();

    while (pivot.children.length > 0) {
        const child = pivot.children[0];
        cubeGroup.attach(child);

        // SNAP POSITION
        child.position.x = Math.round(child.position.x / spacing) * spacing;
        child.position.y = Math.round(child.position.y / spacing) * spacing;
        child.position.z = Math.round(child.position.z / spacing) * spacing;

        // SNAP ROTATION
        child.rotation.x = Math.round(child.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
        child.rotation.y = Math.round(child.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
        child.rotation.z = Math.round(child.rotation.z / (Math.PI / 2)) * (Math.PI / 2);
    }

    pivot.rotation.set(0, 0, 0);
    isRotating = false;
    controls.enabled = true;
}

// =====================================================
// POINTER EVENTS (Handles desktop mouse & mobile touch)
// =====================================================
window.addEventListener('pointerdown', e => {
    if (isRotating) return;

    dragTriggered = false;
    startX = e.clientX;
    startY = e.clientY;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(cubeGroup.children);

    if (hits.length > 0) {
        selectedCubie = hits[0].object;

        // FIXED: Convert local normal to accurate world coordinates
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(selectedCubie.matrixWorld);
        selectedFace = hits[0].face.normal.clone().applyMatrix3(normalMatrix).normalize();
    } else {
        selectedCubie = null;
    }
});

window.addEventListener('pointermove', e => {
    if (dragTriggered) return;
    if (isRotating) return;
    if (!selectedCubie) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Adjusted distance threshold for mobile screens
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;

    dragTriggered = true;
    controls.enabled = false;

    let axis = '';
    let direction = 1;
    const horizontal = Math.abs(dx) > Math.abs(dy);

    // FRONT/BACK
    if (Math.abs(selectedFace.z) > 0.9) {
        if (horizontal) {
            axis = 'y';
            direction = dx > 0 ? 1 : -1;
        } else {
            axis = 'x';
            direction = dy > 0 ? 1 : -1;
        }
    }
    // LEFT/RIGHT
    else if (Math.abs(selectedFace.x) > 0.9) {
        if (horizontal) {
            axis = 'y';
            direction = dx > 0 ? 1 : -1;
        } else {
            axis = 'z';
            direction = dy > 0 ? 1 : -1;
        }
    }
    // TOP/BOTTOM
    else if (Math.abs(selectedFace.y) > 0.9) {
        if (horizontal) {
            axis = 'z';
            direction = dx > 0 ? 1 : -1;
        } else {
            axis = 'x';
            direction = dy > 0 ? 1 : -1;
        }
    }

    rotateLayer(selectedCubie, axis, direction);
    selectedCubie = null; // Clears target immediately to lock single movement execution loop
});

window.addEventListener('pointerup', () => {
    selectedCubie = null;
    if (!isRotating) {
        controls.enabled = true;
    }
});

// =====================================================
// ROTATE LAYER
// =====================================================
function rotateLayer(cubie, axis, direction) {
    if (isRotating) return;

    const pos = new THREE.Vector3();
    cubie.getWorldPosition(pos);

    const ix = Math.round(pos.x / spacing);
    const iy = Math.round(pos.y / spacing);
    const iz = Math.round(pos.z / spacing);

    const selected = [];

    cubeGroup.children.forEach(c => {
        const p = new THREE.Vector3();
        c.getWorldPosition(p);

        if (axis === 'x' && Math.round(p.x / spacing) === ix) selected.push(c);
        if (axis === 'y' && Math.round(p.y / spacing) === iy) selected.push(c);
        if (axis === 'z' && Math.round(p.z / spacing) === iz) selected.push(c);
    });

    if (selected.length === 0) return;

    pivot.rotation.set(0, 0, 0);
    selected.forEach(c => {
        pivot.attach(c);
    });

    rotationAxis = axis;
    rotationDirection = direction;
    remainingRotation = Math.PI / 2;
    isRotating = true;
}

// =====================================================
// RESIZE
// =====================================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});