import { bootApp } from "./app.js";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch((err) => {
    console.warn("Service worker registration failed:", err);
  });
}

bootApp().catch((err) => {
  console.error("Failed to boot Resonant Organisms:", err);
});
