export function createAnalysisLoading() {
  const root = document.getElementById("analysis-loading");
  const labelEl = root?.querySelector(".analysis-loading__label");

  let active = 0;

  function render() {
    if (!root) return;
    root.hidden = active <= 0;
    root.classList.toggle("analysis-loading--visible", active > 0);
  }

  return {
    show(label = "Analyzing shape") {
      active++;
      if (labelEl) labelEl.textContent = label;
      render();
    },
    hide() {
      active = Math.max(0, active - 1);
      render();
    },
    reset() {
      active = 0;
      render();
    },
  };
}
