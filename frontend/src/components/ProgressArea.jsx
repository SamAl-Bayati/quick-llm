import { INIT_PROGRESS_STEPS } from "../lib/llmConstants";

function ProgressArea({ currentStep, percent, seenSteps }) {
  const seen = Array.isArray(seenSteps) ? new Set(seenSteps) : new Set();

  function stepText(step) {
    if (step.key !== currentStep) return step.label;
    if (typeof percent === "number" && Number.isFinite(percent)) {
      return `${step.label} ${Math.max(0, Math.min(100, percent))}%`;
    }
    return step.label;
  }

  return (
    <div
      style={{
        marginTop: "0.75rem",
        padding: "0.75rem",
        borderRadius: "0.5rem",
        border: "1px solid rgba(148, 163, 184, 0.25)",
        background: "rgba(2, 6, 23, 0.55)",
        textAlign: "left",
      }}
    >
      <div style={{ opacity: 0.85, marginBottom: "0.5rem" }}>Initializing</div>

      <div style={{ display: "grid", gap: "0.35rem" }}>
        {INIT_PROGRESS_STEPS.map((s) => {
          const done = seen.has(s.key) && s.key !== currentStep;
          const active = s.key === currentStep;

          return (
            <div
              key={s.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                opacity: done ? 0.7 : 0.95,
                fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ width: "1.25rem" }}>
                {done ? "✓" : active ? "…" : "•"}
              </span>
              <span>{stepText(s)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProgressArea;
