import { withTimeout } from "../lib/async";
import { resolveDevice } from "../lib/hardware";
import { configureTransformersEnv } from "../lib/transformersEnv";
import { cleanReply, extractGeneratedText } from "../lib/llmText";
import { LLM_TIMEOUTS } from "../lib/llmConstants";
import { REQUEST_TYPES, RESPONSE_TYPES } from "../lib/llmProtocol";

let generator = null;
let currentConfig = null;

let transformersPromise = null;
let activeGeneration = null;

function post(type, requestId, payload) {
  self.postMessage({ type, requestId, payload });
}

function getTransformers() {
  if (!transformersPromise) {
    transformersPromise = import("@huggingface/transformers");
  }
  return transformersPromise;
}

async function createGenerator({ modelId, dtype, device }) {
  const { pipeline, env } = await getTransformers();
  configureTransformersEnv(env);
  return pipeline("text-generation", modelId, { dtype, device });
}

function resetModel() {
  generator = null;
  currentConfig = null;
}

function requestAbort(targetRequestId) {
  if (!activeGeneration) return false;
  if (targetRequestId && activeGeneration.requestId !== targetRequestId) {
    return false;
  }
  activeGeneration.abort = true;
  return true;
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

  activeGeneration = { requestId, abort: false };

  let acc = "";

  try {
    const { TextStreamer } = await getTransformers();

    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (chunk) => {
        if (activeGeneration?.abort) throw new Error("ABORTED");
        if (typeof chunk !== "string" || chunk.length === 0) return;
        acc += chunk;
        post(RESPONSE_TYPES.TOKEN, requestId, { text: chunk, isFinal: false });
      },
    });

    const out = await withTimeout(
      generator(prompt, {
        max_new_tokens: maxNewTokens,
        temperature,
        do_sample: temperature > 0,
        return_full_text: false,
        repetition_penalty: 1.1,
        no_repeat_ngram_size: 3,
        streamer,
      }),
      LLM_TIMEOUTS.GENERATE_MS,
      "Generation timed out"
    );

    const streamed = cleanReply(acc, prompt);
    const fallback = cleanReply(extractGeneratedText(out, prompt), prompt);
    const text = streamed || fallback;

    if (!text) throw new Error("Empty generation result");

    post(RESPONSE_TYPES.DONE, requestId, { text, aborted: false });
  } catch (e) {
    const aborted =
      typeof e?.message === "string" && e.message.toUpperCase() === "ABORTED";

    if (aborted) {
      const text = cleanReply(acc, prompt);
      post(RESPONSE_TYPES.STATUS, requestId, {
        stage: "abort",
        message: "Aborted",
      });
      post(RESPONSE_TYPES.DONE, requestId, { text, aborted: true });
      return;
    }

    throw e;
  } finally {
    activeGeneration = null;
  }
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
      const targetRequestId = payload?.targetRequestId || null;
      const ok = requestAbort(targetRequestId);

      if (ok && targetRequestId) {
        post(RESPONSE_TYPES.STATUS, targetRequestId, {
          stage: "abort",
          message: "Stopping...",
        });
      } else {
        post(RESPONSE_TYPES.STATUS, requestId, {
          stage: "abort",
          message: "No active generation",
        });
      }
      return;
    }
  } catch (e) {
    post(RESPONSE_TYPES.ERROR, requestId, {
      message: e?.message || "Worker error",
      config: currentConfig,
    });
  }
};
