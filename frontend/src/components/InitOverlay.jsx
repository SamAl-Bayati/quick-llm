import { INIT_PROGRESS_STEPS } from "../lib/llmConstants";

const LABEL_BY_KEY = new Map(INIT_PROGRESS_STEPS.map((s) => [s.key, s.label]));

function labelForStep(step) {
  return LABEL_BY_KEY.get(step) || "Initializing…";
}

export default function InitOverlay({ step, percent, message }) {
  if (!step && !message) return null;

  const pct =
    typeof percent === "number" && Number.isFinite(percent)
      ? Math.max(0, Math.min(100, Math.round(percent)))
      : null;

  const text = message || labelForStep(step);

  return (
    <div className="q-initOverlay" aria-live="polite" aria-busy="true">
      <div className="q-initCard">
        <div className="q-initRow">
          <div className="q-initLabel">{text}</div>
          <div className="q-initPercent">{pct != null ? `${pct}%` : ""}</div>
        </div>
      </div>
    </div>
  );
}
