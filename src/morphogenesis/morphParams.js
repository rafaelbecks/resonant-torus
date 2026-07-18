export const MORPH_SHAPES = [
  "torus",
  "torusknot",
  "chenGackstatter",
  "lopezros",
  "model",
];

export const SHAPE_LABELS = {
  torus: "torus",
  torusknot: "torus knot",
  chenGackstatter: "Chen–Gackstätter",
  lopezros: "López–Ros",
  model: "model",
};

export const morphParams = {
  shape: "torus",
  modelFile: "cosos/pututu",
  extent: 3,
  shapeSegments: 128,
  envelopeRadius: 1,
  torusTube: 0.35,
  torusKnotRadius: 1,
  torusKnotTube: 0.35,
  torusKnotTubularSegments: 512,
  torusKnotRadialSegments: 64,
  torusKnotP: 2,
  torusKnotQ: 3,
  minimalVSegments: 64,
  chenGackstatterRMin: 0.22,
  chenGackstatterRMax: 0.78,
  chenGackstatterStretchZ: 1,
  lopezRosSpan: 1.2,
  lopezRosDeform: 0.35,
  lopezRosTwist: 0,
  lopezRosMode: "catenoid",
  lopezRosStackCount: 3,
  lopezRosStackSpacing: 1.0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  side: "double",
  color: "#7dbeff",
  noiseEnabled: false,
  noiseAmplitude: 0.25,
  noiseScale: 1.5,
  noiseScaleModEnabled: false,
  noiseScaleModRate: 0.25,
  noiseScaleModAmount: 0.5,
  noiseSeed: 42,
  noiseOctaves: 3,
  noiseMorphSpeed: 3,
  animateNoise: true,
};

export const MORPH_PARAM_KEYS = Object.keys(morphParams);

export function clampMorphParams() {
  if (!MORPH_SHAPES.includes(morphParams.shape)) {
    morphParams.shape = MORPH_SHAPES[0];
  }
  morphParams.noiseOctaves = Math.max(1, Math.min(5, Math.round(morphParams.noiseOctaves)));
  morphParams.torusKnotP = Math.max(1, Math.round(morphParams.torusKnotP));
  morphParams.torusKnotQ = Math.max(1, Math.round(morphParams.torusKnotQ));
  morphParams.chenGackstatterRMin = Math.max(0.05, morphParams.chenGackstatterRMin);
  morphParams.chenGackstatterRMax = Math.min(
    0.95,
    Math.max(morphParams.chenGackstatterRMin + 0.05, morphParams.chenGackstatterRMax)
  );
  morphParams.chenGackstatterStretchZ = Math.max(0.2, morphParams.chenGackstatterStretchZ);
  if (!["catenoid", "stacked"].includes(morphParams.lopezRosMode)) {
    morphParams.lopezRosMode =
      morphParams.lopezRosMode === "stacked catenoids" ? "stacked" : "catenoid";
  }
  morphParams.lopezRosStackCount = Math.max(
    2,
    Math.min(7, Math.round(morphParams.lopezRosStackCount))
  );
  morphParams.lopezRosStackSpacing = Math.max(0.35, morphParams.lopezRosStackSpacing);
}
