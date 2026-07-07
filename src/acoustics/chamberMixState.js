/**
 * Per-chamber enable toggles. All enabled by default; reset on new shape analysis.
 */
export function createChamberMixState() {
  const disabled = new Set();

  function reset() {
    disabled.clear();
  }

  function isEnabled(id) {
    return !disabled.has(id);
  }

  function gateFor(id) {
    return isEnabled(id) ? 1 : 0;
  }

  function toggle(id) {
    if (disabled.has(id)) disabled.delete(id);
    else disabled.add(id);
  }

  function gatesForChambers(chambers) {
    const gates = {};
    for (const c of chambers) {
      gates[c.id] = gateFor(c.id);
    }
    return gates;
  }

  function getUiState(id) {
    const enabled = isEnabled(id);
    return { enabled, silent: !enabled };
  }

  return {
    reset,
    toggle,
    gateFor,
    gatesForChambers,
    getUiState,
  };
}
