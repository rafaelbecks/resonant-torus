/**
 * MIDI camera + model-rotation helpers.
 *
 * Zoom / smoothing are exposed in Settings → MIDI CC mapping (Tweakpane).
 * Distances are world units from the OrbitControls target.
 * CC 0  → maxDistance (zoomed out)
 * CC 127 → minDistance (zoomed in)
 *
 * Absolute CC pots only resolve 128 steps; we slew toward targets each
 * frame so motion feels continuous (orbit-like) instead of stepped.
 *
 * XYZ pots (see mapping.rotation) target either model Euler rotation or
 * the orbit camera (theta / phi / target elevation), toggled by xyzModeToggle.
 */
import { morphParams } from "../morphogenesis/morphParams.js";

export const MIDI_CAMERA_ZOOM = {
  minDistance: 0.15,
  maxDistance: 12,
};

/** Model Euler rotation range (radians). CC 0 → min, CC 127 → max. */
export const MIDI_ROTATION_RANGE = {
  min: 0,
  max: Math.PI * 2,
};

/** Orbit spherical / elevation ranges for XYZ-in-orbit mode. */
export const MIDI_ORBIT_RANGE = {
  thetaMin: -Math.PI,
  thetaMax: Math.PI,
  phiMin: 0.08,
  phiMax: Math.PI - 0.08,
  targetYMin: -4,
  targetYMax: 4,
};

/**
 * Slew rate for MIDI → live values.
 * Higher = snappier; ~8–14 feels close to OrbitControls damping.
 */
export const MIDI_SMOOTHING = {
  rotationLambda: 12,
  zoomLambda: 12,
  orbitLambda: 12,
};

/** @type {"model" | "orbit"} */
let xyzMode = "model";

const rotationTarget = {
  rotationX: null,
  rotationY: null,
  rotationZ: null,
};

/** Orbit slew targets — null means leave that channel alone. */
const orbitTarget = {
  theta: null,
  phi: null,
  targetY: null,
};

let zoomDistanceTarget = null;

function damp(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

function lerp(min, max, t) {
  return min + (max - min) * t;
}

function offsetToSpherical(ox, oy, oz) {
  const radius = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
  const phi = Math.acos(Math.min(1, Math.max(-1, oy / radius)));
  const theta = Math.atan2(ox, oz);
  return { radius, phi, theta };
}

export function getMidiXyzMode() {
  return xyzMode;
}

export function setMidiXyzMode(mode) {
  const next = mode === "orbit" ? "orbit" : "model";
  if (next === xyzMode) return xyzMode;
  xyzMode = next;
  clearMidiMotionTargets();
  return xyzMode;
}

export function toggleMidiXyzMode() {
  return setMidiXyzMode(xyzMode === "model" ? "orbit" : "model");
}

export function clearMidiMotionTargets() {
  rotationTarget.rotationX = null;
  rotationTarget.rotationY = null;
  rotationTarget.rotationZ = null;
  orbitTarget.theta = null;
  orbitTarget.phi = null;
  orbitTarget.targetY = null;
}

export function mapMidiToRotation(value) {
  const t = value / 127;
  const { min, max } = MIDI_ROTATION_RANGE;
  return lerp(min, max, t);
}

export function mapMidiToZoomDistance(value) {
  const t = value / 127;
  const { minDistance, maxDistance } = MIDI_CAMERA_ZOOM;
  // 0 = far, 127 = close
  return maxDistance + t * (minDistance - maxDistance);
}

export function mapMidiAxisToOrbit(axis, value) {
  const t = value / 127;
  const r = MIDI_ORBIT_RANGE;
  if (axis === "x") return lerp(r.thetaMin, r.thetaMax, t);
  if (axis === "y") return lerp(r.phiMin, r.phiMax, t);
  if (axis === "z") return lerp(r.targetYMin, r.targetYMax, t);
  return 0;
}

/** Queue a smoothed rotation target (radians) for rotationX/Y/Z. */
export function setMidiRotationTarget(key, radians) {
  if (!(key in rotationTarget)) return;
  rotationTarget[key] = radians;
}

/**
 * Queue orbit-camera targets from an XYZ axis.
 * x → theta, y → phi, z → controls.target.y
 */
export function setMidiOrbitAxisTarget(axis, value) {
  const mapped = mapMidiAxisToOrbit(axis, value);
  if (axis === "x") orbitTarget.theta = mapped;
  else if (axis === "y") orbitTarget.phi = mapped;
  else if (axis === "z") orbitTarget.targetY = mapped;
}

/** Queue a smoothed orbit-camera distance target. */
export function setMidiZoomDistanceTarget(distance) {
  zoomDistanceTarget = Math.max(0.01, distance);
}

/**
 * Dolly the orbit camera to an absolute distance.
 * Writes position after reading the current look direction so the next
 * OrbitControls.update() keeps this radius.
 */
export function applyCameraDistance(camera, controls, distance) {
  if (!camera || !controls) return null;

  const radius = Math.max(0.01, distance);
  const offset = camera.position.clone().sub(controls.target);
  if (offset.lengthSq() < 1e-8) {
    offset.set(0, 0, 1).applyQuaternion(camera.quaternion).multiplyScalar(radius);
    if (offset.lengthSq() < 1e-8) offset.set(0, 0, radius);
  } else {
    offset.setLength(radius);
  }
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
  return radius;
}

function applyOrbitCamera(camera, controls, theta, phi, targetY) {
  if (!camera || !controls) return;

  if (targetY != null && Number.isFinite(targetY)) {
    controls.target.y = targetY;
  }

  const offset = camera.position.clone().sub(controls.target);
  const { radius } = offsetToSpherical(offset.x, offset.y, offset.z);
  const r = Math.max(0.01, radius);
  const sinPhi = Math.sin(phi);
  camera.position.set(
    controls.target.x + r * sinPhi * Math.sin(theta),
    controls.target.y + r * Math.cos(phi),
    controls.target.z + r * sinPhi * Math.cos(theta)
  );
  camera.lookAt(controls.target);
}

/**
 * Advance smoothed MIDI targets. Call once per animation frame
 * (preferably after OrbitControls.update so zoom/orbit aren't overwritten).
 * @returns {{ rotated: boolean, zoomed: boolean, orbited: boolean, active: boolean }}
 */
export function updateMidiSmoothing(delta, { camera, controls } = {}) {
  const dt = Math.max(0, Math.min(0.05, delta || 0.016));
  let rotated = false;
  let zoomed = false;
  let orbited = false;
  let active = false;

  if (xyzMode === "model") {
    for (const key of Object.keys(rotationTarget)) {
      const target = rotationTarget[key];
      if (target == null) continue;
      active = true;

      const current = morphParams[key];
      const next = damp(current, target, MIDI_SMOOTHING.rotationLambda, dt);
      if (Math.abs(next - current) > 1e-8) {
        morphParams[key] = next;
        rotated = true;
      }
      if (Math.abs(morphParams[key] - target) < 1e-4) {
        morphParams[key] = target;
        rotationTarget[key] = null;
        rotated = true;
      } else {
        rotated = true;
      }
    }
  } else if (camera && controls) {
    const offset = camera.position.clone().sub(controls.target);
    let { theta, phi } = offsetToSpherical(offset.x, offset.y, offset.z);
    let targetY = controls.target.y;
    let dirty = false;

    if (orbitTarget.theta != null) {
      active = true;
      dirty = true;
      theta = damp(theta, orbitTarget.theta, MIDI_SMOOTHING.orbitLambda, dt);
      if (Math.abs(theta - orbitTarget.theta) < 1e-4) {
        theta = orbitTarget.theta;
        orbitTarget.theta = null;
      }
    }
    if (orbitTarget.phi != null) {
      active = true;
      dirty = true;
      phi = damp(phi, orbitTarget.phi, MIDI_SMOOTHING.orbitLambda, dt);
      if (Math.abs(phi - orbitTarget.phi) < 1e-4) {
        phi = orbitTarget.phi;
        orbitTarget.phi = null;
      }
    }
    if (orbitTarget.targetY != null) {
      active = true;
      dirty = true;
      targetY = damp(targetY, orbitTarget.targetY, MIDI_SMOOTHING.orbitLambda, dt);
      if (Math.abs(targetY - orbitTarget.targetY) < 1e-4) {
        targetY = orbitTarget.targetY;
        orbitTarget.targetY = null;
      }
    }

    if (dirty) {
      applyOrbitCamera(camera, controls, theta, phi, targetY);
      orbited = true;
    }
  }

  if (zoomDistanceTarget != null && camera && controls) {
    active = true;
    const current = camera.position.distanceTo(controls.target);
    const next = damp(current, zoomDistanceTarget, MIDI_SMOOTHING.zoomLambda, dt);
    applyCameraDistance(camera, controls, next);
    zoomed = true;
    if (Math.abs(next - zoomDistanceTarget) < 1e-3) {
      applyCameraDistance(camera, controls, zoomDistanceTarget);
      zoomDistanceTarget = null;
    }
  }

  return { rotated, zoomed, orbited, active };
}
