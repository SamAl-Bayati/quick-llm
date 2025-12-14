export function configureTransformersEnv(env) {
  const wasm = env?.backends?.onnx?.wasm;
  if (!wasm) return;

  const isWorker = typeof window === "undefined" && typeof self !== "undefined";
  wasm.proxy = !isWorker;

  const hc =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 1 : 1;
  wasm.numThreads = globalThis.crossOriginIsolated
    ? Math.max(1, Math.min(4, hc - 1))
    : 1;
}
