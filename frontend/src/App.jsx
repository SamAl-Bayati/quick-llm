import { useEffect, useState } from "react";
import { pingBackend } from "./api/client";
import ModelPicker from "./components/ModelPicker";
import { smokeLoadTransformers } from "./lib/transformersSmoke";

function App() {
  const [backendStatus, setBackendStatus] = useState("Checking backend...");
  const [error, setError] = useState(null);
  const [tfStatus, setTfStatus] = useState("idle");
  const [tfError, setTfError] = useState(null);

  useEffect(() => {
    async function checkBackend() {
      try {
        const res = await pingBackend();
        setBackendStatus(`Backend OK: ${res.data.message}`);
      } catch (err) {
        console.error(err);
        setError("Cannot reach backend");
        setBackendStatus("Backend unavailable");
      }
    }

    checkBackend();
  }, []);

  async function handleLoadTransformers() {
    try {
      setTfStatus("loading");
      setTfError(null);
      await smokeLoadTransformers();
      setTfStatus("loaded");
    } catch (e) {
      setTfStatus("error");
      setTfError(e?.message || "Failed to load Transformers.");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        background: "#050816",
        color: "#f9fafb",
      }}
    >
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Signal Lab Template</h1>
        <p style={{ opacity: 0.8, maxWidth: "40rem" }}>
          Minimal React + AWS-friendly template. Frontend talks to a backend API
          via <code>VITE_API_BASE_URL</code>.
        </p>
      </header>

      <section
        style={{
          padding: "1.5rem",
          borderRadius: "0.75rem",
          background: "rgba(15, 23, 42, 0.9)",
          border: "1px solid rgba(148, 163, 184, 0.4)",
          maxWidth: "40rem",
        }}
      >
        <h2>Backend connectivity</h2>
        <p style={{ marginTop: "0.5rem" }}>{backendStatus}</p>
        {error && (
          <p style={{ color: "#f97373", marginTop: "0.5rem" }}>{error}</p>
        )}
      </section>

      <ModelPicker />

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
        <h2 style={{ marginTop: 0 }}>Transformers.js</h2>
        <button
          onClick={handleLoadTransformers}
          disabled={tfStatus === "loading" || tfStatus === "loaded"}
          style={{ marginTop: "0.5rem" }}
        >
          {tfStatus === "loading" ? "Loading…" : "Load Transformers"}
        </button>

        <div style={{ marginTop: "0.75rem", opacity: 0.9 }}>
          {tfStatus === "idle" && <div>Status: idle</div>}
          {tfStatus === "loading" && <div>Status: loading</div>}
          {tfStatus === "loaded" && <div>Status: Transformers loaded</div>}
          {tfStatus === "error" && (
            <div style={{ color: "#f97373" }}>
              Status: error{tfError ? ` (${tfError})` : ""}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
