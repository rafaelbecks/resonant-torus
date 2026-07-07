/** Send model-sample.json to SuperCollider (UDP 57124). Run while SC patch is loaded. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "node-osc";

const SC_OSC_PORT = 57124;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const samplePath = join(root, "model-sample.json");

const payload = JSON.parse(readFileSync(samplePath, "utf8"));
const json = JSON.stringify(payload);
const client = new Client("127.0.0.1", SC_OSC_PORT);

client.send("/resonant_torus/model", json, (err) => {
  if (err) {
    console.error("send failed:", err.message);
    process.exit(1);
  }
  const chambers = payload.superCollider?.chambers?.length ?? 0;
  console.log(`sent ${json.length} bytes (${chambers} chambers) → udp://127.0.0.1:${SC_OSC_PORT}/resonant_torus/model`);
  console.log("SC post window should show: RT OSC recv / RT OSC model OK");
  process.exit(0);
});
