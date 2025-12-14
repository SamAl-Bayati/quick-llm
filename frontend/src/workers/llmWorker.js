import { withTimeout } from "../lib/async";
import { configureTransformersEnv } from "../lib/transformersEnv";
import { cleanReply, extractGeneratedText } from "../lib/llmText";
import { LLM_TIMEOUTS } from "../lib/llmConstants";
import {
  REQUEST_TYPES,
  RESPONSE_TYPES,
  ERROR_ACTIONS,
} from "../lib/llmProtocol";
import {
  normalizeDtypeForDevice,
  isProbablyGarbledText,
} from "../lib/llmDevice";

let generator = null;
let currentConfig = null;

let transformersPromise = null;
let activeGeneration = null;

function post(type, requestId, payload) {
  self.postMessage({ type, requestId, payload });
}

function serializeError(e) {
  if (!e) return { message: "Unknown error" };
  if (typeof e === "number") {
    return { message: `ORT init failed (code ${e})` };
  }
  if (e instanceof Error) {
    return {
      message: `${e.name}: ${e.message}`,
      stack: e.stack || "",
      action: e.action || null,
    };
  }
  if (typeof e === "string") return { message: e };
  try {
    const obj = e && typeof e === "object" ? e : null;
    return {
      message: obj?.message ? String(obj.message) : JSON.stringify(e),
      action: obj?.action || null,
    };
  } catch {
    return { message: String(e) };
  }
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

  const requestedDevice = device || "wasm";
  const normalizedDtype = normalizeDtypeForDevice({
    dtype,
    device: requestedDevice,
  });

  const preferred = {
    modelId,
    dtype: normalizedDtype,
    device: requestedDevice,
  };

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
  } catch (e) {
    const shouldFallback = preferred.device !== "wasm";
    if (!shouldFallback) throw e;

    post(RESPONSE_TYPES.BANNER, requestId, {
      message: "Fell back to CPU (WASM)",
      from: preferred.device,
      to: "wasm",
    });

    post(RESPONSE_TYPES.STATUS, requestId, {
      stage: "init",
      message: "Restarting for WASM fallback",
    });

    const err = new Error(
      "WebGPU init failed, retry on WASM in a fresh worker"
    );
    err.action = ERROR_ACTIONS.RESTART_WASM;
    throw err;
  }
}

async function runGenerate({ prompt, maxNewTokens, temperature }, requestId) {
  if (!generator) throw new Error("Model not initialized");

  post(RESPONSE_TYPES.STATUS, requestId, {
    stage: "generate",
    message: "Generating",
  });

  activeGeneration = { requestId, abort: false };

  async function generateOnce({ streamTokens }) {
    let acc = "";

    const { TextStreamer } = await getTransformers();

    const streamer = streamTokens
      ? new TextStreamer(generator.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (chunk) => {
            if (activeGeneration?.abort) throw new Error("ABORTED");
            if (typeof chunk !== "string" || chunk.length === 0) return;
            acc += chunk;
            post(RESPONSE_TYPES.TOKEN, requestId, {
              text: chunk,
              isFinal: false,
            });
          },
        })
      : null;

    const out = await withTimeout(
      generator(prompt, {
        max_new_tokens: maxNewTokens,
        temperature,
        do_sample: temperature > 0,
        return_full_text: false,
        repetition_penalty: 1.1,
        no_repeat_ngram_size: 3,
        streamer: streamer || undefined,
      }),
      LLM_TIMEOUTS.GENERATE_MS,
      "Generation timed out"
    );

    const streamed = cleanReply(acc, prompt);
    const fallback = cleanReply(extractGeneratedText(out, prompt), prompt);
    const text = streamed || fallback;

    return { text, streamedText: streamed };
  }

  try {
    const first = await generateOnce({ streamTokens: true });

    const aborted =
      typeof first?.text === "string" && activeGeneration?.abort === true;

    if (aborted) {
      post(RESPONSE_TYPES.STATUS, requestId, {
        stage: "abort",
        message: "Aborted",
      });
      post(RESPONSE_TYPES.DONE, requestId, {
        text: cleanReply(first.text, prompt),
        aborted: true,
      });
      return;
    }

    const text = first?.text || "";
    if (!text) throw new Error("Empty generation result");

    const shouldQualityFallback =
      currentConfig?.device === "webgpu" && isProbablyGarbledText(text);

    if (!shouldQualityFallback) {
      post(RESPONSE_TYPES.DONE, requestId, { text, aborted: false });
      return;
    }

    post(RESPONSE_TYPES.BANNER, requestId, {
      message: "WebGPU output looked corrupted. Fell back to CPU (WASM)",
      from: "webgpu",
      to: "wasm",
    });

    post(RESPONSE_TYPES.STATUS, requestId, {
      stage: "generate",
      message: "Retrying on WASM",
    });

    const fallbackModelId = currentConfig?.modelId;
    if (!fallbackModelId) throw new Error("Missing modelId for WASM fallback");

    resetModel();

    const wasmDtype = normalizeDtypeForDevice({
      dtype: undefined,
      device: "wasm",
    });

    generator = await withTimeout(
      createGenerator({
        modelId: fallbackModelId,
        dtype: wasmDtype,
        device: "wasm",
      }),
      LLM_TIMEOUTS.INIT_MS,
      "Model reinit timed out (WASM fallback)"
    );

    currentConfig = {
      modelId: fallbackModelId,
      dtype: wasmDtype,
      device: "wasm",
    };

    const second = await generateOnce({ streamTokens: false });
    const text2 = second?.text || "";
    if (!text2) throw new Error("Empty generation result");

    post(RESPONSE_TYPES.DONE, requestId, { text: text2, aborted: false });
  } catch (e) {
    const aborted =
      typeof e?.message === "string" && e.message.toUpperCase() === "ABORTED";

    if (aborted) {
      post(RESPONSE_TYPES.STATUS, requestId, {
        stage: "abort",
        message: "Aborted",
      });
      post(RESPONSE_TYPES.DONE, requestId, { text: "", aborted: true });
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
    const err = serializeError(e);
    post(RESPONSE_TYPES.ERROR, requestId, {
      message: err.message,
      stack: err.stack,
      action: err.action || null,
      config: currentConfig,
    });
  }
};
