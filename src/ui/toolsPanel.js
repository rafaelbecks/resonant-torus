import { Pane } from "tweakpane";
import { params, getEnvOptions, getEnvPath } from "../config.js";
import { setupMorphUI } from "../morphogenesis/morphUI.js";

export function createToolsPanel({
  container,
  morphSystem,
  sceneSystem,
  externalBridge,
  onAnalyze,
  onPitchChange,
  onCopyForSuperCollider,
  onRefresh,
  onEnvironmentChange,
  onChamberGraphChange,
}) {
  const pane = new Pane({ title: "Resonant Organisms", container });

  setupMorphUI(pane, morphSystem, () => {
    onRefresh?.();
  });

  const viewFolder = pane.addFolder({ title: "Viewer", expanded: true });

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

  const envFolder = pane.addFolder({ title: "Environment", expanded: false });
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

  const acousticFolder = pane.addFolder({ title: "Acoustics", expanded: true });
  acousticFolder.addBinding(params, "autoAnalyze", { label: "auto analyze" });
  acousticFolder.addBinding(params, "pitchMultiplier", {
    label: "pitch mult",
    min: 0.25,
    max: 8,
    step: 0.25,
  }).on("change", () => onPitchChange?.());
  acousticFolder
    .addBinding(params, "showChamberGraph", { label: "3d chamber graph" })
    .on("change", () => onChamberGraphChange?.());
  acousticFolder.addButton({ title: "Analyze shape" }).on("click", () => onAnalyze?.());

  const scFolder = pane.addFolder({ title: "SuperCollider", expanded: true });
  scFolder.addButton({ title: "Copy model JSON" }).on("click", () => {
    console.log("[SC copy] button clicked");
    onCopyForSuperCollider?.();
  });

  const bridgeFolder = pane.addFolder({ title: "OSC bridge (optional)", expanded: false });
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
    applyEnvironment,
  };
}
