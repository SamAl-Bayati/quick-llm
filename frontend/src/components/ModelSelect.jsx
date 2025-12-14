import { useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "../ui/icons";

function labelFor(m) {
  const base = m?.displayName || m?.id || "Unknown";
  const rec = m?.recommended ? " (recommended)" : "";
  const off = m?.enabled === false ? " (not supported yet)" : "";
  return `${base}${rec}${off}`;
}

function isEnabled(m) {
  return m?.enabled !== false;
}

export default function ModelSelect({ models, value, onChange, disabled }) {
  const list = Array.isArray(models) ? models : [];
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => list.find((m) => m.id === value) || null,
    [list, value]
  );

  const triggerText = selected
    ? selected.displayName || selected.id
    : "No model";

  useEffect(() => {
    if (!open) return;

    function onDocDown(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(id) {
    const m = list.find((x) => x.id === id) || null;
    if (!m || !isEnabled(m)) return;
    onChange?.(id);
    setOpen(false);
  }

  return (
    <div className="q-modelSelect" ref={rootRef}>
      <button
        type="button"
        className="q-modelTrigger"
        onClick={() => setOpen((v) => !v)}
        disabled={Boolean(disabled) || list.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={triggerText}
      >
        <span className="q-modelName">{triggerText}</span>
        <Icons.Switch size={16} className="q-modelSwitchIcon" />
      </button>

      {open && (
        <div className="q-modelMenu" role="listbox" aria-label="Models">
          {list.length === 0 ? (
            <div className="q-modelEmpty">No models</div>
          ) : (
            list.map((m) => {
              const dis = m?.enabled === false;
              const active = m?.id === value;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`q-modelOption ${active ? "is-active" : ""}`}
                  onClick={() => pick(m.id)}
                  disabled={dis}
                  title={labelFor(m)}
                >
                  {labelFor(m)}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
