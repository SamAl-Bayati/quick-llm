const ORT_WASM_BASE = `${import.meta.env.BASE_URL}ort/`;

export function configureTransformersEnv(env) {
  const wasm = env?.backends?.onnx?.wasm;
  if (!wasm) return;

  wasm.wasmPaths = ORT_WASM_BASE;
  wasm.proxy = false;
  wasm.numThreads = 1;
}
