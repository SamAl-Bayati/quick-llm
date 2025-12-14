const TASK_TEXT_GENERATION = "text-generation";

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
];

module.exports = {
  MODELS_MANIFEST,
};
