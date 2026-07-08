import { BRIDGE_DEFAULT_URL } from "../config.js";
import { toBridgePayload } from "./bridgePayload.js";

/**
 * WebSocket bridge to external runtimes (Node relay, SuperCollider, etc.)
 */
export function createExternalBridge({ url = BRIDGE_DEFAULT_URL } = {}) {
  let ws = null;
  let connected = false;
  let reconnectTimer = null;
  let enabled = false;
  const listeners = new Set();

  function notify(event, data) {
    for (const fn of listeners) fn(event, data);
  }

  function connect() {
    if (!enabled || ws) return;

    try {
      ws = new WebSocket(url);
    } catch (err) {
      notify("error", err);
      scheduleReconnect();
      return;
    }

    ws.addEventListener("open", () => {
      connected = true;
      notify("connected", { url });
    });

    ws.addEventListener("close", () => {
      connected = false;
      ws = null;
      notify("disconnected", {});
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      notify("error", { message: "WebSocket error" });
    });

    ws.addEventListener("message", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        notify("message", data);
      } catch {
        notify("message", { raw: ev.data });
      }
    });
  }

  function scheduleReconnect() {
    if (!enabled || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 3000);
  }

  function disconnect() {
    enabled = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    connected = false;
  }

  function setEnabled(value) {
    enabled = value;
    if (enabled) connect();
    else disconnect();
  }

  function setUrl(value) {
    url = value;
    if (enabled) {
      disconnect();
      enabled = true;
      connect();
    }
  }

  function send(payload) {
    if (!connected || !ws) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }

  function sendAcousticModel(model) {
    const payload = toBridgePayload(model);
    if (!payload) return false;
    return send(payload);
  }

  function sendNoteTrigger({ action, note, velocity }) {
    return send({
      type: "note_trigger",
      action,
      note,
      velocity,
      timestamp: Date.now(),
    });
  }

  function on(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    setEnabled,
    setUrl,
    send,
    sendAcousticModel,
    sendNoteTrigger,
    isConnected: () => connected,
    on,
  };
}
