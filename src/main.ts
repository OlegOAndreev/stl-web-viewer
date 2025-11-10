import GUI from 'lil-gui';
import {
    BoxGeometry,
    Color,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Scene,
    WebGLRenderer
} from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const fov = 90;
const nearZ = 0.1;
const farZ = 1000.0;

const settingsKey = 'stl-web-viewer-settings';
const savedModeName = 'latest-model';

const scene = new Scene();

const camera = new PerspectiveCamera(fov, 1.0, nearZ, farZ);
// const controls = new OrbitControls(camera, null);

const canvas = document.getElementById('threejs') as HTMLCanvasElement;
if (!canvas) {
    throw new Error('Canvas element with id "threejs" not found');
}

const settings = {
    showStats: false,
    latestModelName: ""
};

const opfsRoot = await navigator.storage.getDirectory();
const savedFileHandle = await opfsRoot.getFileHandle(savedModeName, {
    create: true,
});

const gui = new GUI({ title: 'STL Viewer' });
const statsPanel = new Stats();
createGui();
await loadSavedFile();

const renderer = new WebGLRenderer({ canvas });
let prevWidth = 0;
let prevHeight = 0;
updateCanvasSize();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setAnimationLoop(animate);
renderer.setClearColor(new Color('white'), 1.0);

const stlLoader = new STLLoader();

const material = new MeshBasicMaterial({ color: 0x00ff00 });
const geometry = new BoxGeometry(10, 1, 0.5)
const mesh = new Mesh(geometry, material);
scene.add(mesh);

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
    Object.assign(settings, JSON.parse(localStorage.getItem(settingsKey) ?? "{}"));

    gui.onChange((_) => saveSettings());

    const fileInput = document.getElementById("file-input");
    if (!fileInput) {
        throw new Error('Element with id "file-input" not found');
    }
    fileInput.addEventListener("change", (event: Event) => {
        const target = event.target as HTMLInputElement;
        if (target.files!.length > 0) {
            const file = target.files![0];

            const reader = new FileReader();
            reader.onload = () => {
                onFileLoad(file.name, reader.result as ArrayBuffer);
                saveFile(file.name, reader.result as ArrayBuffer);
            };
            reader.onerror = () => console.log("File loading failed");
            reader.readAsArrayBuffer(file);
        }
    });

    gui.add((() => fileInput.click()) as CallableFunction, 'call')
        .name("Load File");

    const folder = gui.addFolder('Misc');
    folder.add(settings, 'showStats').name("Show stats").onChange((v: boolean) => {
        statsPanel.dom.style.display = v ? 'block' : 'none';
    });
    folder.close();

    // We override the style via css file
    statsPanel.dom.id = 'stats-panel';
    statsPanel.dom.style.cssText = '';
    document.body.appendChild(statsPanel.dom);
    statsPanel.dom.style.display = settings.showStats ? 'block' : 'none';
}

function saveSettings() {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function setTitle(filename: string) {
    gui.title(filename);
    document.title = filename + ' - STL Viewer';
}

async function loadSavedFile() {
    if (settings.latestModelName === '') {
        return;
    }

    console.log("Loading stored model", settings.latestModelName);
    let file = await savedFileHandle.getFile();
    const reader = new FileReader();
    reader.onload = () => onFileLoad(settings.latestModelName, reader.result as ArrayBuffer);
    reader.onerror = () => console.log("File loading failed");
    reader.readAsArrayBuffer(file);
}

async function saveFile(filename: string, contents: ArrayBuffer) {
    // Store the model name and contents to local storage.
    settings.latestModelName = filename;
    saveSettings();
    const writable = await savedFileHandle.createWritable();
    await writable.write(contents);
    await writable.close();
    console.log("Stored the contents to", savedFileHandle);
}

async function onFileLoad(filename: string, contents: ArrayBuffer) {
    console.log(`Loading file ${filename} with length ${contents.byteLength}`);

    setTitle(filename);

    const geometry = stlLoader.parse(contents);
    geometry.computeBoundingBox();
    console.log("Loaded object with bb ", geometry.boundingBox);
}

function animate(_time: DOMHighResTimeStamp, _frame: XRFrame) {
    updateCanvasSize();

    // cube.rotation.x += 0.01;
    // cube.rotation.y += 0.01;

    renderer.render(scene, camera);

    if (settings.showStats) {
        statsPanel.update();
    }
}
