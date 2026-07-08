import { Pane } from "tweakpane";
import { params, getEnvOptions, getEnvPath } from "../config.js";
import { setupMorphUI } from "../morphogenesis/morphUI.js";
import { createWebMidiController } from "../midi/webMidi.js";
import { midiNoteName } from "../midi/notePitch.js";

export function createToolsPanel({
  container,
  morphSystem,
  sceneSystem,
  externalBridge,
  onAnalyze,
  onPitchChange,
  onPlaybackChange,
  onMidiNoteOn,
  onMidiNoteOff,
  onCopyForSuperCollider,
  onRefresh,
  onEnvironmentChange,
  onChamberGraphChange,
}) {
  const pane = new Pane({ title: "Resonant Organisms", container });

  const tab = pane.addTab({
    pages: [
      { title: "Morphogenesis" },
      { title: "Acoustics & Sound" },
      { title: "Viewer & Environment" },
    ],
  });

  const morphTab = tab.pages[0];
  const soundTab = tab.pages[1];
  const viewTab = tab.pages[2];

  setupMorphUI(morphTab, morphSystem, () => {
    onRefresh?.();
  });

  const viewFolder = viewTab.addFolder({ title: "Viewer", expanded: true });

  viewFolder.addBinding(params, "showGrid", { label: "grid" }).on("change", () => {
    sceneSystem.rebuildGrid();
  });
  viewFolder.addBinding(params, "showAxes", { label: "axes" }).on("change", () => {
    sceneSystem.rebuildAxes();
  });
  viewFolder.addBinding(params, "gridSize", {
    label: "grid size",
    min: 5,
    max: 100,
    step: 1,
  }).on("change", () => sceneSystem.rebuildGrid());

  viewFolder.addBinding(params, "chamberFocusDistance", {
    label: "chamber zoom",
    min: 0.4,
    max: 3,
    step: 0.05,
  });

  viewFolder.addBinding(params, "autoRotate", { label: "auto rotate" }).on("change", (ev) => {
    sceneSystem.controls.autoRotate = ev.value;
  });
  viewFolder.addBinding(params, "rotateSpeed", {
    label: "rotate speed",
    min: 0.1,
    max: 3,
    step: 0.1,
  }).on("change", (ev) => {
    sceneSystem.controls.autoRotateSpeed = ev.value;
  });

  viewFolder.addBinding(params, "fpMove", { label: "WASD walk" });
  viewFolder.addBinding(params, "moveSpeed", { label: "walk speed", min: 1, max: 20, step: 0.5 });
  viewFolder.addBinding(params, "wireframe", { label: "wireframe" }).on("change", () => {
    onRefresh?.();
  });
  viewFolder.addBinding(params, "roughness", {
    label: "roughness",
    min: 0,
    max: 1,
    step: 0.01,
  }).on("change", () => onRefresh?.());
  viewFolder.addBinding(params, "metalness", {
    label: "metalness",
    min: 0,
    max: 1,
    step: 0.01,
  }).on("change", () => onRefresh?.());
  viewFolder.addBinding(params, "exposure", {
    label: "exposure",
    min: 0.2,
    max: 2,
    step: 0.05,
  }).on("change", (ev) => {
    sceneSystem.renderer.toneMappingExposure = ev.value;
  });

  const envFolder = viewTab.addFolder({ title: "Environment", expanded: true });
  envFolder.addBinding(params, "environment", {
    label: "HDR",
    options: getEnvOptions(),
  }).on("change", () => onEnvironmentChange?.());
  envFolder.addBinding(params, "bgBlur", {
    label: "bg blur",
    min: 0,
    max: 1,
    step: 0.01,
  }).on("change", (ev) => {
    sceneSystem.scene.backgroundBlurriness = ev.value;
  });
  envFolder.addBinding(params, "lightIntensity", {
    label: "direct light",
    min: 0,
    max: 5,
    step: 0.1,
  }).on("change", (ev) => {
    sceneSystem.light.intensity = ev.value;
  });
  envFolder.addBinding(params, "ambient", {
    label: "ambient",
    min: 0,
    max: 3,
    step: 0.05,
  }).on("change", (ev) => {
    sceneSystem.ambient.intensity = ev.value;
  });

  const acousticFolder = soundTab.addFolder({ title: "Acoustics", expanded: true });
  acousticFolder.addBinding(params, "autoAnalyze", { label: "auto analyze" });
  const pitchBinding = acousticFolder.addBinding(params, "pitchMultiplier", {
    label: "pitch mult",
    min: 0.25,
    max: 8,
    step: 0.25,
  });
  pitchBinding.on("change", () => onPitchChange?.());
  acousticFolder
    .addBinding(params, "showChamberGraph", { label: "3d chamber graph" })
    .on("change", () => onChamberGraphChange?.());
  acousticFolder.addButton({ title: "Analyze shape" }).on("click", () => onAnalyze?.());

  const playbackFolder = soundTab.addFolder({ title: "Playback", expanded: true });
  playbackFolder
    .addBinding(params, "playMode", {
      label: "mode",
      options: { drone: "drone", trigger: "trigger (ADSR)" },
    })
    .on("change", () => {
      syncEnvelopeFolder();
      onPlaybackChange?.();
    });

  const envControlsFolder = playbackFolder.addFolder({ title: "Envelope (trigger)", expanded: true });
  envControlsFolder.addBinding(params, "envAttack", {
    label: "attack",
    min: 0.001,
    max: 2,
    step: 0.01,
  }).on("change", () => onPlaybackChange?.());
  envControlsFolder.addBinding(params, "envDecay", {
    label: "decay",
    min: 0.001,
    max: 2,
    step: 0.01,
  }).on("change", () => onPlaybackChange?.());
  envControlsFolder.addBinding(params, "envSustain", {
    label: "sustain",
    min: 0,
    max: 1,
    step: 0.01,
  }).on("change", () => onPlaybackChange?.());
  envControlsFolder.addBinding(params, "envRelease", {
    label: "release",
    min: 0.001,
    max: 4,
    step: 0.01,
  }).on("change", () => onPlaybackChange?.());

  function syncEnvelopeFolder() {
    const trigger = params.playMode === "trigger";
    envControlsFolder.hidden = !trigger;
  }
  syncEnvelopeFolder();

  const scFolder = soundTab.addFolder({ title: "SuperCollider", expanded: false });
  scFolder.addButton({ title: "Copy model JSON" }).on("click", () => {
    onCopyForSuperCollider?.();
  });

  const bridgeFolder = soundTab.addFolder({ title: "External bridge", expanded: false });
  const bridgeParams = {
    enabled: false,
    url: "ws://localhost:57120",
    autoSend: false,
  };

  bridgeFolder.addBinding(bridgeParams, "enabled", { label: "connect" }).on("change", (ev) => {
    externalBridge.setEnabled(ev.value);
  });
  bridgeFolder.addBinding(bridgeParams, "url", { label: "WebSocket URL" }).on("change", (ev) => {
    externalBridge.setUrl(ev.value);
  });
  bridgeFolder.addBinding(bridgeParams, "autoSend", { label: "auto send" });

  const midiFolder = soundTab.addFolder({ title: "WebMIDI", expanded: true });
  const midiParams = {
    enabled: false,
    deviceId: "",
    lastNote: "—",
    status: "requesting access…",
  };
  const webMidi = createWebMidiController({
    onNoteOn: (ev) => {
      midiParams.lastNote = `${midiNoteName(ev.note)} (${ev.note})`;
      midiParams.status = `note on · vel ${ev.velocity}`;
      midiStatusBinding.refresh();
      midiNoteBinding.refresh();
      onMidiNoteOn?.(ev);
    },
    onNoteOff: (ev) => {
      midiParams.status = `note off · ${midiNoteName(ev.note)}`;
      midiStatusBinding.refresh();
      onMidiNoteOff?.(ev);
    },
    onStateChange: (devices) => {
      refreshMidiDevices(devices);
    },
  });

  let midiDeviceBinding = null;
  let midiStatusBinding = null;
  let midiNoteBinding = null;
  let midiDevices = [];

  function buildDeviceOptions(devices) {
    const options = { "— select device —": "" };
    devices.forEach((d, i) => {
      const label =
        devices.filter((x) => x.name === d.name).length > 1
          ? `${d.name} (${i + 1})`
          : d.name;
      options[label] = d.id;
    });
    return options;
  }

  function onMidiDeviceChange() {
    if (midiParams.enabled) {
      connectMidiInput();
    } else {
      const dev = midiDevices.find((d) => d.id === midiParams.deviceId);
      midiParams.status = dev ? `ready · ${dev.name}` : "ready";
    }
    midiStatusBinding?.refresh();
  }

  function rebuildMidiDeviceBinding() {
    if (midiDeviceBinding) {
      midiDeviceBinding.dispose();
      midiDeviceBinding = null;
    }
    const options = buildDeviceOptions(midiDevices);
    if (!midiParams.deviceId || !midiDevices.some((d) => d.id === midiParams.deviceId)) {
      midiParams.deviceId = midiDevices.length === 1 ? midiDevices[0].id : "";
    }
    midiDeviceBinding = midiFolder.addBinding(midiParams, "deviceId", {
      label: "input",
      options,
    });
    midiDeviceBinding.on("change", onMidiDeviceChange);
  }

  function refreshMidiDevices(devices = webMidi.listInputs()) {
    midiDevices = devices;
    rebuildMidiDeviceBinding();
  }

  function connectMidiInput() {
    if (!midiParams.enabled || !midiParams.deviceId) {
      webMidi.disconnect();
      return false;
    }
    if (!webMidi.selectDevice(midiParams.deviceId)) {
      midiParams.status = "device unavailable";
      return false;
    }
    const dev = midiDevices.find((d) => d.id === midiParams.deviceId);
    midiParams.status = dev ? `listening · ${dev.name}` : "listening";
    return true;
  }

  async function initMidiDevices() {
    if (!webMidi.isSupported()) {
      midiParams.status = "WebMIDI not supported";
      midiStatusBinding?.refresh();
      return;
    }
    try {
      const devices = await webMidi.requestAccess();
      refreshMidiDevices(devices);
      if (midiParams.enabled) {
        connectMidiInput();
      } else {
        midiParams.status = devices.length
          ? devices.length === 1
            ? `ready · ${devices[0].name}`
            : "ready · select a device"
          : "no MIDI inputs found";
      }
    } catch (err) {
      console.warn("[WebMIDI] access failed:", err);
      midiParams.status =
        err?.name === "SecurityError"
          ? "click Refresh to allow MIDI access"
          : err.message || "MIDI access denied";
    }
    midiStatusBinding?.refresh();
  }

  midiFolder.addBinding(midiParams, "enabled", { label: "enable" }).on("change", (ev) => {
    if (!ev.value) {
      webMidi.disconnect();
      const dev = midiDevices.find((d) => d.id === midiParams.deviceId);
      midiParams.status = dev ? `ready · ${dev.name}` : "ready";
    } else {
      connectMidiInput();
    }
    midiStatusBinding?.refresh();
  });

  midiFolder.addButton({ title: "Refresh MIDI devices" }).on("click", async () => {
    if (!webMidi.isSupported()) {
      midiParams.status = "WebMIDI not supported";
      midiStatusBinding?.refresh();
      return;
    }
    midiParams.status = "requesting access…";
    midiStatusBinding?.refresh();
    try {
      const devices = await webMidi.requestAccess();
      refreshMidiDevices(devices);
      if (midiParams.enabled) {
        connectMidiInput();
      } else {
        midiParams.status = devices.length
          ? `${devices.length} device(s) found`
          : "no MIDI inputs found";
      }
    } catch (err) {
      console.warn("[WebMIDI] refresh failed:", err);
      refreshMidiDevices([]);
      midiParams.status = err.message || "MIDI access denied";
    }
    midiStatusBinding?.refresh();
  });

  midiNoteBinding = midiFolder.addBinding(midiParams, "lastNote", {
    label: "last note",
    readonly: true,
  });
  midiStatusBinding = midiFolder.addBinding(midiParams, "status", {
    label: "status",
    readonly: true,
  });

  rebuildMidiDeviceBinding();
  initMidiDevices();

  async function applyEnvironment() {
    const path = getEnvPath(params.environment);
    if (!path) {
      sceneSystem.clearEnvironment();
      return;
    }
    await sceneSystem.loadEnvironment(path);
    sceneSystem.scene.backgroundBlurriness = params.bgBlur;
  }

  return {
    pane,
    bridgeParams,
    midiParams,
    refreshPitch: () => pitchBinding.refresh(),
    applyEnvironment,
  };
}
