import GUI from 'lil-gui';
import * as THREE from 'three';
import THREEStats from 'three/addons/libs/stats.module.js';

const fov = 90;
const nearZ = 0.1;
const farZ = 1000.0;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(fov, 1.0, nearZ, farZ);
camera.position.z = 2;

const canvas = document.getElementById('threejs') as HTMLCanvasElement;
if (!canvas) {
    throw new Error('Canvas element with id "threejs" not found');
}

const settings = {
    showStats: false
};

const statsPanel = new THREEStats();
createGui();

const renderer = new THREE.WebGLRenderer({ canvas });
let prevWidth = 0;
let prevHeight = 0;
updateCanvasSize();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setAnimationLoop(animate);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

function updateCanvasSize() {
    if (prevWidth != canvas.clientWidth || prevHeight != canvas.clientHeight) {
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        prevWidth = canvas.clientWidth;
        prevHeight = canvas.clientHeight;
    }
}

function createGui() {
    const settingsKey = 'stl-web-viewer-settings';
    Object.assign(settings, JSON.parse(localStorage.getItem(settingsKey) ?? "{}"));

    const gui = new GUI({ title: 'STL Viewer' });
    gui.onChange((_) => {
        localStorage.setItem(settingsKey, JSON.stringify(settings));
    });

    const folder = gui.addFolder('Misc');
    folder.add(settings, 'showStats').name("Show stats").onChange((v: boolean) => {
        statsPanel.dom.style.display = v ? 'block' : 'none';
    });
    folder.close();

    statsPanel.dom.style.display = settings.showStats ? 'block' : 'none';
    // We override the style via css file
    statsPanel.dom.id = 'stats-panel';
    statsPanel.dom.style.cssText = '';
    document.body.appendChild(statsPanel.dom);
}

function animate(_time: DOMHighResTimeStamp, _frame: XRFrame) {
    updateCanvasSize();

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    renderer.render(scene, camera);

    if (settings.showStats) {
        statsPanel.update();
    }
}
