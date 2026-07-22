/**
 * Top-right viewer overlay for live MIDI parameter feedback.
 */
export function createMidiLegend(mountEl) {
  const el = document.createElement("div");
  el.id = "midi-legend";
  el.className = "midi-legend";
  el.hidden = true;
  el.setAttribute("aria-live", "polite");
  mountEl.appendChild(el);

  let enabled = false;
  let hideTimer = null;
  const HOLD_MS = 2200;

  function setEnabled(next) {
    enabled = Boolean(next);
    if (!enabled) {
      clearTimeout(hideTimer);
      hideTimer = null;
      el.hidden = true;
      el.textContent = "";
    }
  }

  function show(message) {
    if (!enabled || !message) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      el.hidden = true;
      hideTimer = null;
    }, HOLD_MS);
  }

  function destroy() {
    clearTimeout(hideTimer);
    el.remove();
  }

  return { setEnabled, show, destroy, isEnabled: () => enabled };
}
