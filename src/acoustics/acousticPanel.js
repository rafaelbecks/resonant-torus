import { analyzeShape } from "./shapeAnalysis.js";
import { buildAcousticModel } from "./acousticModel.js";
import { createChamberNetworkView, renderChamberDetail } from "./chamberNetworkView.js";
import { createChamberMixState } from "./chamberMixState.js";

export function createAcousticPanel({
  networkEl,
  detailEl,
  summaryEl,
  statusEl,
  onChamberSelect,
  onChamberMixChange,
}) {
  let analysis = null;
  let acousticModel = null;
  let selectedChamberId = null;
  let lastAnalyzeOptions = {};
  const mixState = createChamberMixState();

  const networkView = createChamberNetworkView(networkEl, {
    onSelect: (id) => selectChamber(id),
    onMixChange: (id) => {
      mixState.toggle(id);
      const model = rebuildModel();
      onChamberMixChange?.(model);
    },
  });

  function setStatus(text, active = false) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("active", active);
  }

  function renderSummary(model) {
    if (!summaryEl || !model) return;

    const { timbre, synthesis, chambers } = model;
    const pitchLine =
      model.pitchMultiplier && model.pitchMultiplier !== 1
        ? `<div class="metric-row"><span>Pitch mult</span><span class="metric-value">×${model.pitchMultiplier.toFixed(2)}</span></div>
      <div class="metric-row"><span>Base f0</span><span class="metric-value">${synthesis.baseFundamentalHz.toFixed(2)} Hz</span></div>`
        : "";
    summaryEl.innerHTML = `
      <div class="metric-row"><span>Chambers</span><span class="metric-value">${chambers.length}</span></div>
      <div class="metric-row"><span>Harmonic stack</span><span class="metric-value">${timbre.harmonicStack}</span></div>
      <div class="metric-row"><span>Timbre purity</span><span class="metric-value">${(timbre.purity * 100).toFixed(1)}%</span></div>
      <div class="metric-row"><span>Modulation</span><span class="metric-value">${(timbre.modulation * 100).toFixed(1)}%</span></div>
      ${pitchLine}
      <div class="metric-row"><span>Fundamental</span><span class="metric-value">${synthesis.fundamentalHz.toFixed(2)} Hz</span></div>
      <div class="metric-row"><span>Partials</span><span class="metric-value">${synthesis.partials.length}</span></div>
      <div class="metric-row"><span>Routes</span><span class="metric-value">${model.network.length}</span></div>
      <div class="metric-row"><span>Noise mix</span><span class="metric-value">${(model.noiseMix * 100).toFixed(0)}%</span></div>
    `;
  }

  function selectChamber(id, { skipPicker = false, skipFocus = false } = {}) {
    selectedChamberId = id;
    networkView.setSelected(id);
    const chamber = acousticModel?.chambers.find((c) => c.id === id);
    renderChamberDetail(detailEl, chamber, analysis);
    onChamberSelect?.(id, { skipPicker, skipFocus });
  }

  function rebuildModel(extraOptions = {}) {
    if (!analysis) return null;

    const options = {
      ...lastAnalyzeOptions,
      ...extraOptions,
      chamberGates: mixState.gatesForChambers(analysis.chambers),
    };
    acousticModel = buildAcousticModel(analysis, options);
    renderSummary(acousticModel);
    networkView.render(acousticModel, { mixState });

    if (acousticModel.chambers.length > 0) {
      const keepId = selectedChamberId;
      const nextId = acousticModel.chambers.some((c) => c.id === keepId)
        ? keepId
        : acousticModel.chambers[0].id;
      selectChamber(nextId, { skipPicker: true, skipFocus: true });
    } else {
      renderChamberDetail(detailEl, null, null);
    }

    return acousticModel;
  }

  function analyze(mesh, options = {}) {
    lastAnalyzeOptions = { ...options };
    analysis = analyzeShape(mesh, options);
    mixState.reset();
    acousticModel = rebuildModel();

    const label =
      analysis.mode === "uniform" || acousticModel.chambers.length === 1
        ? "1 chamber · perfect harmonic"
        : `${acousticModel.chambers.length} chambers · ${acousticModel.timbre.harmonicStack}`;
    setStatus(label, true);
    return acousticModel;
  }

  function getModel() {
    return acousticModel;
  }

  return {
    analyze,
    rebuildModel,
    getModel,
    getAnalysis: () => analysis,
    selectChamber,
    getSelectedChamberId: () => selectedChamberId,
    onResize: () => networkView.render(acousticModel, { mixState }),
    dispose() {
      networkView.dispose();
    },
  };
}
