import * as THREE from "three";

/**
 * Build a indexed parametric mesh with UV.u as the ring parameter for chamber analysis.
 */
export function buildParametricMesh({
  evaluate,
  uSegments,
  vSegments,
  uMin,
  uMax,
  vMin,
  vMax,
  shouldSkipVertex = () => false,
}) {
  const uCount = uSegments + 1;
  const vCount = vSegments + 1;
  const positions = [];
  const uvs = [];
  const valid = [];

  for (let j = 0; j < vCount; j++) {
    const v = vMin + (j / vSegments) * (vMax - vMin);
    for (let i = 0; i < uCount; i++) {
      const u = uMin + (i / uSegments) * (uMax - uMin);
      const point = evaluate(u, v);
      const skip = !point || shouldSkipVertex(u, v, point);
      valid.push(!skip);
      if (skip) {
        positions.push(0, 0, 0);
      } else {
        positions.push(point.x, point.y, point.z);
      }
      uvs.push(i / uSegments, j / vSegments);
    }
  }

  const indices = [];
  for (let j = 0; j < vSegments; j++) {
    for (let i = 0; i < uSegments; i++) {
      const a = j * uCount + i;
      const b = a + 1;
      const c = a + uCount;
      const d = c + 1;
      if (!valid[a] || !valid[b] || !valid[c] || !valid[d]) continue;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Merge multiple indexed parametric meshes into one BufferGeometry. */
export function mergeParametricMeshes(geometries) {
  const merged = new THREE.BufferGeometry();
  const positions = [];
  const uvs = [];
  const indices = [];
  let vertexOffset = 0;

  for (const geometry of geometries) {
    const pos = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    const index = geometry.getIndex();
    if (!pos || !index) continue;

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }

    for (let i = 0; i < index.count; i++) {
      indices.push(index.array[i] + vertexOffset);
    }

    vertexOffset += pos.count;
    geometry.dispose();
  }

  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (uvs.length) merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}
