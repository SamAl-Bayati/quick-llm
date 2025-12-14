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

function postInitStatus(requestId, step, message, percent) {
  const payload = { stage: "init", step, message };
  if (typeof percent === "number" && Number.isFinite(percent)) {
    payload.percent = Math.max(0, Math.min(100, Math.round(percent)));
  }
  post(RESPONSE_TYPES.STATUS, requestId, payload);
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

function parseProgressPercent(p) {
  if (!p) return null;
  if (typeof p === "number") {
    if (p > 1 && p <= 100) return p;
    if (p >= 0 && p <= 1) return p * 100;
    return null;
  }

  const obj = typeof p === "object" ? p : null;
  const progress = obj?.progress;
  if (typeof progress === "number") {
    if (progress > 1 && progress <= 100) return progress;
    if (progress >= 0 && progress <= 1) return progress * 100;
  }

  const loaded = obj?.loaded;
  const total = obj?.total;
  if (typeof loaded === "number" && typeof total === "number" && total > 0) {
    return (loaded / total) * 100;
  }

  return null;
}

function toErrText(e) {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (typeof e?.message === "string") return e.message;
  return String(e);
}

function isMissingFileError(e) {
  const msg = toErrText(e).toLowerCase();
  return msg.includes("could not locate file");
}

function unique(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function buildWasmDtypeFallbacks(requested) {
  const r = requested || null;

  if (r === "q8") return ["int8", "uint8", "q4", "q4f16"];
  if (r === "q4") return ["q4f16", "bnb4", "int8", "uint8"];

  return ["int8", "uint8", "q4", "q4f16", "bnb4"];
}

function dtypeLabel(dtype) {
  return dtype ? dtype : "auto";
}

async function createGenerator({ modelId, dtype, device, onProgress }) {
  const { pipeline, env } = await getTransformers();
  configureTransformersEnv(env);
  return pipeline("text-generation", modelId, {
    dtype,
    device,
    progress_callback:
      typeof onProgress === "function" ? onProgress : undefined,
  });
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

async function warmup(requestId) {
  if (!generator) return;
  const prompt = "User: hi\nAssistant:";
  await withTimeout(
    generator(prompt, {
      max_new_tokens: 1,
      temperature: 0,
      do_sample: false,
      return_full_text: false,
    }),
    LLM_TIMEOUTS.WARMUP_MS,
    "Warmup timed out"
  );
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

  postInitStatus(requestId, "fetch", "Fetching model files…");

  try {
    let lastPercent = -1;
    let lastTs = 0;

    generator = await withTimeout(
      createGenerator({
        ...preferred,
        onProgress: (p) => {
          const percent = parseProgressPercent(p);
          if (percent == null) return;
          const now = Date.now();
          const rounded = Math.round(percent);
          if (rounded === lastPercent && now - lastTs < 250) return;
          lastPercent = rounded;
          lastTs = now;
          postInitStatus(requestId, "fetch", "Fetching model files…", rounded);
        },
      }),
      LLM_TIMEOUTS.INIT_MS,
      "Model initialization timed out"
    );

    postInitStatus(requestId, "runtime", "Initializing runtime…");
    postInitStatus(requestId, "warmup", "Warming up…");
    await warmup(requestId);

    currentConfig = preferred;
    return currentConfig;
  } catch (e) {
    if (preferred.device === "wasm" && isMissingFileError(e)) {
      const fallbacks = unique(buildWasmDtypeFallbacks(preferred.dtype));

      for (const dt of fallbacks) {
        post(RESPONSE_TYPES.STATUS, requestId, {
          stage: "init",
          step: "fetch",
          message: `Fetching model files… (dtype ${dtypeLabel(dt)})`,
        });

        try {
          generator = await withTimeout(
            createGenerator({
              modelId: preferred.modelId,
              dtype: dt,
              device: "wasm",
            }),
            LLM_TIMEOUTS.INIT_MS,
            "Model initialization timed out"
          );

          post(RESPONSE_TYPES.BANNER, requestId, {
            message: `Requested dtype "${dtypeLabel(
              preferred.dtype
            )}" not available for this model. Using "${dt}"`,
            from: dtypeLabel(preferred.dtype),
            to: dt,
          });

          postInitStatus(requestId, "runtime", "Initializing runtime…");
          postInitStatus(requestId, "warmup", "Warming up…");
          await warmup(requestId);

          currentConfig = { ...preferred, dtype: dt, device: "wasm" };
          return currentConfig;
        } catch (e2) {
          if (!isMissingFileError(e2)) throw e2;
        }
      }
    }

    const shouldFallback = preferred.device !== "wasm";
    if (!shouldFallback) throw e;

    post(RESPONSE_TYPES.BANNER, requestId, {
      message: "Fell back to CPU (WASM)",
      from: preferred.device,
      to: "wasm",
    });

    postInitStatus(requestId, "runtime", "Initializing runtime…");

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
