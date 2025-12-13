const STORAGE_KEYS = {
  selectedModelId: "selectedModelId",
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
