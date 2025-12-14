import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import ModelSelect from "./ModelSelect";
import { DTYPE_OPTIONS, SETTINGS_DEFAULTS } from "../lib/llmConstants";
import {
  clearAppCaches,
  estimateStorage,
  listCacheNames,
  STORAGE_ESTIMATE_STATUS,
} from "../utils/cache";
import { clearAppLocalStorage } from "../utils/storage";
import { formatBytes } from "../utils/format";

function manualClearInstructions() {
  return [
    "Some model files may be cached by the runtime and cannot always be removed programmatically.",
    "If you still see instant loads after clearing, manually clear site data for this origin.",
    "Chrome: Site settings → Storage → Clear data",
    "Firefox: Settings → Privacy & Security → Cookies and Site Data → Manage Data… → Remove",
  ];
}

function SettingsModal({
  open,
  onClose,
  models,
  modelsLoading,
  selectedModelId,
  onSelectModelId,
  settings,
  onChangeSettings,
  onResetSettings,
  onBeforeClear,
  onCleared,
}) {
  const s = settings || SETTINGS_DEFAULTS;

  const [storageInfo, setStorageInfo] = useState(null);
  const [cacheNames, setCacheNames] = useState([]);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState(null);

  async function refreshStorage() {
    const names = await listCacheNames();
    const est = await estimateStorage(names);
    setCacheNames(Array.isArray(names) ? names : []);
    setStorageInfo(est);
  }

  useEffect(() => {
    if (!open) return;
    refreshStorage();
  }, [open]);

  const storageText = useMemo(() => {
    const info = storageInfo;
    if (!info) return "Unavailable";
    if (info.status !== STORAGE_ESTIMATE_STATUS.OK) return "Unavailable";

    const usageKnown = typeof info.usageBytes === "number";
    const quotaKnown = typeof info.quotaBytes === "number";

    const usage = formatBytes(info.usageBytes);
    const quota = formatBytes(info.quotaBytes);

    if (!usageKnown && !quotaKnown) return "Unavailable";
    if (!quotaKnown) return usageKnown ? usage : "Unknown";
    if (!usageKnown) return `0 B of ${quota}`;
    return `${usage} of ${quota}`;
  }, [storageInfo]);

  const storageNote = useMemo(() => {
    const info = storageInfo;
    if (!info) return null;
    if (info.status !== STORAGE_ESTIMATE_STATUS.OK) return info.reason || null;
    if (info.source === "cache-headers")
      return "Approximate, based on app cache response headers only.";
    return null;
  }, [storageInfo]);

  async function handleClearCache() {
    if (clearing) return;
    setClearing(true);
    setResult(null);

    try {
      onBeforeClear?.();

      const cacheRes = await clearAppCaches();
      clearAppLocalStorage();
      await refreshStorage();

      setResult({
        deletedCaches: cacheRes.deleted || [],
        keptCaches: cacheRes.kept || [],
      });

      onCleared?.();
    } finally {
      setClearing(false);
    }
  }

  function update(patch) {
    onChangeSettings?.(patch);
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="q-section">
        <div className="q-sectionTitle">Model</div>
        <div className="q-actions">
          <ModelSelect
            models={models}
            value={selectedModelId}
            disabled={modelsLoading || !models || models.length === 0}
            onChange={(id) => onSelectModelId?.(id)}
          />
        </div>
      </div>

      <div className="q-section">
        <div className="q-sectionTitle">Generation</div>

        <div className="q-field" style={{ marginBottom: 10 }}>
          <label>dtype</label>
          <select
            value={s.dtype}
            onChange={(e) => update({ dtype: e.target.value })}
          >
            {DTYPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <div className="q-note">Applies on next initialize</div>
        </div>

        <div className="q-grid2">
          <div className="q-field">
            <label>max tokens</label>
            <input
              className="q-noSpin"
              type="number"
              min={1}
              max={1024}
              value={s.maxNewTokens}
              onChange={(e) => update({ maxNewTokens: e.target.value })}
            />
          </div>

          <div className="q-field">
            <label>temperature</label>
            <input
              className="q-noSpin"
              type="number"
              step="0.05"
              min={0}
              max={2}
              value={s.temperature}
              onChange={(e) => update({ temperature: e.target.value })}
            />
          </div>
        </div>

        <div className="q-actions" style={{ marginTop: 12 }}>
          <button
            className="q-btn"
            type="button"
            onClick={() => onResetSettings?.()}
          >
            Reset defaults
          </button>
        </div>
      </div>

      <div className="q-section">
        <div className="q-sectionTitle">Storage</div>

        <div style={{ opacity: 0.9, fontSize: 13 }}>
          <div>
            <strong>Estimated used:</strong> {storageText}
          </div>
          {storageNote && <div className="q-note">{storageNote}</div>}
          <div style={{ marginTop: 6, opacity: 0.85 }}>
            <strong>Cache Storage entries:</strong> {cacheNames.length}
          </div>
        </div>

        <div className="q-actions" style={{ marginTop: 12 }}>
          <button
            className="q-btn q-btn-accent"
            type="button"
            onClick={handleClearCache}
            disabled={clearing}
          >
            {clearing ? "Clearing..." : "Clear cache"}
          </button>
        </div>

        {result && (
          <div
            style={{
              marginTop: 12,
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
            }}
          >
            <div style={{ opacity: 0.9, fontSize: 13 }}>
              <strong>Cleared:</strong> {result.deletedCaches.length} cache
              entries
            </div>

            {result.keptCaches.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 600, opacity: 0.9, fontSize: 13 }}>
                  Note
                </div>
                {manualClearInstructions().map((line) => (
                  <div key={line} className="q-note" style={{ marginTop: 6 }}>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default SettingsModal;
