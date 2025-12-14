import { DTYPE_OPTIONS, SETTINGS_DEFAULTS } from "./llmConstants";
import { getLlmSettings, setLlmSettings } from "../utils/storage";

function clampNumber(v, min, max, fallback) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeSettings(input) {
  const obj = input && typeof input === "object" ? input : {};
  const dtype = DTYPE_OPTIONS.includes(obj.dtype)
    ? obj.dtype
    : SETTINGS_DEFAULTS.dtype;

  const maxNewTokens = clampNumber(
    obj.maxNewTokens,
    1,
    512,
    SETTINGS_DEFAULTS.maxNewTokens
  );

  const temperature = clampNumber(
    obj.temperature,
    0,
    2,
    SETTINGS_DEFAULTS.temperature
  );

  return { dtype, maxNewTokens, temperature };
}

export function loadSettings() {
  const stored = getLlmSettings();
  return normalizeSettings({ ...SETTINGS_DEFAULTS, ...(stored || {}) });
}

export function saveSettings(next) {
  const normalized = normalizeSettings(next);
  setLlmSettings(normalized);
  return normalized;
}
