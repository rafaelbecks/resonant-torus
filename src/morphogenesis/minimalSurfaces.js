import * as C from "../math/complex.js";
import { LEMNISCATIC_G2, weierstrassP, weierstrassZeta } from "../math/weierstrass.js";
import { buildParametricMesh } from "./parametricMesh.js";

const G2 = LEMNISCATIC_G2;
const SQRT_6PI_G2 = Math.sqrt((6 * Math.PI) / G2);

function minimalScale(extent, params) {
  return extent * params.envelopeRadius * 0.22;
}

function isBad(n) {
  return !Number.isFinite(n) || Math.abs(n) > 50;
}

/**
 * Genus-one Chen–Gackstätter surface (Enneper with a handle).
 */
export function createChenGackstatterGeometry(extent, params) {
  const scale = minimalScale(extent, params);
  const stretchZ = params.chenGackstatterStretchZ ?? 1;
  const uSeg = Math.max(24, Math.floor(params.shapeSegments));
  const vSeg = Math.max(16, Math.floor(params.minimalVSegments ?? params.shapeSegments * 0.5));
  const rMin = params.chenGackstatterRMin ?? 0.22;
  const rMax = params.chenGackstatterRMax ?? 0.78;

  return buildParametricMesh({
    uSegments: uSeg,
    vSegments: vSeg,
    uMin: -Math.PI,
    uMax: Math.PI,
    vMin: rMin,
    vMax: rMax,
    evaluate: (theta, r) => evaluateChenGackstatter(theta, r, scale, stretchZ),
    shouldSkipVertex: (_t, _r, p) => !p,
  });
}

function evaluateChenGackstatter(theta, r, scale, stretchZ) {
  const w = C.c(r * Math.cos(theta), r * Math.sin(theta));
  const wp = weierstrassP(w, G2, 0, 10);
  const wpp = weierstrassPPrime(w, G2, 0, 10);
  const zeta = weierstrassZeta(w, G2, 0, 10);

  if (!Number.isFinite(wp.re) || C.cAbs(wpp) < 1e-7) return null;

  const wppTerm = C.cScale(wpp, -Math.PI / G2);
  const xC = C.cSub(C.cSub(C.cScale(w, Math.PI), zeta), wppTerm);
  const yC = C.cAdd(C.cAdd(C.cScale(w, Math.PI), zeta), wppTerm);

  const x = xC.re * scale;
  const y = yC.im * scale;
  const z = SQRT_6PI_G2 * wp.re * scale * stretchZ;

  if (isBad(x) || isBad(y) || isBad(z)) return null;
  return { x, y, z };
}

function weierstrassPPrime(z, g2, g3, terms) {
  const h = 1e-5;
  const p1 = weierstrassP(C.c(z.re + h, z.im), g2, g3, terms);
  const p0 = weierstrassP(z, g2, g3, terms);
  return C.cScale(C.cSub(p1, p0), 1 / h);
}

/**
 * López–Ros deformation of the catenoid (single or stacked).
 */
export function createLopezRosGeometry(extent, params) {
  const mode = params.lopezRosMode ?? "catenoid";
  if (mode === "stacked") {
    return createStackedCatenoidsGeometry(extent, params);
  }
  return createSingleLopezRosGeometry(extent, params);
}

function createSingleLopezRosGeometry(extent, params) {
  const scale = minimalScale(extent, params);
  const uSeg = Math.max(24, Math.floor(params.shapeSegments));
  const vSeg = Math.max(12, Math.floor(params.minimalVSegments ?? params.shapeSegments * 0.4));
  const span = params.lopezRosSpan ?? 1.2;
  const s = params.lopezRosDeform ?? 0.35;
  const t = params.lopezRosTwist ?? 0;

  const geometry = buildParametricMesh({
    uSegments: uSeg,
    vSegments: vSeg,
    uMin: 0,
    uMax: Math.PI * 2,
    vMin: -span,
    vMax: span,
    evaluate: (u, v) => evaluateLopezRos(u, v, scale, s, t),
  });

  attachLopezRosAcousticLayout(geometry, {
    mode: "catenoid",
    segments: [
      { kind: "bell", a0: 0, a1: 0.42 },
      { kind: "neck", a0: 0.42, a1: 0.58 },
      { kind: "bell", a0: 0.58, a1: 1 },
    ],
    axialLength: 2 * span * scale,
  });

  return geometry;
}

function createStackedCatenoidsGeometry(extent, params) {
  const scale = minimalScale(extent, params);
  const uSeg = Math.max(24, Math.floor(params.shapeSegments));
  const axialSeg = Math.max(32, Math.floor((params.minimalVSegments ?? params.shapeSegments) * 1.2));
  const span = params.lopezRosSpan ?? 1.2;
  const s = params.lopezRosDeform ?? 0.35;
  const t = params.lopezRosTwist ?? 0;
  const bellCount = Math.max(2, Math.min(7, Math.round(params.lopezRosStackCount ?? 3)));
  const spacing = params.lopezRosStackSpacing ?? 1.0;
  const connectorSpan = span * spacing;
  const layout = buildOrganismLayout(bellCount, span, connectorSpan);

  const geometry = buildParametricMesh({
    uSegments: uSeg,
    vSegments: axialSeg,
    uMin: 0,
    uMax: Math.PI * 2,
    vMin: 0,
    vMax: 1,
    evaluate: (u, w) => {
      const axial = w * layout.total;
      const catV = axialToCatenoidV(axial, layout.segments, span);
      const p = evaluateLopezRos(u, catV, scale, s, t);
      if (!p) return null;
      return {
        x: p.x,
        y: p.y,
        z: (axial - layout.total * 0.5) * scale,
      };
    },
  });

  attachLopezRosAcousticLayout(geometry, {
    mode: "stacked",
    segments: layout.segments.map((seg) => ({
      kind: seg.kind === "connector" ? "neck" : "bell",
      a0: seg.a0 / layout.total,
      a1: seg.a1 / layout.total,
    })),
    axialLength: layout.total * scale,
  });

  return geometry;
}

/** Bell (v: span→0) then connector neck (v: 0→connectorSpan), repeated — continuous catenoid v. */
function buildOrganismLayout(bellCount, span, connectorSpan) {
  const segments = [];
  let axial = 0;

  for (let i = 0; i < bellCount; i++) {
    const a0 = axial;
    axial += span;
    segments.push({ kind: "bell", a0, a1: axial, span });

    if (i < bellCount - 1) {
      const c0 = axial;
      axial += connectorSpan;
      segments.push({ kind: "connector", a0: c0, a1: axial, connectorSpan });
    }
  }

  return { segments, total: axial };
}

function axialToCatenoidV(axial, segments, span) {
  const clamped = Math.max(0, Math.min(segments[segments.length - 1].a1, axial));

  for (const seg of segments) {
    if (clamped < seg.a1 || seg === segments[segments.length - 1]) {
      const local = clamped - seg.a0;
      if (seg.kind === "bell") {
        return seg.span - local;
      }
      return local;
    }
  }

  return span;
}

function attachLopezRosAcousticLayout(geometry, { mode, segments, axialLength }) {
  geometry.userData.acousticLayout = {
    kind: "lopezRos",
    mode,
    linearChain: true,
    axialLength,
    segments,
  };
}

function evaluateLopezRos(u, v, scale, s, t) {
  const cu = Math.cos(u);
  const su = Math.sin(u);
  const cv = Math.cosh(v);
  const sv = Math.sinh(v);
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const cs = Math.cosh(s);
  const ss = Math.sinh(s);

  const f1 = cu * cv;
  const f2 = su * cv;
  const f3 = v;
  const f1s = su * sv;
  const f2s = -cu * sv;

  const a = f1 * cs - f2s * ss;
  const b = f2 * cs + f1s * ss;
  const x = (ct * a - st * b) * scale;
  const y = (st * a + ct * b) * scale;
  const z = f3 * scale;

  if (isBad(x) || isBad(y) || isBad(z)) return null;
  return { x, y, z };
}

export const MINIMAL_SHAPES = ["chenGackstatter", "lopezros"];
