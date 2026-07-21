import { morphParams, SHAPE_LABELS, MORPH_SHAPES } from "./morphParams.js";
import { MINIMAL_SHAPES } from "./minimalSurfaces.js";
import { loadModelCatalog, modelsToOptions } from "./modelCatalog.js";

const SIDE_OPTIONS = { outside: "outside", inside: "inside", double: "double" };

const SHAPE_OPTIONS = Object.fromEntries(
  MORPH_SHAPES.map((id) => [SHAPE_LABELS[id] ?? id, id])
);

const LOPEZ_ROS_MODE_OPTIONS = {
  catenoid: "catenoid",
  "stacked catenoids": "stacked",
};

const GIELIS_FAMILY_OPTIONS = {
  superellipse: "superellipse",
  superrose: "superrose",
  superspiral: "superspiral",
};

const GIELIS_PHI_MODE_OPTIONS = {
  "latitude (−π/2…π/2)": "latitude",
  "full period": "full",
};

function bind(folder, obj, key, opts, onChange) {
  const input = folder.addBinding(obj, key, opts);
  input.on("change", () => onChange?.());
  return input;
}

function isMinimalShape(shape) {
  return MINIMAL_SHAPES.includes(shape);
}

export async function setupMorphUI(container, morphSystem, onChange) {
  const folder = container;
  const models = await loadModelCatalog();
  const modelOptions = modelsToOptions(models);

  if (!models.includes(morphParams.modelFile)) {
    morphParams.modelFile = models[0];
  }

  const shapeFolders = {};
  let modelInput = null;
  let segmentsInput = null;

  function syncShapeFolders() {
    const shape = morphParams.shape;
    const isModel = shape === "model";
    shapeFolders.torus.hidden = shape !== "torus";
    shapeFolders.knot.hidden = shape !== "torusknot";
    shapeFolders.minimal.hidden = !isMinimalShape(shape);
    shapeFolders.chen.hidden = shape !== "chenGackstatter";
    shapeFolders.lopez.hidden = shape !== "lopezros";
    shapeFolders.gielis.hidden = shape !== "gielis";
    const stacked = morphParams.lopezRosMode === "stacked";
    shapeFolders.lopezStackCount.hidden = !stacked;
    shapeFolders.lopezStackSpacing.hidden = !stacked;
    if (modelInput) modelInput.hidden = !isModel;
    if (segmentsInput) segmentsInput.hidden = isModel;
  }

  const shapeInput = folder.addBinding(morphParams, "shape", {
    label: "shape",
    options: SHAPE_OPTIONS,
  });
  shapeInput.on("change", () => {
    syncShapeFolders();
    onChange?.();
  });

  modelInput = folder.addBinding(morphParams, "modelFile", {
    label: "model",
    options: modelOptions,
  });
  modelInput.on("change", () => onChange?.());

  bind(folder, morphParams, "extent", { label: "extent", min: 0.5, max: 10, step: 0.1 }, onChange);

  segmentsInput = bind(
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

  shapeFolders.torus = folder.addFolder({ title: "Torus", expanded: true });
  bind(
    shapeFolders.torus,
    morphParams,
    "torusTube",
    { label: "tube", min: 0.05, max: 0.8, step: 0.01 },
    onChange
  );

  shapeFolders.knot = folder.addFolder({ title: "Torus knot", expanded: true });
  bind(
    shapeFolders.knot,
    morphParams,
    "torusKnotRadius",
    { label: "radius", min: 0.2, max: 2, step: 0.05 },
    onChange
  );
  bind(
    shapeFolders.knot,
    morphParams,
    "torusKnotTube",
    { label: "tube", min: 0.05, max: 0.8, step: 0.01 },
    onChange
  );
  bind(
    shapeFolders.knot,
    morphParams,
    "torusKnotTubularSegments",
    { label: "tubular segs", min: 16, max: 512, step: 1 },
    onChange
  );
  bind(
    shapeFolders.knot,
    morphParams,
    "torusKnotRadialSegments",
    { label: "radial segs", min: 4, max: 64, step: 1 },
    onChange
  );
  bind(shapeFolders.knot, morphParams, "torusKnotP", { label: "p", min: 1, max: 12, step: 1 }, onChange);
  bind(shapeFolders.knot, morphParams, "torusKnotQ", { label: "q", min: 1, max: 12, step: 1 }, onChange);

  shapeFolders.minimal = folder.addFolder({ title: "Minimal surface", expanded: true });
  bind(
    shapeFolders.minimal,
    morphParams,
    "minimalVSegments",
    { label: "v segments", min: 16, max: 256, step: 1 },
    onChange
  );

  shapeFolders.chen = shapeFolders.minimal.addFolder({ title: "Chen–Gackstätter", expanded: true });
  bind(
    shapeFolders.chen,
    morphParams,
    "chenGackstatterRMin",
    { label: "radius min", min: 0.05, max: 0.9, step: 0.01 },
    onChange
  );
  bind(
    shapeFolders.chen,
    morphParams,
    "chenGackstatterRMax",
    { label: "radius max", min: 0.1, max: 0.95, step: 0.01 },
    onChange
  );
  bind(
    shapeFolders.chen,
    morphParams,
    "chenGackstatterStretchZ",
    { label: "stretch Z", min: 0.2, max: 4, step: 0.05 },
    onChange
  );

  shapeFolders.lopez = shapeFolders.minimal.addFolder({ title: "López–Ros", expanded: true });
  bind(
    shapeFolders.lopez,
    morphParams,
    "lopezRosMode",
    { label: "mode", options: LOPEZ_ROS_MODE_OPTIONS },
    (ev) => {
      syncShapeFolders();
      onChange?.(ev);
    }
  );
  bind(
    shapeFolders.lopez,
    morphParams,
    "lopezRosSpan",
    { label: "catenoid span", min: 0.4, max: 2.5, step: 0.05 },
    onChange
  );
  bind(
    shapeFolders.lopez,
    morphParams,
    "lopezRosDeform",
    { label: "deform", min: -0.8, max: 0.8, step: 0.01 },
    onChange
  );
  bind(
    shapeFolders.lopez,
    morphParams,
    "lopezRosTwist",
    { label: "twist", min: -Math.PI, max: Math.PI, step: 0.01 },
    onChange
  );
  shapeFolders.lopezStackCount = bind(
    shapeFolders.lopez,
    morphParams,
    "lopezRosStackCount",
    { label: "stack count", min: 2, max: 7, step: 1 },
    onChange
  );
  shapeFolders.lopezStackSpacing = bind(
    shapeFolders.lopez,
    morphParams,
    "lopezRosStackSpacing",
    { label: "neck span", min: 0.35, max: 5, step: 0.05 },
    onChange
  );

  shapeFolders.gielis = folder.addFolder({ title: "Gielis superformula", expanded: true });
  bind(
    shapeFolders.gielis,
    morphParams,
    "gielisPhiMode",
    { label: "φ range", options: GIELIS_PHI_MODE_OPTIONS },
    onChange
  );
  bind(
    shapeFolders.gielis,
    morphParams,
    "gielisVSegments",
    { label: "φ segments", min: 16, max: 256, step: 1 },
    onChange
  );

  const gielisTheta = shapeFolders.gielis.addFolder({ title: "θ set (longitude)", expanded: true });
  bind(gielisTheta, morphParams, "gielisFamily1", { label: "family", options: GIELIS_FAMILY_OPTIONS }, onChange);
  bind(gielisTheta, morphParams, "gielisA1", { label: "a", min: 0.05, max: 4, step: 0.05 }, onChange);
  bind(gielisTheta, morphParams, "gielisB1", { label: "b", min: 0.05, max: 4, step: 0.05 }, onChange);
  bind(gielisTheta, morphParams, "gielisM1", { label: "m", min: 0, max: 20, step: 0.1 }, onChange);
  bind(gielisTheta, morphParams, "gielisN11", { label: "n1", min: -20, max: 40, step: 0.1 }, onChange);
  bind(gielisTheta, morphParams, "gielisN12", { label: "n2", min: -20, max: 40, step: 0.1 }, onChange);
  bind(gielisTheta, morphParams, "gielisN13", { label: "n3", min: -20, max: 40, step: 0.1 }, onChange);

  const gielisPhi = shapeFolders.gielis.addFolder({ title: "φ set (latitude)", expanded: true });
  bind(gielisPhi, morphParams, "gielisFamily2", { label: "family", options: GIELIS_FAMILY_OPTIONS }, onChange);
  bind(gielisPhi, morphParams, "gielisA2", { label: "a", min: 0.05, max: 4, step: 0.05 }, onChange);
  bind(gielisPhi, morphParams, "gielisB2", { label: "b", min: 0.05, max: 4, step: 0.05 }, onChange);
  bind(gielisPhi, morphParams, "gielisM2", { label: "m", min: 0, max: 20, step: 0.1 }, onChange);
  bind(gielisPhi, morphParams, "gielisN21", { label: "n1", min: -20, max: 40, step: 0.1 }, onChange);
  bind(gielisPhi, morphParams, "gielisN22", { label: "n2", min: -20, max: 40, step: 0.1 }, onChange);
  bind(gielisPhi, morphParams, "gielisN23", { label: "n3", min: -20, max: 40, step: 0.1 }, onChange);

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

  syncShapeFolders();
}
