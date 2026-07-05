export const MORPH_SHAPES = ["torus", "torusknot"];

export const morphParams = {
  shape: "torus",
  extent: 3,
  shapeSegments: 128,
  envelopeRadius: 1,
  torusTube: 0.35,
  torusKnotRadius: 1,
  torusKnotTube: 0.35,
  torusKnotTubularSegments: 128,
  torusKnotRadialSegments: 16,
  torusKnotP: 2,
  torusKnotQ: 3,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  side: "double",
  color: "#8a9aaa",
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
}
