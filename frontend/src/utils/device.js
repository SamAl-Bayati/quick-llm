export const DEVICE = {
  WEBGPU: "webgpu",
  WASM: "wasm",
};

let webgpuProbe = null;
let preferredDeviceCache = null;

function canUseWebGpuSync() {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  if (typeof navigator === "undefined") return false;
  return typeof navigator.gpu?.requestAdapter === "function";
}

export async function probeWebGpu() {
  if (typeof navigator === "undefined") return false;
  if (!navigator.gpu?.requestAdapter) return false;

  if (webgpuProbe) return webgpuProbe;

  webgpuProbe = (async () => {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return Boolean(adapter);
    } catch {
      return false;
    }
  })();

  return webgpuProbe;
}

export function getPreferredDevice() {
  if (preferredDeviceCache) return preferredDeviceCache;
  preferredDeviceCache = canUseWebGpuSync() ? DEVICE.WEBGPU : DEVICE.WASM;
  return preferredDeviceCache;
}
