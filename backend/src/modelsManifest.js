const TASK_TEXT_GENERATION = "text-generation";
const TASK_VISION_LANGUAGE = "vision-language";

const MODELS_MANIFEST = [
  {
    id: "onnx-community/Qwen3-0.6B-ONNX",
    displayName: "Qwen3 0.6B",
    task: TASK_TEXT_GENERATION,
    recommended: false,
    defaultDtype: "q4f16",
    preferredDevice: "webgpu",
    approxDownloadMB: null,
    notes:
      "Smallest web-ready option. Great for fast loads and low-memory devices.",
  },
  {
    id: "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",
    displayName: "DeepSeek R1 Distill 1.5B",
    task: TASK_TEXT_GENERATION,
    recommended: false,
    defaultDtype: "q4f16",
    preferredDevice: "webgpu",
    approxDownloadMB: null,
    notes: "Flagship phone tier. Small reasoning-focused model.",
  },
  {
    id: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
    displayName: "SmolLM2 1.7B",
    task: TASK_TEXT_GENERATION,
    recommended: true,
    defaultDtype: "q4f16",
    preferredDevice: "webgpu",
    approxDownloadMB: 1150,
    notes: "Great default for iGPU and light dGPU laptops.",
  },
  {
    id: "onnx-community/Qwen3-4B-Instruct-2507-ONNX",
    displayName: "Qwen3 4B",
    task: TASK_TEXT_GENERATION,
    recommended: false,
    defaultDtype: "q4f16",
    preferredDevice: "webgpu",
    approxDownloadMB: null,
    notes: "Good laptop default if memory allows.",
  },
];

module.exports = {
  MODELS_MANIFEST,
};
