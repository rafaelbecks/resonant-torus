import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { CAMERA_INTRO, params } from "./config.js";
import { isNoModel } from "./modelUtils.js";

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function disposeModel(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((mat) => {
      for (const key in mat) {
        const value = mat[key];
        if (value && value.isTexture) value.dispose();
      }
      mat.dispose();
    });
  });
}

function applyWireframe(model, enabled) {
  if (!model) return;
  model.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    materials.forEach((mat) => {
      mat.wireframe = enabled;
      mat.needsUpdate = true;
    });
  });
}

export function createModelLoader({ scene, camera, controls, onModelLoaded, loading }) {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
  );

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  let currentModel = null;
  let loadId = 0;
  let introAnimation = null;

  function frameCamera(size) {
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let framedY = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    framedY *= 1.6;
    controls.target.set(0, 0, 0);
    controls.maxDistance = framedY * 8;
    controls.update();
    return framedY;
  }

  function startIntroAnimation(framedY) {
    const startY = CAMERA_INTRO.startY ?? framedY;
    const endY = CAMERA_INTRO.endY;
    const startZ = CAMERA_INTRO.startZ ?? framedY * 0.5;
    const endZ = CAMERA_INTRO.endZ ?? framedY * 0.35;
    camera.position.set(0, startY, startZ);
    camera.lookAt(0, 0, 0);
    introAnimation = {
      startY,
      endY,
      startZ,
      endZ,
      createdAt: performance.now(),
      delay: CAMERA_INTRO.delay * 1000,
      duration: CAMERA_INTRO.duration * 1000,
    };
  }

  function loadModel(name, { silent = false, skipIntro = false } = {}) {
    const id = ++loadId;

    if (isNoModel(name)) {
      return new Promise((resolve) => {
        if (!silent) loading?.begin("model");

        if (currentModel) {
          scene.remove(currentModel);
          disposeModel(currentModel);
          currentModel = null;
        }

        introAnimation = null;
        onModelLoaded?.(null);

        if (!silent) loading?.end("model");
        resolve(null);
      });
    }

    return new Promise((resolve, reject) => {
      if (!silent) loading?.begin("model");

      loader.load(
        `./glb/${name}.glb`,
        (gltf) => {
          if (id !== loadId) {
            if (!silent) loading?.end("model");
            resolve(null);
            return;
          }

          if (currentModel) {
            scene.remove(currentModel);
            disposeModel(currentModel);
            currentModel = null;
          }

          const model = gltf.scene;
          currentModel = model;
          scene.add(model);

          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          model.position.sub(center);

          model.traverse((o) => {
            if (o.isMesh && o.material) {
              o.material.envMapIntensity = 1;
              o.material.needsUpdate = true;
            }
          });

          applyWireframe(model, params.wireframe);
          onModelLoaded?.(model);
          const framedY = frameCamera(size);
          if (!skipIntro) startIntroAnimation(framedY);

          if (!silent) loading?.end("model");
          resolve(model);
        },
        (xhr) => {
          if (!silent && xhr.total) loading?.setProgress(xhr.loaded / xhr.total);
        },
        (err) => {
          if (id === loadId && !silent) loading?.end("model");
          console.error(err);
          reject(err);
        }
      );
    });
  }

  function updateIntro() {
    if (!introAnimation) return;
    const { startY, endY, startZ, endZ, createdAt, delay, duration } = introAnimation;
    const elapsed = performance.now() - createdAt;

    if (elapsed < delay) {
      camera.position.set(0, startY, startZ);
      camera.lookAt(0, 0, 0);
      return;
    }

    const t = Math.min(1, (elapsed - delay) / duration);
    const eased = easeOutCubic(t);
    camera.position.set(
      0,
      startY + (endY - startY) * eased,
      startZ + (endZ - startZ) * eased
    );
    camera.lookAt(0, 0, 0);
    if (t >= 1) introAnimation = null;
  }

  function setWireframe(enabled) {
    params.wireframe = enabled;
    applyWireframe(currentModel, enabled);
  }

  function setRoughness(value) {
    if (!currentModel) return;
    currentModel.traverse((o) => {
      if (o.isMesh && o.material && o.material.roughness !== undefined) {
        o.material.roughness = value;
      }
    });
  }

  function getModelBounds() {
    if (!currentModel) return null;
    const box = new THREE.Box3().setFromObject(currentModel);
    return { size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()) };
  }

  function getAnalysisMesh() {
    if (!currentModel) return null;
    let mesh = null;
    currentModel.traverse((o) => {
      if (o.isMesh && !mesh) mesh = o;
    });
    return mesh;
  }

  function cancelIntro() {
    introAnimation = null;
  }

  return {
    loadModel,
    updateIntro,
    cancelIntro,
    setWireframe,
    setRoughness,
    getCurrentModel: () => currentModel,
    getModelBounds,
    getAnalysisMesh,
  };
}
