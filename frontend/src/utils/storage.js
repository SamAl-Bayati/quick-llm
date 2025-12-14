export const STORAGE_KEYS = {
  selectedModelId: "selectedModelId",
  llmSettings: "llmSettings",
};

export function getSelectedModelId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.selectedModelId);
  } catch {
    return null;
  }
}

export function setSelectedModelId(modelId) {
  try {
    if (!modelId) {
      localStorage.removeItem(STORAGE_KEYS.selectedModelId);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.selectedModelId, modelId);
  } catch {
    // ignore
  }
}

export function getLlmSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.llmSettings);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setLlmSettings(settings) {
  try {
    if (!settings) {
      localStorage.removeItem(STORAGE_KEYS.llmSettings);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.llmSettings, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function clearAppLocalStorage() {
  try {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
