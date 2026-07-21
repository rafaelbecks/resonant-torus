import { generateLeafGeometry } from "./leafGeometry.js";

/**
 * Regenerate leaf geometry and swap it onto an existing mesh.
 * Morphogenesis uses morphSystem.sync() instead; this helper keeps the
 * outline → geometry → mesh pipeline easy to call from experiments.
 */
export function updateLeafMesh(mesh, params = {}) {
  if (!mesh) return null;

  const geometry = generateLeafGeometry(params);
  if (mesh.geometry) mesh.geometry.dispose();
  mesh.geometry = geometry;
  return mesh;
}
