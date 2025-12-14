import { withTimeout } from "../lib/async";
import { resolveDevice } from "../lib/hardware";
import { configureTransformersEnv } from "../lib/transformersEnv";
import { cleanReply, extractGeneratedText } from "../lib/llmText";
import { LLM_TIMEOUTS } from "../lib/llmConstants";
import { REQUEST_TYPES, RESPONSE_TYPES } from "../lib/llmProtocol";

let generator = null;
let currentConfig = null;

function post(type, requestId, payload) {
  self.postMessage({ type, requestId, payload });
}

async function createGenerator({ modelId, dtype, device }) {
  const { pipeline, env } = await import("@huggingface/transformers");
  configureTransformersEnv(env);

  return pipeline("text-generation", modelId, { dtype, device });
}

function resetModel() {
  generator = null;
  currentConfig = null;
}

async function initModel({ modelId, dtype, device }, requestId) {
  if (!modelId) throw new Error("modelId is required");

  resetModel();

  const resolvedDevice = resolveDevice(device);
  const preferred = { modelId, dtype, device: resolvedDevice };
  const fallback = { modelId, dtype: undefined, device: "wasm" };

  post(RESPONSE_TYPES.STATUS, requestId, {
    stage: "init",
    message: `Initializing (${preferred.device})`,
  });

  try {
    generator = await withTimeout(
      createGenerator(preferred),
      LLM_TIMEOUTS.INIT_MS,
      "Model initialization timed out"
    );
    currentConfig = preferred;
    return currentConfig;
  } catch {
    post(RESPONSE_TYPES.STATUS, requestId, {
      stage: "init",
      message: "Falling back to WASM",
    });

    generator = await withTimeout(
      createGenerator(fallback),
      LLM_TIMEOUTS.INIT_MS,
      "Model initialization timed out (fallback)"
    );
    currentConfig = fallback;
    return currentConfig;
  }
}

async function runGenerate({ prompt, maxNewTokens, temperature }, requestId) {
  if (!generator) throw new Error("Model not initialized");

  post(RESPONSE_TYPES.STATUS, requestId, {
    stage: "generate",
    message: "Generating",
  });

  const out = await withTimeout(
    generator(prompt, {
      max_new_tokens: maxNewTokens,
      temperature,
      do_sample: temperature > 0,
      return_full_text: false,
      repetition_penalty: 1.1,
      no_repeat_ngram_size: 3,
    }),
    LLM_TIMEOUTS.GENERATE_MS,
    "Generation timed out"
  );

  const text = cleanReply(extractGeneratedText(out, prompt), prompt);
  if (!text) throw new Error("Empty generation result");

  post(RESPONSE_TYPES.TOKEN, requestId, { text, isFinal: true });
  post(RESPONSE_TYPES.DONE, requestId, { text });
}

self.onmessage = async (evt) => {
  const msg = evt?.data || {};
  const { type, requestId, payload } = msg;

  try {
    if (type === REQUEST_TYPES.INIT) {
      const config = await initModel(payload || {}, requestId);
      post(RESPONSE_TYPES.READY, requestId, { config });
      return;
    }

    if (type === REQUEST_TYPES.GENERATE) {
      await runGenerate(payload || {}, requestId);
      return;
    }

    if (type === REQUEST_TYPES.ABORT) {
      post(RESPONSE_TYPES.STATUS, requestId, {
        stage: "abort",
        message: "Abort requested",
      });
      return;
    }
  } catch (e) {
    post(RESPONSE_TYPES.ERROR, requestId, {
      message: e?.message || "Worker error",
      config: currentConfig,
    });
  }
};
