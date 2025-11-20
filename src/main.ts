import GUI from 'lil-gui';
import {
    AmbientLight,
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    Color,
    CylinderGeometry,
    DirectionalLight,
    EdgesGeometry,
    FrontSide,
    LineBasicMaterial,
    LineSegments,
    Material,
    Mesh,
    MeshPhongMaterial,
    OrthographicCamera,
    PerspectiveCamera,
    Scene,
    Vector3,
    WebGLRenderer
} from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { BufferGeometryUtils, TrackballControls } from 'three/examples/jsm/Addons.js';

import { splitDisjointGeometry } from './split-geometry';

const fov = 80;
const nearZ = 0.1;
const farZ = 10000.0;
const modelMinSize = 10.0;
const modelMaxSize = 1000.0;
const lineColor = 0x000000;
const positiveNormalColor = 0x00C000;
const negativeNormalColor = 0xD00000;
const bgColor = 0xFFFFFF;
const lightColor = 0xFFFFFF;
const modelColor = 0x808080;
// Generated with https://paletton.com
const fancyColors = [
    0x804343, 0x805F43, 0x284D4D, 0x356735,
    0x5E2F2F, 0x5E442F, 0x1C3838, 0x254B25,
    0x3D1D1D, 0x3D2B1D, 0x112525, 0x173117,
    0x541C1C, 0x54351C, 0x113232, 0x164316,
    0x601515, 0x603715, 0x0D3A3A, 0x114D11,
];

// We store settings into LocalStorage and last model into OPFS
const settingsKey = 'stl-web-viewer-settings';
const savedModelName = 'latest-model';

const canvas = document.getElementById('threejs') as HTMLCanvasElement;
if (!canvas) {
    throw new Error('Canvas element with id "threejs" not found');
}

const opfsRoot = await navigator.storage.getDirectory();
const savedModelHandle = await opfsRoot.getFileHandle(savedModelName, { create: true });

interface Settings {
    cameraIsPerspective: boolean,
    withLight: boolean,
    showWireframe: boolean,
    withColors: boolean,
    showNormals: boolean,
    showStats: boolean,
    latestModelName: string,
}
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
    boundingRadius: 0.0,
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
    basic: createBasicMaterial(modelColor),
    colored: createColoredMaterials(fancyColors),
    wireframe: new LineBasicMaterial({
        color: lineColor,
    }),
    positiveNormal: new LineBasicMaterial({
        color: positiveNormalColor,
    }),
    negativeNormal: new LineBasicMaterial({
        color: negativeNormalColor,
    }),
};

interface PreparedModel {
    meshes: Mesh[],
    wireframes: LineSegments[],
    normals: LineSegments[],
}
let curModel = createDefaultModel();

await loadSavedFile();

renderer.setAnimationLoop(animate);

function loadSettings(): Settings {
    const settings = {
        cameraIsPerspective: false,
        withLight: true,
        showWireframe: false,
        withColors: true,
        showNormals: false,
        showStats: false,
        latestModelName: '',
    };
    Object.assign(settings, JSON.parse(localStorage.getItem(settingsKey) ?? '{}'));
    return settings;
}

function saveSettings() {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function createGui(): GUI {
    const gui = new GUI({ title: 'No File' });

    gui.onChange((_) => saveSettings());

    const fileInput = document.getElementById('file-input');
    if (!fileInput) {
        throw new Error('Element with id "file-input" not found');
    }
    fileInput.addEventListener('change', (event: Event) => {
        const target = event.target as HTMLInputElement;
        if (target.files!.length > 0) {
            const file = target.files![0];

            const reader = new FileReader();
            reader.onload = async () => {
                await onLoadFile(file.name, reader.result as ArrayBuffer);
                await saveFile(file.name, reader.result as ArrayBuffer);
            };
            reader.onerror = () => console.log('File loading failed');
            reader.readAsArrayBuffer(file);
        }
    });

    gui.add((() => fileInput.click()) as CallableFunction, 'call')
        .name('Load File');

    const rFolder = gui.addFolder('Rendering');
    rFolder.add(settings, 'cameraIsPerspective')
        .name('Perspective camera')
        .onChange((perspective: boolean) => {
            curControls = createControls(perspective)
        });
    rFolder.add(settings, 'showWireframe')
        .name('Show wireframe')
        .onChange((_: boolean) => updateModelVisibility(curModel));
    rFolder.add(settings, 'withLight')
        .name('Enable light')
        .onChange((v: boolean) => directionalLight.visible = v);
    rFolder.add(settings, 'withColors')
        .name("Color parts")
        .onChange((_: boolean) => updateModelMaterials(curModel))
    rFolder.close();

    const miscFolder = gui.addFolder('Misc');
    miscFolder.add((() => unloadModel()) as CallableFunction, 'call')
        .name('Unload File');
    miscFolder.add(settings, 'showNormals')
        .name("Show normals")
        .onChange((_: boolean) => updateNormalsVisibility(curModel))
    miscFolder.add(settings, 'showStats')
        .name('Show stats')
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
    scene.add(new AmbientLight(lightColor, 1.5));

    const directionalLight = new DirectionalLight(lightColor, 2.0);
    directionalLight.position.set(100.0, 100.0, 100.0);
    scene.add(directionalLight);
    if (!settings.withLight) {
        directionalLight.visible = false;
    }
    return directionalLight;
}

function updateCanvasSize() {
    if (viewSize.width !== canvas.clientWidth || viewSize.height !== canvas.clientHeight) {
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

    console.log('Loading stored model', settings.latestModelName);
    const file = await savedModelHandle.getFile();
    const reader = new FileReader();
    reader.onload = () => onLoadFile(settings.latestModelName, reader.result as ArrayBuffer);
    reader.onerror = () => console.log('File loading failed');
    reader.readAsArrayBuffer(file);
}

async function saveFile(filename: string, contents: ArrayBuffer) {
    // Store the model name and contents to local storage.
    settings.latestModelName = filename;
    saveSettings();
    const writable = await savedModelHandle.createWritable();
    await writable.write(contents);
    await writable.close();
    console.log('Stored the contents to', savedModelHandle);
}

async function onLoadFile(filename: string, contents: ArrayBuffer) {
    console.log(`Loading file ${filename} with length ${contents.byteLength}`);
    setTitle(filename);

    disposeModel(curModel);
    const stlLoader = new STLLoader();
    curModel = createModelFromGeo(stlLoader.parse(contents));

    console.log(`Loaded file ${filename}`);
}

function createDefaultModel(): PreparedModel {
    if (settings.latestModelName !== '') {
        // We are called during start up and the model is being loaded right now.
        return createModelFromGeo(new BufferGeometry().setFromPoints([]));
    }
    const box1 = new BoxGeometry(0.25, 5, 1);
    const box2 = new BoxGeometry(0.25, 5, 1);
    box2.translate(10, 0, 0);
    const box3 = new BoxGeometry(10.25, 0.25, 1);
    box3.translate(5, 2.625, 0);
    const box4 = new BoxGeometry(10.25, 0.25, 1);
    box4.translate(5, -2.625, 0);
    const box5 = new BoxGeometry(9.75, 0.25, 1);
    box5.translate(5, 1, 0);
    const top = new CylinderGeometry(5.0, 6.0, 0.5, 120, 3);
    top.translate(5, 3.0, 0);
    const defaultGeo = BufferGeometryUtils.mergeGeometries([box1, box2, box3, box4, box5, top], false);
    defaultGeo.rotateY(1);
    defaultGeo.rotateZ(0.1);
    return createModelFromGeo(defaultGeo);
}

function createModelFromGeo(geo: BufferGeometry): PreparedModel {
    // Scale the geometry to ~ 10.0-1000.0 dimensions.
    geo.computeBoundingSphere();
    const modelCenter = geo.boundingSphere!.center;
    let modelRadius = geo.boundingSphere!.radius;
    if (modelRadius > modelMaxSize) {
        const scale = modelMaxSize / modelRadius;
        geo.scale(scale, scale, scale);
        modelRadius = modelMaxSize;
    } else if (modelRadius < modelMinSize) {
        const scale = modelMinSize / modelRadius;
        geo.scale(scale, scale, scale);
        modelRadius = modelMinSize;
    }

    const parts = splitDisjointGeometry(geo);
    const normals = prepareNormals(geo, modelRadius);
    geo.dispose();

    console.log(`Model got split into ${parts.length} parts`);
    const meshes: Mesh[] = [];
    const wireframes: LineSegments[] = [];
    for (const part of parts) {
        // The material will be set later.
        const mesh = new Mesh(part);
        meshes.push(mesh);
        scene.add(mesh);
        const edges = new EdgesGeometry(part, 10);
        const wireframe = new LineSegments(edges, materials.wireframe);
        wireframes.push(wireframe);
        scene.add(wireframe);
    }
    for (const normal of normals) {
        scene.add(normal);
    }

    const result: PreparedModel = {
        meshes: meshes,
        wireframes: wireframes,
        normals: normals,
    };

    updateModelVisibility(result);
    updateModelMaterials(result);
    updateNormalsVisibility(result);
    updateCameraForModel(modelCenter, modelRadius);
    return result;
}

function disposeModel(model: PreparedModel) {
    for (let i = 0; i < model.meshes.length; i++) {
        scene.remove(model.meshes[i]);
        model.meshes[i].geometry.dispose();
    }
    for (let i = 0; i < model.wireframes.length; i++) {
        scene.remove(model.wireframes[i]);
        model.wireframes[i].geometry.dispose();
    }
    for (let i = 0; i < model.normals.length; i++) {
        model.normals[i].geometry.dispose();
    }
}

function updateModelVisibility(model: PreparedModel) {
    for (let i = 0; i < model.meshes.length; i++) {
        model.meshes[i].visible = !settings.showWireframe;
    }
}

function updateModelMaterials(model: PreparedModel) {
    for (let i = 0; i < model.meshes.length; i++) {
        if (settings.withColors) {
            model.meshes[i].material = materials.colored[i % materials.colored.length];
        } else {
            model.meshes[i].material = materials.basic;
        }
    }
}

function updateNormalsVisibility(model: PreparedModel) {
    for (let i = 0; i < model.normals.length; i++) {
        model.normals[i].visible = settings.showNormals;
    }
}

function updateCameraForModel(modelCenter: Vector3, modelRadius: number) {
    console.log('Updating camera with center and radius', modelCenter, modelRadius);
    curControls.target.copy(modelCenter);
    perspCamera.position.copy(modelCenter);
    perspCamera.position.z += modelRadius * 2;
    orthoCamera.position.copy(modelCenter);
    // Store model size for ortho camera.
    viewSize.orthoCameraSize = modelRadius * 2;
    updateOrthoCameraDimensions();
    orthoCamera.position.z += modelRadius * 2;
    // curControls.panSpeed = modelRadius * 1.5;
    curControls.update();
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

function createColoredMaterials(colors: number[]): Material[] {
    const result: Material[] = [];
    for (let i = 0; i < colors.length; i++) {
        result.push(createBasicMaterial(colors[i]));
    }
    return result;
}

function createBasicMaterial(color: number) {
    return new MeshPhongMaterial({
        color: color,
        side: FrontSide,
        flatShading: false,
        // Offset polygons just a bit so that the lines do not z-fight with them. Replace lines with polygonal lines?
        polygonOffset: true,
        polygonOffsetFactor: 1.0,
        polygonOffsetUnits: 1.0,
    });
}

// Prepare both positive and negative normals for debugging visualization. Model radius is used to heuristically
// set the normal length.
function prepareNormals(geo: BufferGeometry, modelRadius: number): LineSegments[] {
    // TODO: Move to a separate split-geometry and add tests.
    if (geo.index != null) {
        geo = geo.toNonIndexed();
    }

    const positionAttr = geo.getAttribute('position');
    if (!positionAttr) {
        throw new Error('Geometry does not have position attribute');
    }
    if (!(positionAttr instanceof BufferAttribute)) {
        throw new Error('Interleaved buffer position attribute not supported');
    }
    const pos = positionAttr.array;
    const triCount = pos.length / 9;
    const points: Vector3[] = new Array(triCount * 2);
    const negativePoints: Vector3[] = new Array(triCount * 2);
    const v1 = new Vector3();
    const v2 = new Vector3();
    const v3 = new Vector3();
    const tmp = new Vector3();
    for (let triIdx = 0; triIdx < triCount; triIdx++) {
        const off = triIdx * 9;
        v1.set(pos[off], pos[off + 1], pos[off + 2]);
        v2.set(pos[off + 3], pos[off + 4], pos[off + 5]);
        v3.set(pos[off + 6], pos[off + 7], pos[off + 8]);
        const midpoint = v1.clone().add(v2).add(v3)
            .divideScalar(3.0);
        const normal = v2.clone().sub(v1)
            .cross(tmp.copy(v3).sub(v1))
            .setLength(modelRadius / 25.0);
        const negativeNormal = midpoint.clone().sub(normal);
        normal.add(midpoint);

        points[triIdx * 2] = midpoint;
        points[triIdx * 2 + 1] = normal;
        negativePoints[triIdx * 2] = midpoint;
        negativePoints[triIdx * 2 + 1] = negativeNormal;
    }
    return [
        new LineSegments(new BufferGeometry().setFromPoints(points), materials.positiveNormal),
        new LineSegments(new BufferGeometry().setFromPoints(negativePoints), materials.negativeNormal),
    ];
}
