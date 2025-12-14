const TASK_TEXT_GENERATION = "text-generation";
const TASK_VISION_LANGUAGE = "vision-language";

const MODELS_MANIFEST = [
  {
    id: "Xenova/distilgpt2",
    displayName: "DistilGPT-2 (tiny)",
    task: TASK_TEXT_GENERATION,
    recommended: true,
    defaultDtype: null,
    preferredDevice: "webgpu",
    approxDownloadMB: 80,
    notes:
      "Good starter model for quick demos. Falls back to WASM if WebGPU is unavailable.",
  },
  {
    id: "HuggingFaceTB/SmolLM2-135M-Instruct",
    displayName: "SmolLM2 135M (instruct)",
    task: TASK_TEXT_GENERATION,
    recommended: true,
    defaultDtype: null,
    preferredDevice: "webgpu",
    approxDownloadMB: 180,
    notes:
      "Better instruction-following than GPT-2 class models, still small enough for browser demos.",
  },
  {
    id: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
    displayName: "SmolLM2 1.7B (instruct)",
    task: TASK_TEXT_GENERATION,
    recommended: false,
    defaultDtype: "q4f16",
    preferredDevice: "webgpu",
    approxDownloadMB: 1150,
    notes:
      "Heavier but much stronger. Defaulting to q4f16 to keep downloads and memory reasonable. Desktop recommended.",
  },
  {
    id: "Xenova/gpt2",
    displayName: "GPT-2 (small)",
    task: TASK_TEXT_GENERATION,
    recommended: false,
    defaultDtype: null,
    preferredDevice: "webgpu",
    approxDownloadMB: 250,
    notes: "Classic baseline. Slower and heavier than DistilGPT-2.",
  },
  {
    id: "Xenova/gpt-neo-125M",
    displayName: "GPT-Neo 125M",
    task: TASK_TEXT_GENERATION,
    recommended: false,
    defaultDtype: null,
    preferredDevice: "webgpu",
    approxDownloadMB: 280,
    notes:
      "Slightly stronger than GPT-2 in some prompts. Still relatively small.",
  },
  // Visible for “wow factor”, disabled until we add image upload + VL pipeline wiring.
  {
    id: "Qwen/Qwen3-VL-2B-Instruct",
    displayName: "Qwen3-VL 2B (instruct)",
    task: TASK_VISION_LANGUAGE,
    recommended: false,
    enabled: false,
    defaultDtype: "q4f16",
    preferredDevice: "webgpu",
    approxDownloadMB: null,
    notes:
      "Vision-language model. Disabled for now since the UI is text-only (needs image input + processor).",
  },
  {
    id: "Qwen/Qwen3-VL-2B-Thinking",
    displayName: "Qwen3-VL 2B (thinking)",
    task: TASK_VISION_LANGUAGE,
    recommended: false,
    enabled: false,
    defaultDtype: "q4f16",
    preferredDevice: "webgpu",
    approxDownloadMB: null,
    notes:
      "Vision-language model. Disabled for now since the UI is text-only (needs image input + processor).",
  },
];

module.exports = {
  MODELS_MANIFEST,
};
