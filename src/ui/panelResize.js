const STORAGE_KEY = "resonant-torus-panel-sizes";

const LIMITS = {
  toolsWidth: { min: 280, max: 720 },
  acousticsHeight: { min: 100, max: () => Math.floor(window.innerHeight * 0.65) },
};

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveSizes(sizes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    // ignore quota / private mode
  }
}

function readPxVar(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return parseFloat(value) || 0;
}

function setPxVar(name, px) {
  document.documentElement.style.setProperty(name, `${Math.round(px)}px`);
}

function beginDrag({ cursor, onMove, onEnd }) {
  const prevCursor = document.body.style.cursor;
  const prevSelect = document.body.style.userSelect;
  document.body.style.cursor = cursor;
  document.body.style.userSelect = "none";

  const move = (ev) => onMove(ev);
  const end = (ev) => {
    document.body.style.cursor = prevCursor;
    document.body.style.userSelect = prevSelect;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", end);
    onEnd?.(ev);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
}

function setupWidthResize(handle, { onResize } = {}) {
  const { min, max } = LIMITS.toolsWidth;

  handle.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    handle.setPointerCapture(ev.pointerId);
    handle.classList.add("is-dragging");

    const startX = ev.clientX;
    const startWidth = readPxVar("--tools-width");

    beginDrag({
      cursor: "ew-resize",
      onMove: (moveEv) => {
        const next = Math.min(max, Math.max(min, startWidth + (startX - moveEv.clientX)));
        setPxVar("--tools-width", next);
        onResize?.();
      },
      onEnd: () => {
        handle.classList.remove("is-dragging");
        handle.releasePointerCapture(ev.pointerId);
        saveSizes({ ...loadSaved(), toolsWidth: readPxVar("--tools-width") });
      },
    });
  });
}

function setupHeightResize(handle, { onResize } = {}) {
  handle.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    handle.setPointerCapture(ev.pointerId);
    handle.classList.add("is-dragging");

    const startY = ev.clientY;
    const startHeight = readPxVar("--acoustics-height");
    const max = LIMITS.acousticsHeight.max();
    const { min } = LIMITS.acousticsHeight;

    beginDrag({
      cursor: "ns-resize",
      onMove: (moveEv) => {
        const next = Math.min(max, Math.max(min, startHeight + (startY - moveEv.clientY)));
        setPxVar("--acoustics-height", next);
        onResize?.();
      },
      onEnd: () => {
        handle.classList.remove("is-dragging");
        handle.releasePointerCapture(ev.pointerId);
        saveSizes({ ...loadSaved(), acousticsHeight: readPxVar("--acoustics-height") });
      },
    });
  });
}

export function initPanelResize({ onResize } = {}) {
  const saved = loadSaved();
  if (saved.toolsWidth) setPxVar("--tools-width", saved.toolsWidth);
  if (saved.acousticsHeight) setPxVar("--acoustics-height", saved.acousticsHeight);

  const toolsHandle = document.getElementById("tools-resize-handle");
  const acousticsHandle = document.getElementById("acoustics-resize-handle");

  if (toolsHandle) setupWidthResize(toolsHandle, { onResize });
  if (acousticsHandle) setupHeightResize(acousticsHandle, { onResize });
}
