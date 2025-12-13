const TASK_TEXT_GENERATION = "text-generation";

const MODELS_MANIFEST = [
  {
    id: "Xenova/distilgpt2",
    displayName: "DistilGPT-2 (tiny)",
    task: TASK_TEXT_GENERATION,
    defaultDtype: "q8",
    preferredDevice: "webgpu",
    approxDownloadMB: 80,
    notes:
      "Good starter model for quick demos. Falls back to WASM if WebGPU is unavailable.",
  },
];

module.exports = {
  MODELS_MANIFEST,
};
