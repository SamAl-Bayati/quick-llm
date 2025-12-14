import { withTimeout } from "./async";
import { resolveDevice } from "./hardware";
import { configureTransformersEnv } from "./transformersEnv";

const INIT_TIMEOUT_MS = 120_000;
const GENERATE_TIMEOUT_MS = 120_000;

let generator = null;
let currentConfig = null;

function stripPromptPrefix(fullText, prompt) {
  if (typeof fullText !== "string") return "";
  const text = fullText.startsWith(prompt)
    ? fullText.slice(prompt.length)
    : fullText;
  return text.trim();
}

function extractGeneratedText(output, prompt) {
  if (typeof output === "string") return stripPromptPrefix(output, prompt);

  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string") return stripPromptPrefix(first, prompt);
    if (first && typeof first.generated_text === "string") {
      return stripPromptPrefix(first.generated_text, prompt);
    }
    if (first && typeof first.text === "string") {
      return stripPromptPrefix(first.text, prompt);
    }
  }

  if (output && typeof output.generated_text === "string") {
    return stripPromptPrefix(output.generated_text, prompt);
  }

  return "";
}

function cleanReply(text, prompt) {
  if (typeof text !== "string") return "";
  let t = text.replace(/\r/g, "").trim();

  t = t.replace(/^\s*(assistant|answer)\s*:\s*/i, "");
  t = t.replace(/\n\s*(assistant|answer)\s*:\s*/gi, "\n");

  t = t.split(/\n\s*(user|assistant|question)\s*:\s*/i)[0].trim();

  const m =
    typeof prompt === "string"
      ? prompt.match(/User:\s*([\s\S]*?)\nAssistant:\s*$/i)
      : null;
  const echoed = m?.[1]?.trim();
  if (echoed && t.toLowerCase().startsWith(echoed.toLowerCase())) {
    t = t.slice(echoed.length).trim();
  }

  return t;
}

async function createGenerator({ modelId, dtype, device }) {
  const { pipeline, env } = await import("@huggingface/transformers");
  configureTransformersEnv(env);

  return pipeline("text-generation", modelId, {
    dtype,
    device,
  });
}

async function createWasmGenerator({ modelId }) {
  return createGenerator({ modelId, dtype: undefined, device: "wasm" });
}

export function resetModel() {
  generator = null;
  currentConfig = null;
}

export function getCurrentModelConfig() {
  return currentConfig;
}

export async function initModel({ modelId, dtype, device }) {
  if (!modelId) throw new Error("modelId is required");

  resetModel();

  const resolvedDevice = resolveDevice(device);
  const preferred = { modelId, dtype, device: resolvedDevice };
  const fallback = { modelId, dtype: undefined, device: "wasm" };

  try {
    generator = await withTimeout(
      createGenerator(preferred),
      INIT_TIMEOUT_MS,
      "Model initialization timed out"
    );
    currentConfig = preferred;
    return currentConfig;
  } catch (e) {
    generator = await withTimeout(
      createGenerator(fallback),
      INIT_TIMEOUT_MS,
      "Model initialization timed out (fallback)"
    );
    currentConfig = fallback;
    return currentConfig;
  }
}

export async function generate({
  prompt,
  maxNewTokens = 32,
  temperature = 0.4,
}) {
  if (!generator) throw new Error("Model not initialized");

  async function run() {
    return generator(prompt, {
      max_new_tokens: maxNewTokens,
      temperature,
      do_sample: temperature > 0,
      return_full_text: false,
      repetition_penalty: 1.1,
      no_repeat_ngram_size: 3,
    });
  }

  try {
    const out = await withTimeout(
      run(),
      GENERATE_TIMEOUT_MS,
      "Generation timed out"
    );
    const text = cleanReply(extractGeneratedText(out, prompt), prompt);
    if (!text) throw new Error("Empty generation result");
    return text;
  } catch (e) {
    const isTimeout =
      typeof e?.message === "string" &&
      e.message.toLowerCase().includes("timed out");
    if (isTimeout) {
      throw e;
    }

    const prevConfig = currentConfig;
    const shouldFallback = prevConfig?.device && prevConfig.device !== "wasm";
    if (!shouldFallback) throw e;

    resetModel();
    generator = await withTimeout(
      createWasmGenerator({ modelId: prevConfig.modelId }),
      INIT_TIMEOUT_MS,
      "Model reinit timed out (WASM fallback)"
    );
    currentConfig = {
      modelId: prevConfig.modelId,
      dtype: undefined,
      device: "wasm",
    };

    const out2 = await withTimeout(
      run(),
      GENERATE_TIMEOUT_MS,
      "Generation timed out (WASM fallback)"
    );
    const text2 = cleanReply(extractGeneratedText(out2, prompt), prompt);
    if (!text2) throw new Error("Empty generation result");
    return text2;
  }
}
