import { useEffect, useMemo, useState } from "react";
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

function StoragePanel({ onCleared, onBeforeClear }) {
  const [info, setInfo] = useState(null);
  const [cacheNames, setCacheNames] = useState([]);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState(null);

  async function refresh() {
    const names = await listCacheNames();
    const est = await estimateStorage(names);
    setInfo(est);
    setCacheNames(Array.isArray(names) ? names : []);
  }

  useEffect(() => {
    refresh();
  }, []);

  const storageText = useMemo(() => {
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
  }, [info]);

  const storageNote = useMemo(() => {
    if (!info) return null;
    if (info.status !== STORAGE_ESTIMATE_STATUS.OK) return info.reason || null;
    if (info.source === "cache-headers") {
      return "Approximate, based on app cache response headers only.";
    }
    return null;
  }, [info]);

  async function handleClear() {
    if (clearing) return;
    setClearing(true);
    setResult(null);

    try {
      if (typeof onBeforeClear === "function") onBeforeClear();

      const cacheRes = await clearAppCaches();
      clearAppLocalStorage();

      await refresh();

      setResult({
        deletedCaches: cacheRes.deleted || [],
        keptCaches: cacheRes.kept || [],
      });

      if (typeof onCleared === "function") onCleared();
    } finally {
      setClearing(false);
    }
  }

  return (
    <section
      style={{
        marginTop: "1rem",
        padding: "1.5rem",
        borderRadius: "0.75rem",
        background: "rgba(15, 23, 42, 0.9)",
        border: "1px solid rgba(148, 163, 184, 0.4)",
        maxWidth: "40rem",
        textAlign: "left",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Storage</h2>

      <div style={{ opacity: 0.9 }}>
        <div>
          <strong>Estimated storage used:</strong> {storageText}
        </div>
        {storageNote && (
          <div
            style={{ marginTop: "0.25rem", opacity: 0.75, fontSize: "0.9rem" }}
          >
            {storageNote}
          </div>
        )}
        <div style={{ marginTop: "0.25rem", opacity: 0.85 }}>
          <strong>Cache Storage entries:</strong> {cacheNames.length}
        </div>
      </div>

      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
        <button type="button" onClick={handleClear} disabled={clearing}>
          {clearing ? "Clearing…" : "Clear cache"}
        </button>
      </div>

      {result && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            background: "rgba(2, 6, 23, 0.55)",
          }}
        >
          <div style={{ opacity: 0.9 }}>
            <strong>Cleared:</strong> {result.deletedCaches.length} cache
            entries
          </div>

          {result.keptCaches.length > 0 && (
            <div style={{ marginTop: "0.5rem", opacity: 0.85 }}>
              <div style={{ fontWeight: 600 }}>Note</div>
              {manualClearInstructions().map((line) => (
                <div key={line} style={{ marginTop: "0.25rem" }}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default StoragePanel;
