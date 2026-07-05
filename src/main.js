import { bootApp } from "./app.js";

bootApp().catch((err) => {
  console.error("Failed to boot Resonant Torus:", err);
});
