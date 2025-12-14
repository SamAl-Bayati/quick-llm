import { useEffect, useMemo, useState } from "react";
import { fetchModels } from "../api/models";
import { getSelectedModelId, setSelectedModelId } from "../utils/storage";
import ErrorBanner from "./ErrorBanner";
import { mapModelListError } from "../lib/errorMapping";

function ModelPicker({ onSelectedModelChange }) {
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelIdState] = useState(
    () => getSelectedModelId() || ""
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const selectedModel = useMemo(
    () => models.find((m) => m.id === selectedModelId) || null,
    [models, selectedModelId]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const list = await fetchModels();
        if (cancelled) return;

        setModels(Array.isArray(list) ? list : []);

        const stored = getSelectedModelId();
        const initial =
          stored && list.some((m) => m.id === stored)
            ? stored
            : list[0]?.id || "";

        setSelectedModelIdState(initial);
        setSelectedModelId(initial);
        if (typeof onSelectedModelChange === "function") {
          onSelectedModelChange(list.find((m) => m.id === initial) || null);
        }
      } catch (e) {
        if (cancelled) return;
        setError(mapModelListError(e));
        setModels([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [onSelectedModelChange]);

  function handleChange(e) {
    const nextId = e.target.value;
    setSelectedModelIdState(nextId);
    setSelectedModelId(nextId);
    if (typeof onSelectedModelChange === "function") {
      onSelectedModelChange(models.find((m) => m.id === nextId) || null);
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
      }}
    >
      <h2 style={{ marginTop: 0 }}>Model</h2>

      {loading && <p style={{ marginTop: "0.5rem" }}>Loading models…</p>}

      {!loading && error && (
        <ErrorBanner
          title={error.title}
          message={error.message}
          details={error.details}
          tone={error.tone}
          actions={[
            { label: "Retry", onClick: () => window.location.reload() },
          ]}
        />
      )}

      {!loading && !error && models.length === 0 && (
        <p style={{ marginTop: "0.5rem" }}>No models available.</p>
      )}

      {!loading && !error && models.length > 0 && (
        <>
          <label style={{ display: "block", marginTop: "0.75rem" }}>
            <div style={{ opacity: 0.85, marginBottom: "0.35rem" }}>
              Select a model
            </div>
            <select
              value={selectedModelId}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(148, 163, 184, 0.4)",
                background: "rgba(2, 6, 23, 0.6)",
                color: "inherit",
              }}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName || m.id}
                </option>
              ))}
            </select>
          </label>

          {selectedModel && (
            <div style={{ marginTop: "0.75rem", opacity: 0.9 }}>
              <div>
                <strong>Task:</strong> {selectedModel.task}
              </div>
              <div>
                <strong>Default dtype:</strong>{" "}
                {selectedModel.defaultDtype || "auto"}
              </div>
              <div>
                <strong>Preferred device:</strong>{" "}
                {selectedModel.preferredDevice}
              </div>
              {typeof selectedModel.approxDownloadMB === "number" && (
                <div>
                  <strong>Approx download:</strong>{" "}
                  {selectedModel.approxDownloadMB} MB
                </div>
              )}
              {selectedModel.notes && (
                <div style={{ marginTop: "0.5rem", opacity: 0.85 }}>
                  {selectedModel.notes}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default ModelPicker;
