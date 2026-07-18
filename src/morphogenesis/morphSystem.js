import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { morphParams } from "./morphParams.js";
import { createMorphGeometry, getMorphSide } from "./morphGeometries.js";
import {
  applyNoiseDeform,
  captureBaseGeometry,
} from "./noiseDeform.js";

const EXPORT_PARAM_KEYS = [
  "shape",
  "extent",
  "shapeSegments",
  "envelopeRadius",
  "torusTube",
  "torusKnotRadius",
  "torusKnotTube",
  "torusKnotTubularSegments",
  "torusKnotRadialSegments",
  "torusKnotP",
  "torusKnotQ",
  "minimalVSegments",
  "chenGackstatterRMin",
  "chenGackstatterRMax",
  "chenGackstatterStretchZ",
  "lopezRosSpan",
  "lopezRosDeform",
  "lopezRosTwist",
  "lopezRosMode",
  "lopezRosStackCount",
  "lopezRosStackSpacing",
  "modelFile",
  "noiseAmplitude",
  "noiseScale",
  "noiseSeed",
  "noiseOctaves",
  "rotationX",
  "rotationY",
  "rotationZ",
  "side",
];

function geometryConfigKey() {
  return EXPORT_PARAM_KEYS.map((k) => morphParams[k]).join("|");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function createGlbLoader() {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
  );
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  return loader;
}

function extractFirstMeshGeometry(root) {
  let source = null;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isMesh && o.geometry && !source) source = o;
  });
  if (!source) return null;

  const geometry = source.geometry.clone();
  geometry.applyMatrix4(source.matrixWorld);
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function fitModelGeometry(geometry, extent, envelopeRadius) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);

  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const target = Math.max(0.5, extent) * Math.max(0.3, envelopeRadius);
  const scale = target / maxDim;
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createMorphSystem({ scene, params: viewerParams }) {
  let mesh = null;
  let builtKey = null;
  let noiseMix = 0;
  let elapsed = 0;
  let loadId = 0;
  const glbLoader = createGlbLoader();
  const geometryCache = new Map();

  function createMaterial() {
    return new THREE.MeshStandardMaterial({
      color: morphParams.color,
      roughness: viewerParams.roughness,
      metalness: viewerParams.metalness,
      side: getMorphSide(morphParams.side),
      wireframe: viewerParams.wireframe,
    });
  }

  function assignGeometry(geometry) {
    if (mesh) {
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      mesh.material.side = getMorphSide(morphParams.side);
      mesh.material.needsUpdate = true;
    } else {
      mesh = new THREE.Mesh(geometry, createMaterial());
      scene.add(mesh);
    }

    captureBaseGeometry(mesh.geometry);
    applyNoiseDeform(mesh.geometry, morphParams, noiseMix, elapsed);
    updateTransform();
  }

  function loadModelGeometry(modelFile) {
    const cached = geometryCache.get(modelFile);
    if (cached) {
      return Promise.resolve(
        fitModelGeometry(
          cached.clone(),
          morphParams.extent,
          morphParams.envelopeRadius
        )
      );
    }

    return new Promise((resolve, reject) => {
      glbLoader.load(
        `./glb/${modelFile}.glb`,
        (gltf) => {
          const extracted = extractFirstMeshGeometry(gltf.scene);
          if (!extracted) {
            reject(new Error(`No mesh in ${modelFile}.glb`));
            return;
          }
          geometryCache.set(modelFile, extracted);
          resolve(
            fitModelGeometry(
              extracted.clone(),
              morphParams.extent,
              morphParams.envelopeRadius
            )
          );
        },
        undefined,
        reject
      );
    });
  }

  async function rebuildGeometry(force = false) {
    const key = geometryConfigKey();
    if (!force && mesh && builtKey === key) return;

    if (morphParams.shape === "model") {
      const id = ++loadId;
      const modelFile = morphParams.modelFile || "cosos/pututu";
      try {
        const geometry = await loadModelGeometry(modelFile);
        if (id !== loadId) return;
        assignGeometry(geometry);
        builtKey = key;
      } catch (err) {
        if (id !== loadId) return;
        console.error("[morph] failed to load model", modelFile, err);
      }
      return;
    }

    const geometry = createMorphGeometry(morphParams.shape, morphParams.extent, morphParams);
    assignGeometry(geometry);
    builtKey = key;
  }

  function updateTransform() {
    if (!mesh) return;
    mesh.rotation.set(
      morphParams.rotationX,
      morphParams.rotationY,
      morphParams.rotationZ
    );
    mesh.position.set(0, 0, 0);
  }

  function disposeMesh() {
    if (!mesh) return;
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    mesh = null;
    builtKey = null;
  }

  async function sync() {
    await rebuildGeometry();
    if (mesh) {
      mesh.material.color.set(morphParams.color);
      mesh.material.roughness = viewerParams.roughness;
      mesh.material.metalness = viewerParams.metalness;
      mesh.material.wireframe = viewerParams.wireframe;
      mesh.visible = true;

      noiseMix = morphParams.noiseEnabled ? 1 : 0;
      applyNoiseDeform(
        mesh.geometry,
        morphParams,
        noiseMix,
        morphParams.animateNoise ? elapsed : 0
      );
    }
    updateTransform();
  }

  function updateNoise(delta) {
    if (!mesh) return;
    elapsed += delta;

    if (!mesh.geometry.userData.basePosition) {
      captureBaseGeometry(mesh.geometry);
    }

    const target = morphParams.noiseEnabled ? 1 : 0;
    noiseMix = THREE.MathUtils.damp(
      noiseMix,
      target,
      morphParams.noiseMorphSpeed,
      delta
    );

    const time = morphParams.animateNoise ? elapsed : 0;
    applyNoiseDeform(mesh.geometry, morphParams, noiseMix, time);
  }

  function getAnalysisMesh() {
    return mesh;
  }

  function getNoiseMix() {
    return noiseMix;
  }

  function snapNoiseMix(value) {
    noiseMix = value;
    if (!mesh) return;
    if (!mesh.geometry.userData.basePosition) captureBaseGeometry(mesh.geometry);
    applyNoiseDeform(mesh.geometry, morphParams, noiseMix, elapsed);
  }

  async function exportMorph() {
    if (!mesh) return { ok: false, reason: "No morphogenesis mesh." };

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const baseName =
      morphParams.shape === "model"
        ? `${(morphParams.modelFile || "model").replace(/\//g, "-")}-noise-${stamp}`
        : `${morphParams.shape}-noise-${stamp}`;
    const config = {
      version: 1,
      type: "morphogenesis",
      noiseMix,
      params: Object.fromEntries(EXPORT_PARAM_KEYS.map((k) => [k, morphParams[k]])),
    };

    downloadBlob(
      new Blob([JSON.stringify(config, null, 2)], { type: "application/json" }),
      `${baseName}.json`
    );

    const exportMesh = mesh.clone();
    exportMesh.updateMatrixWorld(true);
    exportMesh.geometry = mesh.geometry.clone();
    exportMesh.geometry.applyMatrix4(exportMesh.matrixWorld);
    exportMesh.position.set(0, 0, 0);
    exportMesh.rotation.set(0, 0, 0);
    exportMesh.scale.set(1, 1, 1);

    const glb = await new Promise((resolve, reject) => {
      new GLTFExporter().parse(
        exportMesh,
        (result) => {
          if (result instanceof ArrayBuffer) resolve(result);
          else reject(new Error("Expected binary GLB"));
        },
        reject,
        { binary: true }
      );
    });

    exportMesh.geometry.dispose();
    downloadBlob(new Blob([glb], { type: "model/gltf-binary" }), `${baseName}.glb`);
    return { ok: true, baseName };
  }

  return {
    sync,
    update: updateNoise,
    dispose: disposeMesh,
    getAnalysisMesh,
    getNoiseMix,
    snapNoiseMix,
    exportMorph,
    isActive: () => !!mesh,
  };
}
