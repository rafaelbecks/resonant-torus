/**
 * WebSocket relay for Resonant Torus browser ↔ SuperCollider (via OSC).
 *
 * Usage:
 *   npm run bridge
 *
 * Browser connects to ws://localhost:57120
 * acoustic_model payloads are forwarded to SuperCollider as OSC:
 *   /resonant_torus/model  <json string>
 * on UDP localhost:57124 (dedicated — not langPort 57120; Protokol/sharingd often use nearby ports)
 *
 * Note: payloads are slim (no analysis.samples) — full models exceed UDP size limits.
 */

import { WebSocketServer } from "ws";
import { Client } from "node-osc";

const BROWSER_PORT = 57120;
const SC_OSC_HOST = "127.0.0.1";
/** Dedicated SC listener — see ResonantTorus.scd ~rtOscPort */
const SC_OSC_PORT = 57124;
const OSC_ADDRESS = "/resonant_torus/model";
const MAX_OSC_BYTES = 60000;

const browserWss = new WebSocketServer({ port: BROWSER_PORT });
const oscClient = new Client(SC_OSC_HOST, SC_OSC_PORT);

let browserClients = new Set();

function slimPayload(payload) {
  if (payload?.type !== "acoustic_model") return payload;

  return {
    type: payload.type,
    timestamp: payload.timestamp,
    shape: payload.shape,
    noiseMix: payload.noiseMix,
    timbre: payload.timbre,
    synthesis: payload.synthesis,
    chambers: payload.chambers,
    network: payload.network,
    superCollider: payload.superCollider,
  };
}

function sendToSuperCollider(payload) {
  if (payload?.type !== "acoustic_model") return;

  const slim = slimPayload(payload);
  const json = JSON.stringify(slim);
  const bytes = Buffer.byteLength(json, "utf8");

  if (bytes > MAX_OSC_BYTES) {
    console.warn(
      `[bridge → sc osc] payload too large (${bytes} bytes) — send aborted. Check bridge slimming.`
    );
    return;
  }

  oscClient.send(OSC_ADDRESS, json, (err) => {
    if (err) {
      console.warn(`[bridge → sc osc] ${err.message} (${bytes} bytes)`);
    } else {
      console.log(`[bridge → sc osc] ${bytes} bytes → udp://${SC_OSC_HOST}:${SC_OSC_PORT}${OSC_ADDRESS}`);
    }
  });
}

browserWss.on("connection", (ws) => {
  browserClients.add(ws);
  console.log("[browser] connected");

  ws.on("message", (raw) => {
    let parsed;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      parsed = { raw: raw.toString() };
    }

    const chambers = parsed.superCollider?.chambers?.length ?? parsed.chambers?.length ?? "?";
    console.log("[browser → sc]", parsed.type ?? "message", `(chambers: ${chambers})`);
    sendToSuperCollider(parsed);
  });

  ws.on("close", () => {
    browserClients.delete(ws);
    console.log("[browser] disconnected");
  });
});

console.log("Resonant Torus bridge running");
console.log(`  Browser:       ws://localhost:${BROWSER_PORT}`);
console.log(`  SuperCollider: osc udp://${SC_OSC_HOST}:${SC_OSC_PORT}${OSC_ADDRESS}`);
console.log("  Note:           SC must listen on UDP 57124 (re-eval ResonantTorus.scd)");
