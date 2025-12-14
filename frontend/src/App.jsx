import { useEffect, useState } from "react";
import { pingBackend } from "./api/client";
import ModelPicker from "./components/ModelPicker";
import Chat from "./components/Chat";
import SettingsPanel from "./components/SettingsPanel";
import { loadSettings, saveSettings } from "./lib/settings";
import { SETTINGS_DEFAULTS } from "./lib/llmConstants";

function App() {
  const [backendStatus, setBackendStatus] = useState("Checking backend...");
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [settings, setSettings] = useState(() => loadSettings());

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

  function handleSettingsChange(patch) {
    setSettings((prev) => saveSettings({ ...prev, ...(patch || {}) }));
  }

  function handleSettingsReset() {
    setSettings(saveSettings(SETTINGS_DEFAULTS));
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
        <h1 style={{ marginBottom: "0.5rem" }}>Quick LLM</h1>
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

      <ModelPicker onSelectedModelChange={setSelectedModel} />
      <SettingsPanel
        settings={settings}
        onChange={handleSettingsChange}
        onReset={handleSettingsReset}
      />
      <Chat selectedModel={selectedModel} settings={settings} />
    </div>
  );
}

export default App;
