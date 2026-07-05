import * as THREE from "three";
import { triangleLfo } from "../math/lfo.js";
import { createPerlin3D, sampleFbm3 } from "../math/perlin.js";

const _point = new THREE.Vector3();
const noiseCache = new Map();

function getNoise3d(seed) {
  const key = Math.floor(seed);
  if (!noiseCache.has(key)) noiseCache.set(key, createPerlin3D(key));
  return noiseCache.get(key);
}

export function captureBaseGeometry(geometry) {
  const position = geometry.attributes.position;
  geometry.userData.basePosition = new Float32Array(position.array);
  geometry.computeVertexNormals();
  geometry.userData.baseNormal = new Float32Array(geometry.attributes.normal.array);
}

function getNoiseScale(params, timeSeconds) {
  const base = params.noiseScale;
  if (!params.noiseScaleModEnabled) return base;
  const amount = params.noiseScaleModAmount;
  const min = Math.max(0.1, base - amount);
  const max = base + amount;
  return triangleLfo(timeSeconds, params.noiseScaleModRate, min, max);
}

export function applyNoiseDeform(geometry, params, mix, timeSeconds = 0) {
  const basePos = geometry.userData.basePosition;
  const baseNorm = geometry.userData.baseNormal;
  if (!basePos || !baseNorm) return;

  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;

  if (mix <= 0.0001) {
    position.array.set(basePos);
    normal.array.set(baseNorm);
    position.needsUpdate = true;
    normal.needsUpdate = true;
    return;
  }

  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const displacementScale = geometry.boundingSphere.radius * params.noiseAmplitude;

  const noise3d = getNoise3d(params.noiseSeed);
  const freq = getNoiseScale(params, timeSeconds) * 0.08;
  const octaves = Math.max(1, Math.floor(params.noiseOctaves));

  for (let i = 0; i < position.count; i++) {
    const i3 = i * 3;
    _point.set(basePos[i3], basePos[i3 + 1], basePos[i3 + 2]);

    const n = sampleFbm3(noise3d, _point.x * freq, _point.y * freq, _point.z * freq, octaves);
    const offset = n * displacementScale * mix;

    position.array[i3] = basePos[i3] + baseNorm[i3] * offset;
    position.array[i3 + 1] = basePos[i3 + 1] + baseNorm[i3 + 1] * offset;
    position.array[i3 + 2] = basePos[i3 + 2] + baseNorm[i3 + 2] * offset;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
}
