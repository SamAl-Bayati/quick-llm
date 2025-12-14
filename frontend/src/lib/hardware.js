import { DEVICE, getPreferredDevice } from "../utils/device";

export function isWebGpuSupported() {
  return getPreferredDevice() === DEVICE.WEBGPU;
}

export function resolveDevice(preferred) {
  if (!preferred || preferred === "auto") return getPreferredDevice();
  if (preferred === DEVICE.WEBGPU) return getPreferredDevice();
  return preferred;
}
