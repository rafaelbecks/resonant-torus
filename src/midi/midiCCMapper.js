/**
 * MIDI CC mapping for morphogenesis sections / parameters.
 * Architecture mirrors glow's MIDICCMapper (section ≈ track, shape ≈ luminode).
 */
import {
  MIDI_SECTIONS,
  MIDI_SECTION_LABELS,
  getSelectableShapes,
  getShapeLabel,
  getSectionParams,
  mapCcToParamValue,
} from "./morphMidiParams.js";
import {
  mapMidiToZoomDistance,
  mapMidiToRotation,
  setMidiRotationTarget,
  setMidiOrbitAxisTarget,
  setMidiZoomDistanceTarget,
  getMidiXyzMode,
  toggleMidiXyzMode,
} from "./midiCamera.js";
import { morphParams, clampMorphParams } from "../morphogenesis/morphParams.js";

const ROTATION_AXIS_KEYS = {
  x: "rotationX",
  y: "rotationY",
  z: "rotationZ",
};

export class MidiCCMapper {
  constructor({ onParamChange, onStatus, getCamera, getControls } = {}) {
    this.onParamChange = onParamChange;
    this.onStatus = onStatus;
    this.getCamera = getCamera;
    this.getControls = getControls;
    this.mapping = null;
    this.deviceId = null;
    this.deviceName = null;
    this.enabled = false;
    this.currentSection = null;
  }

  loadMapping(mappingConfig) {
    const mapping = mappingConfig && typeof mappingConfig === "object"
      ? { ...mappingConfig }
      : {};
    // Ensure newer controls exist even when restoring older organism mappings
    if (!mapping.xyzModeToggle || mapping.xyzModeToggle.cc == null) {
      mapping.xyzModeToggle = { cc: 47 };
    } else {
      mapping.xyzModeToggle = {
        ...mapping.xyzModeToggle,
        cc: Number(mapping.xyzModeToggle.cc),
      };
    }

    this.mapping = mapping;
    this.deviceId = mapping.device?.id || null;
    this.deviceName = mapping.device?.name || null;
    this.enabled = mapping.enabled !== false;
    this._xyzToggleDown = false;
    console.log("[MIDI CC] mapping loaded:", {
      enabled: this.enabled,
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      xyzModeToggle: mapping.xyzModeToggle?.cc,
    });
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  matchesDevice(deviceId, deviceName) {
    if (!this.enabled || !this.mapping) return false;

    if (this.deviceId && deviceId === this.deviceId) return true;

    if (this.deviceName && deviceName) {
      const nameLower = deviceName.toLowerCase();
      const matchNameLower = this.deviceName.toLowerCase();
      if (nameLower.includes(matchNameLower) || matchNameLower.includes(nameLower)) {
        return true;
      }
    }

    // No device filter → accept any input
    if (!this.deviceId && !this.deviceName) return true;

    return false;
  }

  /**
   * @param {number} cc
   * @param {number} value 0–127
   * @param {string} deviceId
   * @param {string} deviceName
   */
  handleCC(cc, value, deviceId, deviceName) {
    if (!this.enabled || !this.mapping) return;
    if (!this.matchesDevice(deviceId, deviceName)) return;

    if (this.mapping.sectionSelection) {
      this.handleSectionSelection(cc, value);
    }

    if (this.mapping.shapeSelection?.cc === cc) {
      this.handleShapeSelection(value);
    }

    // Mode toggle / camera / XYZ take priority over section param CCs
    if (this.handleXyzModeToggle(cc, value)) return;
    if (this.handleCamera(cc, value)) return;
    if (this.handleRotation(cc, value)) return;

    if (this.currentSection && this.mapping.sectionParameters) {
      this.handleSectionParameters(cc, value);
    }
  }

  handleSectionSelection(cc, value) {
    const mapping = this.mapping.sectionSelection;
    if (!mapping) return;

    for (const [section, sectionCC] of Object.entries(mapping)) {
      if (sectionCC !== cc) continue;
      if (!MIDI_SECTIONS.includes(section)) break;

      // Button pads: 127 = on, 0 = off (activate on press)
      if (value >= 64) {
        this.currentSection = section;
        this.emitStatus(`${MIDI_SECTION_LABELS[section] ?? section} active`);
      }
      break;
    }
  }

  handleShapeSelection(value) {
    // Shape type is global; useful even before a section is armed
    const shapes = getSelectableShapes();
    if (!shapes.length) return;

    const index = Math.floor((value / 127) * shapes.length);
    const shape = shapes[Math.min(index, shapes.length - 1)];
    if (!shape || shape === morphParams.shape) return;

    morphParams.shape = shape;
    clampMorphParams();
    this.notifyChange({ kind: "shape", key: "shape", value: shape });
    this.emitStatus(`shape: ${getShapeLabel(shape)}`);
  }

  handleXyzModeToggle(cc, value) {
    const toggleCc = Number(this.mapping.xyzModeToggle?.cc);
    if (!Number.isFinite(toggleCc) || Number(cc) !== toggleCc) return false;

    // Rising edge (supports momentary pads and low-value 0/1 buttons)
    const pressed = value > 0;
    if (pressed && !this._xyzToggleDown) {
      this._xyzToggleDown = true;
      const mode = toggleMidiXyzMode();
      this.notifyChange({ kind: "xyzMode", value: mode, smoothed: true });
      this.emitStatus(mode === "orbit" ? "xyz: orbit camera" : "xyz: model rotation");
    } else if (!pressed) {
      this._xyzToggleDown = false;
    }
    return true;
  }

  handleCamera(cc, value) {
    const cameraMap = this.mapping.camera;
    if (!cameraMap) return false;

    const action = cameraMap[String(cc)];
    if (action !== "zoom") return false;

    const distance = mapMidiToZoomDistance(value);
    setMidiZoomDistanceTarget(distance);
    this.emitStatus(`zoom: ${distance.toFixed(2)}`);
    return true;
  }

  handleRotation(cc, value) {
    const rotationMap = this.mapping.rotation;
    if (!rotationMap) return false;

    const axis = rotationMap[String(cc)];
    if (!axis || !ROTATION_AXIS_KEYS[axis]) return false;

    const mode = getMidiXyzMode();

    if (mode === "orbit") {
      setMidiOrbitAxisTarget(axis, value);
      const label =
        axis === "x" ? "orbit θ" : axis === "y" ? "orbit φ" : "orbit elev";
      this.notifyChange({
        kind: "orbit",
        axis,
        value,
        label,
        smoothed: true,
      });
      this.emitStatus(`${label}: ${value}`);
      return true;
    }

    const key = ROTATION_AXIS_KEYS[axis];
    const radians = mapMidiToRotation(value);
    setMidiRotationTarget(key, radians);
    this.notifyChange({
      kind: "rotation",
      key,
      value: radians,
      label: `rotation ${axis}`,
      smoothed: true,
    });
    this.emitStatus(`rotation ${axis}: ${radians.toFixed(3)}`);
    return true;
  }

  handleSectionParameters(cc, value) {
    const paramConfig = this.mapping.sectionParameters;
    if (!paramConfig || !this.currentSection) return;

    const startCC = paramConfig.start ?? 0;
    const maxCC = paramConfig.max ?? 127;
    if (cc < startCC || cc > maxCC) return;

    const params = getSectionParams(this.currentSection, morphParams.shape);
    const paramIndex = cc - startCC;
    if (paramIndex < 0 || paramIndex >= params.length) return;

    const param = params[paramIndex];
    if (!param) return;

    const nextValue = mapCcToParamValue(param, value);
    if (nextValue === undefined) return;
    if (morphParams[param.key] === nextValue) return;

    morphParams[param.key] = nextValue;
    clampMorphParams();
    this.notifyChange({
      kind: "param",
      section: this.currentSection,
      key: param.key,
      value: morphParams[param.key],
      label: param.label,
    });

    const display =
      typeof morphParams[param.key] === "number"
        ? Number(morphParams[param.key].toFixed(3))
        : morphParams[param.key];
    this.emitStatus(`${param.label}: ${display}`);
  }

  notifyChange(detail) {
    this.onParamChange?.(detail);
  }

  emitStatus(message) {
    this.onStatus?.(message);
    console.log(`[MIDI CC] ${message}`);
  }

  getState() {
    return {
      enabled: this.enabled,
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      currentSection: this.currentSection,
      xyzMode: getMidiXyzMode(),
      hasMapping: !!this.mapping,
    };
  }
}

export async function loadMidiMapping(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load MIDI mapping: ${response.statusText}`);
  }
  return response.json();
}
