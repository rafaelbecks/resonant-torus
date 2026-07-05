import { morphParams, MORPH_SHAPES } from "./morphParams.js";

const SHAPE_OPTIONS = Object.fromEntries(MORPH_SHAPES.map((s) => [s, s]));
const SIDE_OPTIONS = { outside: "outside", inside: "inside", double: "double" };

function bind(folder, obj, key, opts, onChange) {
  const input = folder.addBinding(obj, key, opts);
  input.on("change", () => onChange?.());
  return input;
}

export function setupMorphUI(pane, morphSystem, onChange) {
  const folder = pane.addFolder({ title: "Morphogenesis", expanded: true });

  bind(folder, morphParams, "shape", { label: "shape", options: SHAPE_OPTIONS }, onChange);

  bind(folder, morphParams, "extent", { label: "extent", min: 0.5, max: 10, step: 0.1 }, onChange);

  bind(
    folder,
    morphParams,
    "shapeSegments",
    { label: "segments", min: 16, max: 256, step: 1 },
    onChange
  );

  bind(
    folder,
    morphParams,
    "envelopeRadius",
    { label: "radius scale", min: 0.3, max: 3, step: 0.05 },
    onChange
  );

  const torusFolder = folder.addFolder({ title: "Torus", expanded: true });
  bind(
    torusFolder,
    morphParams,
    "torusTube",
    { label: "tube", min: 0.05, max: 0.8, step: 0.01 },
    onChange
  );

  const knotFolder = folder.addFolder({ title: "Torus knot", expanded: false });
  bind(
    knotFolder,
    morphParams,
    "torusKnotRadius",
    { label: "radius", min: 0.2, max: 2, step: 0.05 },
    onChange
  );
  bind(
    knotFolder,
    morphParams,
    "torusKnotTube",
    { label: "tube", min: 0.05, max: 0.8, step: 0.01 },
    onChange
  );
  bind(
    knotFolder,
    morphParams,
    "torusKnotTubularSegments",
    { label: "tubular segs", min: 16, max: 512, step: 1 },
    onChange
  );
  bind(
    knotFolder,
    morphParams,
    "torusKnotRadialSegments",
    { label: "radial segs", min: 4, max: 64, step: 1 },
    onChange
  );
  bind(knotFolder, morphParams, "torusKnotP", { label: "p", min: 1, max: 12, step: 1 }, onChange);
  bind(knotFolder, morphParams, "torusKnotQ", { label: "q", min: 1, max: 12, step: 1 }, onChange);

  const rotFolder = folder.addFolder({ title: "Rotation", expanded: false });
  bind(
    rotFolder,
    morphParams,
    "rotationX",
    { label: "X", min: -Math.PI, max: Math.PI, step: 0.01 },
    onChange
  );
  bind(
    rotFolder,
    morphParams,
    "rotationY",
    { label: "Y", min: -Math.PI, max: Math.PI, step: 0.01 },
    onChange
  );
  bind(
    rotFolder,
    morphParams,
    "rotationZ",
    { label: "Z", min: -Math.PI, max: Math.PI, step: 0.01 },
    onChange
  );

  bind(folder, morphParams, "side", { label: "side", options: SIDE_OPTIONS }, onChange);
  bind(folder, morphParams, "color", { label: "color" }, onChange);

  const noiseFolder = folder.addFolder({ title: "Noise deformation", expanded: true });
  bind(noiseFolder, morphParams, "noiseEnabled", { label: "enabled" }, onChange);
  bind(
    noiseFolder,
    morphParams,
    "noiseAmplitude",
    { label: "amplitude", min: 0, max: 1, step: 0.01 },
    onChange
  );
  bind(
    noiseFolder,
    morphParams,
    "noiseScale",
    { label: "frequency", min: 0.1, max: 5, step: 0.05 },
    onChange
  );
  bind(noiseFolder, morphParams, "noiseSeed", { label: "seed", min: 0, max: 9999, step: 1 }, onChange);
  bind(noiseFolder, morphParams, "noiseOctaves", { label: "octaves", min: 1, max: 5, step: 1 }, onChange);
  bind(
    noiseFolder,
    morphParams,
    "noiseMorphSpeed",
    { label: "morph speed", min: 0.5, max: 10, step: 0.1 },
    onChange
  );
  bind(noiseFolder, morphParams, "animateNoise", { label: "animate freq" }, onChange);

  const modFolder = noiseFolder.addFolder({ title: "Frequency LFO", expanded: false });
  bind(modFolder, morphParams, "noiseScaleModEnabled", { label: "enabled" }, onChange);
  bind(
    modFolder,
    morphParams,
    "noiseScaleModRate",
    { label: "rate Hz", min: 0.01, max: 2, step: 0.01 },
    onChange
  );
  bind(
    modFolder,
    morphParams,
    "noiseScaleModAmount",
    { label: "depth", min: 0, max: 2, step: 0.05 },
    onChange
  );

  folder.addButton({ title: "Export GLB + JSON" }).on("click", () => {
    morphSystem.exportMorph();
  });
}
