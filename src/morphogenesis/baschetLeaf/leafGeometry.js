import {
  DEFAULT_LEAF_OUTLINE,
  leafHalfWidth,
  leafHeightAt,
  outlineCentroid,
  sampleLeafOutline,
} from "./leafOutline.js";
import { buildParametricMesh } from "../parametricMesh.js";

/**
 * Shallow cone / V-fold depth along the central spine.
 * u ∈ [-1, 1] across the sheet; tips taper so points stay sharp.
 */
export function leafFoldZ(u, v, params = {}) {
  const p = { ...DEFAULT_LEAF_OUTLINE, ...params };
  const foldDepth = p.foldDepth ?? 0;
  if (Math.abs(foldDepth) < 1e-8) return 0;

  const power = Math.max(0.2, p.foldPower ?? 1.15);
  const across = Math.min(1, Math.abs(u));
  // Spine forward (z≈0), edges curve back — soft cone / wing section
  const wing = across ** power;
  // Fade fold at top & bottom tips
  const tipTaper = Math.sin(Math.PI * Math.min(1, Math.max(0, v)));
  return -foldDepth * p.radius * wing * tipTaper;
}

/**
 * Interior surface point: u ∈ [-1, 1] across width, v ∈ [0, 1] bottom→top.
 */
export function leafSurfacePoint(u, v, params = {}) {
  const p = { ...DEFAULT_LEAF_OUTLINE, ...params };
  const y = leafHeightAt(v, p);
  const halfW = leafHalfWidth(v, p);
  const side = u >= 0 ? 1 : -1;
  const asym = side >= 0 ? 1 + p.asymmetry : 1 - p.asymmetry;

  let x = u * halfW * asym;
  x += p.skew * (y / Math.max(1e-6, p.radius * p.heightScale));
  const z = leafFoldZ(u, v, p);

  return { x, y, z };
}

/**
 * Build a centered 3D leaf sheet: almond outline + nuanced cone fold.
 * Still based on the 2D outline; fold is a Z displacement toward the edges.
 */
export function generateLeafGeometry(params = {}) {
  const p = { ...DEFAULT_LEAF_OUTLINE, ...params };
  const resolution = Math.max(8, Math.floor(p.resolution));
  const vSeg = resolution;
  const uSeg = Math.max(8, Math.floor(resolution * 0.5));

  const geometry = buildParametricMesh({
    uSegments: uSeg,
    vSegments: vSeg,
    uMin: -1,
    uMax: 1,
    vMin: 0,
    vMax: 1,
    evaluate: (u, v) => leafSurfacePoint(u, v, p),
  });

  const outline = sampleLeafOutline(p);
  const centroid = outlineCentroid(outline);
  geometry.translate(-centroid.x, -centroid.y, 0);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
