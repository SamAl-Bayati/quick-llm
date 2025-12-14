export const LLM_TIMEOUTS = {
  INIT_MS: 120_000,
  GENERATE_MS: 120_000,
};

export const DTYPE_OPTIONS = ["q4", "q8"];

export const SETTINGS_DEFAULTS = {
  dtype: "q8",
  maxNewTokens: 32,
  temperature: 0.4,
};

export const GENERATION_DEFAULTS = {
  MAX_NEW_TOKENS: SETTINGS_DEFAULTS.maxNewTokens,
  TEMPERATURE: SETTINGS_DEFAULTS.temperature,
};

export const LLM_QUALITY = {
  MIN_PRINTABLE_RATIO: 0.7,
  MIN_LETTER_RATIO: 0.35,
};
