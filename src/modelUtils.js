/** Whether a scene should skip GLB loading. */
export function isNoModel(name) {
  return name == null || name === "" || name === "none";
}
