export function configureTransformersEnv(env) {
  const wasm = env?.backends?.onnx?.wasm;
  if (!wasm) return;

  wasm.proxy = true;

  const hc =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 1 : 1;
  wasm.numThreads = globalThis.crossOriginIsolated
    ? Math.max(1, Math.min(4, hc - 1))
    : 1;
}
