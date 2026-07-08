export const DEFAULT_ENV = "none";

export const HDR_ENVIRONMENTS = {
  none: { label: "None (studio lights)", file: null },
  industrial_sunset: {
    label: "Industrial Sunset",
    file: "industrial_sunset_02_puresky_1k.hdr",
  },
  aristea_wreck: {
    label: "Aristea Wreck",
    file: "aristea_wreck_puresky_1k.hdr",
  },
  rosendal_park: {
    label: "Rosendal Park Sunset",
    file: "rosendal_park_sunset_puresky_1k.hdr",
  },
  qwantani_sunset: {
    label: "Qwantani Sunset",
    file: "qwantani_sunset_puresky_1k.hdr",
  },
  qwantani_night: {
    label: "Qwantani Night",
    file: "qwantani_night_puresky_1k.hdr",
  },
};

export function getEnvOptions() {
  return Object.fromEntries(
    Object.entries(HDR_ENVIRONMENTS).map(([id, { label }]) => [label, id])
  );
}

export function getEnvPath(envId) {
  const env = HDR_ENVIRONMENTS[envId];
  if (!env?.file) return null;
  return `./env/${env.file}`;
}

export const params = {
  lightIntensity: 1.4,
  ambient: 0.6,
  exposure: 1,
  environment: DEFAULT_ENV,
  bgBlur: 0,
  showGrid: false,
  showAxes: false,
  showChamberGraph: true,
  gridSize: 20,
  gridDivisions: 20,
  moveSpeed: 4,
  fpMove: true,
  autoRotate: false,
  rotateSpeed: 0.4,
  wireframe: true,
  roughness: 0.45,
  metalness: 0.08,
  autoAnalyze: true,
  chamberFocusDistance: 1.15,
  pitchMultiplier: 1,
  playMode: "drone",
  envAttack: 0.02,
  envDecay: 0.1,
  envSustain: 0.75,
  envRelease: 0.45,
  webMidiEnabled: false,
};

export const CAMERA_INTRO = {
  startY: null,
  endY: 2.5,
  startZ: 0,
  endZ: 4,
  delay: 0.3,
  duration: 2,
};

export const BRIDGE_DEFAULT_URL = "ws://localhost:57120";
