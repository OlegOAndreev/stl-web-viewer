import GUI from 'lil-gui';
import {
    AmbientLight,
    BufferGeometry,
    Color,
    CylinderGeometry,
    DirectionalLight,
    DoubleSide,
    EdgesGeometry,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshPhongMaterial,
    OrthographicCamera,
    PerspectiveCamera,
    Scene,
    WebGLRenderer
} from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { TrackballControls } from 'three/examples/jsm/Addons.js';

const fov = 80;
const nearZ = 0.1;
const farZ = 10000.0;
const solidColor = 0x808080;
const lineColor = 0x000000;
const bgColor = 0xFFFFFF;
const lightColor = 0xFFFFFF;

// We store settings into LocalStorage and last model into OPFS
const settingsKey = 'stl-web-viewer-settings';
const savedModelName = 'latest-model';

const canvas = document.getElementById('threejs') as HTMLCanvasElement;
if (!canvas) {
    throw new Error('Canvas element with id "threejs" not found');
}

const opfsRoot = await navigator.storage.getDirectory();
const savedModelHandle = await opfsRoot.getFileHandle(savedModelName, { create: true });

type Settings = {
    cameraIsPerspective: boolean,
    withLight: boolean,
    showWireframe: boolean,
    showStats: boolean,
    latestModelName: string,
};
const settings = loadSettings();
const statsPanel = createStatsPanel();
const gui = createGui();

const renderer = new WebGLRenderer({ canvas });

const scene = new Scene();

const viewSize = {
    width: 0,
    height: 0,
    aspect: 0.0,
    // Ortho camera size is computed from model size
    orthoCameraSize: 0.0,
};

const perspCamera = new PerspectiveCamera(fov, 1.0, nearZ, farZ);
const orthoCamera = new OrthographicCamera(-1.0, 1.0, 1.0, -1.0, nearZ, farZ);
let curControls = createControls(settings.cameraIsPerspective);
updateCanvasSize();

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(new Color(bgColor), 1.0);

const directionalLight = createLight();

const materials = {
    basic: new MeshPhongMaterial({
        color: solidColor,
        side: DoubleSide,
        flatShading: true,
        // Offset polygons just a bit so that the lines do not z-fight with them. Replace lines with polygonal lines?
        polygonOffset: true,
        polygonOffsetFactor: 1.0,
        polygonOffsetUnits: 1.0,
    }),

    wireframe: new LineBasicMaterial({
        color: lineColor,
    }),
};

type PreparedModel = {
    geo: BufferGeometry,
    edges: EdgesGeometry,
    mesh: Mesh,
    wireframeLines: LineSegments,
}
let curModel = createDefaultModel();

await loadSavedFile();

renderer.setAnimationLoop(animate);

function loadSettings(): Settings {
    const settings = {
        cameraIsPerspective: false,
        withLight: true,
        showWireframe: false,
        showStats: false,
        latestModelName: "",
    };
    Object.assign(settings, JSON.parse(localStorage.getItem(settingsKey) ?? "{}"));
    return settings;
}

function saveSettings() {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function createGui(): GUI {
    const gui = new GUI({ title: 'No File' });

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
            reader.onload = async () => {
                await onLoadFile(file.name, reader.result as ArrayBuffer);
                await saveFile(file.name, reader.result as ArrayBuffer);
            };
            reader.onerror = () => console.log("File loading failed");
            reader.readAsArrayBuffer(file);
        }
    });

    gui.add((() => fileInput.click()) as CallableFunction, 'call')
        .name("Load File");

    const rFolder = gui.addFolder('Rendering');
    rFolder.add(settings, 'cameraIsPerspective')
        .name("Perspective camera")
        .onChange((perspective: boolean) => {
            curControls = createControls(perspective)
        });
    rFolder.add(settings, 'showWireframe')
        .name("Show wireframe")
        .onChange((wireframe: boolean) => updateModelVisibility(curModel, wireframe));
    rFolder.add(settings, 'withLight')
        .name("Enable light")
        .onChange((withLight: boolean) => directionalLight.visible = withLight);
    rFolder.close();

    const miscFolder = gui.addFolder('Misc');
    miscFolder.add((() => unloadModel()) as CallableFunction, 'call')
        .name("Unload File");
    miscFolder.add(settings, 'showStats')
        .name("Show stats")
        .onChange((v: boolean) => {
            statsPanel.dom.style.display = v ? 'block' : 'none';
        });
    miscFolder.close();

    return gui;
}

function createStatsPanel(): Stats {
    const statsPanel = new Stats();
    // We override the style via css file
    statsPanel.dom.id = 'stats-panel';
    statsPanel.dom.style.cssText = '';
    document.body.appendChild(statsPanel.dom);
    statsPanel.dom.style.display = settings.showStats ? 'block' : 'none';
    return statsPanel;
}

function setTitle(filename: string) {
    if (filename === '') {
        gui.title('No File');
        document.title = 'STL Viewer';
    } else {
        gui.title(filename);
        document.title = filename + ' - STL Viewer';
    }
}

function createControls(perspective: boolean): TrackballControls {
    const camera = perspective ? perspCamera : orthoCamera;
    const controls = new TrackballControls(camera, canvas);
    // Default rotation speed is painfully slow.
    controls.rotateSpeed = 2.0;
    return controls;
}

function createLight(): DirectionalLight {
    scene.add(new AmbientLight(lightColor, 1.0));

    const directionalLight = new DirectionalLight(lightColor, 1.5);
    directionalLight.position.set(100.0, 100.0, 100.0);
    scene.add(directionalLight);
    if (!settings.withLight) {
        directionalLight.visible = false;
    }
    return directionalLight;
}

function updateCanvasSize() {
    if (viewSize.width != canvas.clientWidth || viewSize.height != canvas.clientHeight) {
        viewSize.width = canvas.clientWidth;
        viewSize.height = canvas.clientHeight;
        viewSize.aspect = viewSize.width / viewSize.height;

        perspCamera.aspect = viewSize.aspect;
        perspCamera.updateProjectionMatrix();
        updateOrthoCameraDimensions();
        curControls.handleResize();

        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    }
}

function updateOrthoCameraDimensions() {
    orthoCamera.left = -viewSize.orthoCameraSize * viewSize.aspect;
    orthoCamera.right = viewSize.orthoCameraSize * viewSize.aspect;
    orthoCamera.top = viewSize.orthoCameraSize;
    orthoCamera.bottom = -viewSize.orthoCameraSize;
    orthoCamera.updateProjectionMatrix();
}

async function loadSavedFile() {
    if (settings.latestModelName === '') {
        return;
    }

    console.log("Loading stored model", settings.latestModelName);
    const file = await savedModelHandle.getFile();
    const reader = new FileReader();
    reader.onload = () => onLoadFile(settings.latestModelName, reader.result as ArrayBuffer);
    reader.onerror = () => console.log("File loading failed");
    reader.readAsArrayBuffer(file);
}

async function saveFile(filename: string, contents: ArrayBuffer) {
    // Store the model name and contents to local storage.
    settings.latestModelName = filename;
    saveSettings();
    const writable = await savedModelHandle.createWritable();
    await writable.write(contents);
    await writable.close();
    console.log("Stored the contents to", savedModelHandle);
}

async function onLoadFile(filename: string, contents: ArrayBuffer) {
    console.log(`Loading file ${filename} with length ${contents.byteLength}`);
    setTitle(filename);

    disposeModel(curModel);
    const stlLoader = new STLLoader();
    curModel = createModelFromGeo(stlLoader.parse(contents));

    console.log('Loaded object with bounding sphere', curModel.geo.boundingSphere);
}

function createDefaultModel(): PreparedModel {
    const defaultGeo = new CylinderGeometry(10.0, 15.0, 8.0, 20, 3);
    return createModelFromGeo(defaultGeo);
}

function createModelFromGeo(geo: BufferGeometry): PreparedModel {
    // Scale the geometry to ~ 10.0-1000.0 dimensions.
    geo.computeBoundingSphere();
    const modelRadius = geo.boundingSphere!.radius;
    if (modelRadius > 1000.0) {
        const scale = 1000.0 / modelRadius;
        geo.scale(scale, scale, scale);
        geo.computeBoundingSphere();
    } else if (modelRadius < 10.0) {
        const scale = 10.0 / modelRadius;
        geo.scale(scale, scale, scale);
        geo.computeBoundingSphere();
    }

    const edges = new EdgesGeometry(geo, 0.01);
    const mesh = new Mesh(geo, materials.basic);
    const wireframeLines = new LineSegments(edges, materials.wireframe);
    scene.add(mesh);
    scene.add(wireframeLines);

    const result = {
        geo: geo,
        edges: edges,
        mesh: mesh,
        wireframeLines: wireframeLines,
    };

    updateModelVisibility(result, settings.showWireframe);
    updateCameraForModel(result);
    return result;
}

function disposeModel(model: PreparedModel) {
    model.geo.dispose();
    model.edges.dispose();
    scene.remove(model.mesh);
    scene.remove(model.wireframeLines);
}

function updateModelVisibility(model: PreparedModel, showWireframe: boolean) {
    model.mesh.visible = !showWireframe;
}

function updateCameraForModel(model: PreparedModel) {
    const modelRadius = model.geo.boundingSphere!.radius;
    // Update the cameras for new model geometry.
    const modelCenter = model.geo.boundingSphere!.center;
    console.log("Updating camera with center and radius", modelCenter, modelRadius);
    curControls.target.copy(modelCenter);
    perspCamera.position.copy(modelCenter);
    perspCamera.position.z += modelRadius * 2;
    orthoCamera.position.copy(modelCenter);
    // Store model size for ortho camera.
    viewSize.orthoCameraSize = modelRadius * 2;
    updateOrthoCameraDimensions();
    orthoCamera.position.z += modelRadius * 2;
    curControls.update();
}

function splitGeometryIntoParts(geo: BufferGeometry): BufferGeometry[] {
    return null
}

async function unloadModel() {
    await saveFile('', new ArrayBuffer());
    setTitle('');
    disposeModel(curModel);
    curModel = createDefaultModel();
}

function animate(_time: DOMHighResTimeStamp, _frame: XRFrame) {
    updateCanvasSize();
    curControls.update();

    const camera = settings.cameraIsPerspective ? perspCamera : orthoCamera;
    renderer.render(scene, camera);

    if (settings.showStats) {
        statsPanel.update();
    }
}
