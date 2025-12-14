function toneStyles(tone) {
  if (tone === "warning") {
    return {
      border: "1px solid rgba(251, 191, 36, 0.35)",
      background: "rgba(251, 191, 36, 0.12)",
      color: "#fde68a",
    };
  }

  return {
    border: "1px solid rgba(248, 113, 113, 0.35)",
    background: "rgba(248, 113, 113, 0.12)",
    color: "#fecaca",
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
        marginTop: "0.75rem",
        padding: "0.75rem",
        borderRadius: "0.5rem",
        textAlign: "left",
        ...style,
      }}
    >
      {title && (
        <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{title}</div>
      )}
      {message && <div style={{ opacity: 0.95 }}>{message}</div>}

      {details && (
        <details style={{ marginTop: "0.5rem", opacity: 0.9 }}>
          <summary style={{ cursor: "pointer" }}>Details</summary>
          <pre
            style={{ whiteSpace: "pre-wrap", margin: 0, marginTop: "0.5rem" }}
          >
            {String(details)}
          </pre>
        </details>
      )}

      {list.length > 0 && (
        <div
          style={{
            marginTop: "0.75rem",
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          {list.map((a) => (
            <button
              key={a.key || a.label}
              type="button"
              onClick={a.onClick}
              disabled={Boolean(a.disabled)}
              style={{
                borderRadius: "8px",
                border: "1px solid rgba(148, 163, 184, 0.35)",
                padding: "0.5em 0.9em",
                background: "rgba(2, 6, 23, 0.35)",
                color: "inherit",
                cursor: a.disabled ? "not-allowed" : "pointer",
              }}
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
