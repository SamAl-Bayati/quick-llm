export function isWebGpuSupported() {
  if (typeof navigator === "undefined" || !navigator.gpu) return false;
  const ua = navigator.userAgent || "";
  if (ua.includes("Firefox")) return false;
  return true;
}

export function resolveDevice(preferred) {
  if (preferred === "webgpu" && !isWebGpuSupported()) return "wasm";
  return preferred || "wasm";
}
