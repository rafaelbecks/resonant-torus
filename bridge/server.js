/**
 * WebSocket relay for Resonant Torus → SuperCollider / Node clients.
 *
 * Usage:
 *   npm run bridge
 *
 * Browser connects to ws://localhost:57120
 * SuperCollider connects to ws://localhost:57121 (or reads from stdout relay)
 */

import { WebSocketServer } from "ws";

const BROWSER_PORT = 57120;
const SC_PORT = 57121;

const browserWss = new WebSocketServer({ port: BROWSER_PORT });
const scWss = new WebSocketServer({ port: SC_PORT });

let browserClients = new Set();
let scClients = new Set();

function broadcast(clients, data, exclude = null) {
  const msg = typeof data === "string" ? data : JSON.stringify(data);
  for (const ws of clients) {
    if (ws !== exclude && ws.readyState === 1) ws.send(msg);
  }
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

    console.log("[browser → sc]", parsed.type ?? "message");
    broadcast(scClients, parsed);
  });

  ws.on("close", () => {
    browserClients.delete(ws);
    console.log("[browser] disconnected");
  });
});

scWss.on("connection", (ws) => {
  scClients.add(ws);
  console.log("[supercollider] connected");

  ws.on("message", (raw) => {
    let parsed;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      parsed = { raw: raw.toString() };
    }
    console.log("[sc → browser]", parsed);
    broadcast(browserClients, parsed);
  });

  ws.on("close", () => {
    scClients.delete(ws);
    console.log("[supercollider] disconnected");
  });
});

console.log(`Resonant Torus bridge running`);
console.log(`  Browser:       ws://localhost:${BROWSER_PORT}`);
console.log(`  SuperCollider: ws://localhost:${SC_PORT}`);
