import { params } from "./config.js";
import { createSceneSystem } from "./scene.js";
import { createInputSystem } from "./input.js";
import { createMorphSystem } from "./morphogenesis/morphSystem.js";
import { createAcousticPanel } from "./acoustics/acousticPanel.js";
import { createChamberPicker } from "./acoustics/chamberPicker.js";
import { createExternalBridge } from "./bridge/externalBridge.js";
import { createLoading } from "./ui/loading.js";
import { createAnalysisLoading } from "./ui/analysisLoading.js";
import { createToolsPanel } from "./ui/toolsPanel.js";
import { initPanelResize } from "./ui/panelResize.js";
import { createCameraFocus } from "./scene/cameraFocus.js";
import { morphParams } from "./morphogenesis/morphParams.js";

export async function bootApp() {
  const loading = createLoading();
  const analysisLoading = createAnalysisLoading();
  const analysisLoadingEl = document.getElementById("analysis-loading");
  const mount = document.getElementById("viewer-mount");

  const sceneSystem = createSceneSystem({ mount, loading });
  const input = createInputSystem(sceneSystem.camera, sceneSystem.controls);

  const morphSystem = createMorphSystem({
    scene: sceneSystem.scene,
    params,
  });

  let analysisTimer = null;
  let analysisJob = 0;
  let analysisQueued = false;

  const cameraFocus = createCameraFocus({
    camera: sceneSystem.camera,
    controls: sceneSystem.controls,
  });

  let toolsPanel = null;
  let chamberPicker = null;

  function getActiveMesh() {
    return morphSystem.getAnalysisMesh();
  }

  function focusOnChamber(chamberId) {
    const analysis = acousticPanel.getAnalysis();
    const chamber = analysis?.chambers?.find((c) => c.id === chamberId);
    if (!chamber?.position) return;

    const mesh = getActiveMesh();
    let distance = params.chamberFocusDistance * 2;
    if (mesh?.geometry?.boundingSphere) {
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      distance = Math.max(
        1,
        mesh.geometry.boundingSphere.radius * params.chamberFocusDistance
      );
    }

    cameraFocus.focusOnPoint(chamber.position, { distance });
  }

  const acousticPanel = createAcousticPanel({
    networkEl: document.getElementById("acoustics-network"),
    detailEl: document.getElementById("acoustics-chamber-detail"),
    summaryEl: document.getElementById("acoustics-summary"),
    statusEl: document.getElementById("acoustics-status"),
    onChamberSelect: (id, { skipPicker = false, skipFocus = false } = {}) => {
      if (!skipPicker) {
        chamberPicker?.highlightChamber(id, acousticPanel.getAnalysis());
      }
      if (!skipFocus) focusOnChamber(id);
    },
  });

  chamberPicker = createChamberPicker({
    camera: sceneSystem.camera,
    domElement: mount,
    scene: sceneSystem.scene,
    getMesh: getActiveMesh,
    getAnalysis: () => acousticPanel.getAnalysis(),
    onSelect: (id) => acousticPanel.selectChamber(id, { skipPicker: true }),
  });

  initPanelResize({
    onResize: () => {
      sceneSystem.resize();
      acousticPanel.onResize();
    },
  });

  const externalBridge = createExternalBridge();

  function runAnalysisSync({ sendOnly = false } = {}) {
    const mesh = getActiveMesh();
    if (!mesh) return null;

    const noiseMix = morphParams.noiseEnabled
      ? (morphSystem.getNoiseMix?.() ?? 1)
      : 0;
    const model = acousticPanel.analyze(mesh, {
      noiseMix,
      noiseEnabled: morphParams.noiseEnabled,
      shape: morphParams.shape,
    });

    chamberPicker.updateFromAnalysis(acousticPanel.getAnalysis());
    const selected = acousticPanel.getSelectedChamberId();
    if (selected != null) {
      chamberPicker.highlightChamber(selected, acousticPanel.getAnalysis());
    }

    if (toolsPanel?.bridgeParams?.autoSend || sendOnly) {
      if (externalBridge.isConnected()) {
        externalBridge.sendAcousticModel(model);
      }
    }

    return model;
  }

  async function runAnalysis(opts = {}) {
    analysisQueued = true;
    const job = ++analysisJob;

    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (job !== analysisJob) return null;

    analysisQueued = false;
    analysisLoading.show();
    analysisLoadingEl?.setAttribute("aria-busy", "true");

    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (job !== analysisJob) {
      analysisLoading.hide();
      analysisLoadingEl?.setAttribute("aria-busy", "false");
      return null;
    }

    try {
      return runAnalysisSync(opts);
    } finally {
      analysisLoading.hide();
      analysisLoadingEl?.setAttribute("aria-busy", "false");
      if (analysisQueued) runAnalysis(opts);
    }
  }

  function scheduleAnalysis() {
    if (!params.autoAnalyze) return;
    if (analysisTimer != null) clearTimeout(analysisTimer);
    analysisTimer = setTimeout(() => {
      analysisTimer = null;
      runAnalysis();
    }, 150);
  }

  toolsPanel = createToolsPanel({
    container: document.getElementById("tools-scroll"),
    morphSystem,
    sceneSystem,
    externalBridge,
    onAnalyze: (opts) => runAnalysis(opts),
    onEnvironmentChange: async () => {
      await toolsPanel.applyEnvironment();
    },
    onRefresh: () => {
      morphSystem.sync();
      scheduleAnalysis();
    },
  });

  await toolsPanel.applyEnvironment();
  morphSystem.sync();
  await runAnalysis();

  const clock = { elapsed: 0 };

  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(0.05, clock.elapsed ? (performance.now() - clock.elapsed) / 1000 : 0.016);
    clock.elapsed = performance.now();

    input.applyWalkMovement(delta);
    cameraFocus.update();
    sceneSystem.controls.update();
    morphSystem.update(delta);

    sceneSystem.renderer.render(sceneSystem.scene, sceneSystem.camera);
  }

  animate();
}
