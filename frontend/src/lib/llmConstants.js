export const LLM_TIMEOUTS = {
  INIT_MS: 120_000,
  GENERATE_MS: 120_000,
  WARMUP_MS: 60_000,
};

export const DTYPE_OPTIONS = [
  "auto",
  "q4f16",
  "q4",
  "q8",
  "int8",
  "uint8",
  "bnb4",
];

export const SETTINGS_DEFAULTS = {
  dtype: "auto",
  maxNewTokens: 128,
  temperature: 0.7,
};

export const GENERATION_DEFAULTS = {
  MAX_NEW_TOKENS: SETTINGS_DEFAULTS.maxNewTokens,
  TEMPERATURE: SETTINGS_DEFAULTS.temperature,
};

export const INIT_PROGRESS_STEPS = [
  { key: "fetch", label: "Fetching model files…" },
  { key: "runtime", label: "Initializing runtime…" },
  { key: "warmup", label: "Warming up…" },
];

export const LLM_QUALITY = {
  MIN_PRINTABLE_RATIO: 0.7,
  MIN_LETTER_RATIO: 0.35,
};
