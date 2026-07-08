import { bootApp } from "./app.js";

const isLocalDev =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.hostname === "[::1]";

async function purgeServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((reg) => reg.unregister()));

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  } catch (err) {
    console.warn("Service worker registration failed:", err);
  }
}

if (isLocalDev) {
  purgeServiceWorker().catch((err) => {
    console.warn("Service worker purge failed:", err);
  });
} else {
  registerServiceWorker();
}

bootApp().catch((err) => {
  console.error("Failed to boot Resonant Organisms:", err);
});
