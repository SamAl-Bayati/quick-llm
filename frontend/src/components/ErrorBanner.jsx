function toneStyles(tone) {
  if (tone === "warning") {
    return {
      border: "1px solid rgba(167, 126, 88, 0.35)",
      background: "rgba(0, 0, 0, 0.55)",
      color: "rgba(255, 255, 255, 0.92)",
      boxShadow: "0 0 18px rgba(233, 138, 21, 0.14)",
    };
  }

  return {
    border: "1px solid rgba(255, 92, 92, 0.35)",
    background: "rgba(255, 92, 92, 0.12)",
    color: "rgba(255, 255, 255, 0.92)",
  };
}

function ErrorBanner({ title, message, details, actions, tone = "error" }) {
  if (!title && !message) return null;

  const style = toneStyles(tone);
  const list = Array.isArray(actions) ? actions.filter(Boolean) : [];

  return (
    <div
      role="alert"
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: "var(--radius)",
        textAlign: "left",
        ...style,
      }}
    >
      {title && <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>}
      {message && <div style={{ opacity: 0.95 }}>{message}</div>}

      {details && (
        <details style={{ marginTop: 10, opacity: 0.9 }}>
          <summary style={{ cursor: "pointer" }}>Details</summary>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, marginTop: 10 }}>
            {String(details)}
          </pre>
        </details>
      )}

      {list.length > 0 && (
        <div
          style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          {list.map((a) => (
            <button
              key={a.key || a.label}
              type="button"
              onClick={a.onClick}
              disabled={Boolean(a.disabled)}
              className="q-btn"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ErrorBanner;
