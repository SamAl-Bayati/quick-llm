import { useMemo, useState } from "react";
import Chat from "./components/Chat";
import SettingsModal from "./components/SettingsModal";
import ModelSelect from "./components/ModelSelect";
import { loadSettings, saveSettings } from "./lib/settings";
import { SETTINGS_DEFAULTS } from "./lib/llmConstants";
import { resetWorker } from "./lib/workerClient";
import { clearAppCaches } from "./utils/cache";
import { clearAppLocalStorage } from "./utils/storage";
import { useModels } from "./hooks/useModels";
import { Icons } from "./ui/icons";

function App() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [uiEpoch, setUiEpoch] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    models,
    loading: modelsLoading,
    error: modelsError,
    selectedModelId,
    selectedModel,
    select,
  } = useModels(uiEpoch);

  const modelPickerDisabled =
    modelsLoading || Boolean(modelsError) || !models || models.length === 0;

  function handleSettingsChange(patch) {
    setSettings((prev) => saveSettings({ ...prev, ...(patch || {}) }));
  }

  function handleSettingsReset() {
    setSettings(saveSettings(SETTINGS_DEFAULTS));
  }

  function handleBeforeClear() {
    resetWorker("Clearing cache");
  }

  function handleCleared() {
    setSettings(saveSettings(SETTINGS_DEFAULTS));
    setUiEpoch((v) => v + 1);
  }

  async function resetSession(reason = "Reset session") {
    resetWorker(reason);
    try {
      await clearAppCaches();
    } catch {}
    clearAppLocalStorage();
    setSettings(saveSettings(SETTINGS_DEFAULTS));
    setUiEpoch((v) => v + 1);
  }

  const topbarHint = useMemo(() => {
    if (modelsError) return "API error";
    if (modelsLoading) return "Loading";
    return null;
  }, [modelsError, modelsLoading]);

  return (
    <div className="q-app">
      <div className="q-topbar">
        <div className="q-left">
          <img
            className="q-logo"
            src="src\assets\qlm-high-resolution-logo-transparent-white.png"
            alt="Quick LLM"
          />
          <div className="q-pill" title={topbarHint || ""}>
            <ModelSelect
              models={models}
              value={selectedModelId}
              disabled={modelPickerDisabled}
              onChange={(id) => select(id)}
            />
          </div>
        </div>

        <button
          className="q-iconBtn"
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          title="Settings"
        >
          <Icons.Cog size={18} />
        </button>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        models={models}
        modelsLoading={modelsLoading}
        selectedModelId={selectedModelId}
        onSelectModelId={(id) => select(id)}
        settings={settings}
        onChangeSettings={handleSettingsChange}
        onResetSettings={handleSettingsReset}
        onBeforeClear={handleBeforeClear}
        onCleared={handleCleared}
      />

      <Chat
        key={`chat-${uiEpoch}`}
        selectedModel={selectedModel}
        settings={settings}
        onResetSession={resetSession}
      />
    </div>
  );
}

export default App;
