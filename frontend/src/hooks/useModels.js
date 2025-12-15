import { useEffect, useMemo, useState } from "react";
import { fetchModels } from "../api/models";
import {
  getSelectedModelId,
  setSelectedModelId as persistSelectedModelId,
} from "../utils/storage";
import { mapModelListError } from "../lib/errorMapping";

function isEnabled(m) {
  return m?.enabled !== false;
}

function isRecommended(m) {
  return Boolean(m?.recommended) && isEnabled(m);
}

function pickInitialModelId(list) {
  const stored = getSelectedModelId();
  const storedOk = stored && list.some((m) => m.id === stored && isEnabled(m));
  if (storedOk) return stored;
  return (list.find(isRecommended) || list.find(isEnabled) || null)?.id || "";
}

export function useModels(epoch = 0) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedModelId, setSelectedModelId] = useState(
    () => getSelectedModelId() || ""
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const list = await fetchModels();
        if (cancelled) return;

        const normalized = Array.isArray(list) ? list : [];
        setModels(normalized);

        const initial = pickInitialModelId(normalized);
        setSelectedModelId(initial);
        persistSelectedModelId(initial);
      } catch (e) {
        if (cancelled) return;
        setModels([]);
        setError(mapModelListError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [epoch]);

  const selectedModel = useMemo(
    () => models.find((m) => m.id === selectedModelId) || null,
    [models, selectedModelId]
  );

  function select(nextId) {
    setSelectedModelId(nextId);
    persistSelectedModelId(nextId);
  }

  return {
    models,
    loading,
    error,
    selectedModelId,
    selectedModel,
    select,
  };
}
