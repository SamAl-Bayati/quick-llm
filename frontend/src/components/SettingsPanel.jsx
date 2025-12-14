import { DTYPE_OPTIONS, SETTINGS_DEFAULTS } from "../lib/llmConstants";

function SettingsPanel({ settings, onChange, onReset }) {
  const s = settings || SETTINGS_DEFAULTS;

  function update(patch) {
    if (typeof onChange === "function") onChange(patch);
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
      <h2 style={{ marginTop: 0 }}>Settings</h2>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "block" }}>
          <div style={{ opacity: 0.85, marginBottom: "0.35rem" }}>dtype</div>
          <select
            value={s.dtype}
            onChange={(e) => update({ dtype: e.target.value })}
            style={{
              width: "100%",
              padding: "0.6rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(148, 163, 184, 0.4)",
              background: "rgba(2, 6, 23, 0.6)",
              color: "inherit",
            }}
          >
            {DTYPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <div
            style={{ marginTop: "0.35rem", opacity: 0.7, fontSize: "0.9rem" }}
          >
            Applies on next (re)initialize.
          </div>
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
          }}
        >
          <label style={{ display: "block" }}>
            <div style={{ opacity: 0.85, marginBottom: "0.35rem" }}>
              max tokens
            </div>
            <input
              type="number"
              min={1}
              max={512}
              value={s.maxNewTokens}
              onChange={(e) => update({ maxNewTokens: e.target.value })}
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(148, 163, 184, 0.4)",
                background: "rgba(2, 6, 23, 0.6)",
                color: "inherit",
              }}
            />
          </label>

          <label style={{ display: "block" }}>
            <div style={{ opacity: 0.85, marginBottom: "0.35rem" }}>
              temperature
            </div>
            <input
              type="number"
              step="0.05"
              min={0}
              max={2}
              value={s.temperature}
              onChange={(e) => update({ temperature: e.target.value })}
              style={{
                width: "100%",
                padding: "0.6rem",
                borderRadius: "0.5rem",
                border: "1px solid rgba(148, 163, 184, 0.4)",
                background: "rgba(2, 6, 23, 0.6)",
                color: "inherit",
              }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => {
              if (typeof onReset === "function") onReset();
            }}
          >
            Reset defaults
          </button>
        </div>
      </div>
    </section>
  );
}

export default SettingsPanel;
