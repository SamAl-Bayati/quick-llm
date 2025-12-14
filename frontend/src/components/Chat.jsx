import { useEffect, useMemo, useState } from "react";
import {
  abortWorker,
  generateInWorker,
  initModelInWorker,
  resetWorker,
} from "../lib/workerClient";
import { nextFrame } from "../lib/async";
import { GENERATION_DEFAULTS } from "../lib/llmConstants";
import { resolveDevice } from "../lib/hardware";
import { DEVICE } from "../utils/device";
import { ERROR_ACTIONS } from "../lib/llmProtocol";

const CHAT_STATUS = {
  idle: "idle",
  loading: "loading",
  ready: "ready",
  error: "error",
};

function buildPrompt(messages, nextUserText) {
  const lastUser = nextUserText.trim();
  return `User: ${lastUser}\nAssistant:`;
}

function Chat({ selectedModel, settings }) {
  const [status, setStatus] = useState(CHAT_STATUS.idle);
  const [initError, setInitError] = useState(null);
  const [banner, setBanner] = useState(null);
  const [modelConfig, setModelConfig] = useState(null);

  const [messages, setMessages] = useState([
    { role: "assistant", content: "Initialize the model, then send a prompt." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [workerStatus, setWorkerStatus] = useState(null);

  const modelId = selectedModel?.id || "";
  const modelLabel =
    selectedModel?.displayName || modelId || "No model selected";

  const canInit = Boolean(modelId) && status !== CHAT_STATUS.loading;

  const canSend =
    status === CHAT_STATUS.ready && !sending && input.trim().length > 0;

  useEffect(() => {
    resetWorker();
    setStatus(CHAT_STATUS.idle);
    setInitError(null);
    setSendError(null);
    setWorkerStatus(null);
    setBanner(null);
    setModelConfig(null);
  }, [modelId]);

  async function handleInit() {
    try {
      resetWorker();
      setStatus(CHAT_STATUS.loading);
      setInitError(null);
      setSendError(null);
      setWorkerStatus(null);
      setBanner(null);
      setModelConfig(null);
      await nextFrame();

      const requestedDevice = resolveDevice(selectedModel?.preferredDevice);

      const initPayload = {
        modelId,
        dtype: settings?.dtype ?? selectedModel?.defaultDtype,
        device: requestedDevice,
      };

      let config = null;
      try {
        config = await initModelInWorker(initPayload, {
          onStatus: (p) => setWorkerStatus(p?.message || null),
          onBanner: (p) => setBanner(p?.message || null),
        });
      } catch (e) {
        if (
          e?.action === ERROR_ACTIONS.RESTART_WASM &&
          requestedDevice === DEVICE.WEBGPU
        ) {
          setWorkerStatus("Retrying on WASM...");
          resetWorker();
          config = await initModelInWorker(
            { ...initPayload, device: DEVICE.WASM },
            {
              onStatus: (p) => setWorkerStatus(p?.message || null),
              onBanner: (p) => setBanner(p?.message || null),
            }
          );
        } else {
          throw e;
        }
      }

      setModelConfig(config);
      setStatus(CHAT_STATUS.ready);
    } catch (e) {
      setStatus(CHAT_STATUS.error);
      setInitError(e?.message || "Failed to initialize model.");
    }
  }

  function handleCancelInit() {
    resetWorker();
    setStatus(CHAT_STATUS.idle);
    setInitError(null);
    setWorkerStatus(null);
  }

  function handleStop() {
    abortWorker();
    setWorkerStatus("Stopping...");
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !canSend) return;

    setSending(true);
    setSendError(null);
    setWorkerStatus(null);

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    await nextFrame();

    const assistantIndex = messages.length + 1;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const prompt = buildPrompt(messages, text);
      let acc = "";

      const result = await generateInWorker(
        {
          prompt,
          maxNewTokens:
            Number(settings?.maxNewTokens) ||
            GENERATION_DEFAULTS.MAX_NEW_TOKENS,
          temperature:
            typeof settings?.temperature === "number"
              ? settings.temperature
              : Number(settings?.temperature) ||
                GENERATION_DEFAULTS.TEMPERATURE,
        },
        {
          onStatus: (p) => setWorkerStatus(p?.message || null),
          onToken: (p) => {
            const chunk = p?.text || "";
            if (!chunk) return;
            acc += chunk;
            setMessages((prev) =>
              prev.map((m, idx) =>
                idx === assistantIndex ? { ...m, content: acc } : m
              )
            );
          },
        }
      );

      const finalText = result?.text || acc;

      if (result?.aborted) {
        setWorkerStatus("Aborted");
        if (!finalText) {
          setMessages((prev) =>
            prev.map((m, idx) =>
              idx === assistantIndex ? { ...m, content: "Stopped." } : m
            )
          );
        }
        return;
      }

      if (finalText && finalText !== acc) {
        setMessages((prev) =>
          prev.map((m, idx) =>
            idx === assistantIndex ? { ...m, content: finalText } : m
          )
        );
      }
    } catch (err) {
      setSendError(err?.message || "Generation failed.");
      setMessages((prev) =>
        prev.map((m, idx) =>
          idx === assistantIndex ? { ...m, content: "Generation failed." } : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  const statusText = useMemo(() => {
    if (status === CHAT_STATUS.idle) return "idle";
    if (status === CHAT_STATUS.loading) return "initializing";
    if (status === CHAT_STATUS.ready) return "ready";
    return "error";
  }, [status]);

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
      <h2 style={{ marginTop: 0 }}>Chat</h2>

      <div style={{ opacity: 0.9 }}>
        <div>
          <strong>Model:</strong> {modelLabel}
        </div>
        <div style={{ marginTop: "0.25rem" }}>
          <strong>Status:</strong> {statusText}
        </div>
        {modelConfig?.device && (
          <div style={{ marginTop: "0.25rem", opacity: 0.85 }}>
            <strong>Device:</strong> {modelConfig.device}
          </div>
        )}
        {modelConfig?.dtype && (
          <div style={{ marginTop: "0.25rem", opacity: 0.85 }}>
            <strong>Dtype:</strong> {modelConfig.dtype}
          </div>
        )}
        {workerStatus && (
          <div style={{ marginTop: "0.25rem", opacity: 0.85 }}>
            <strong>Worker:</strong> {workerStatus}
          </div>
        )}
      </div>

      {banner && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.6rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid rgba(251, 191, 36, 0.35)",
            background: "rgba(251, 191, 36, 0.12)",
            color: "#fde68a",
            textAlign: "left",
            fontSize: "0.95rem",
          }}
        >
          {banner}
        </div>
      )}

      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
        <button onClick={handleInit} disabled={!canInit}>
          {status === CHAT_STATUS.loading
            ? "Initializing…"
            : status === CHAT_STATUS.ready
            ? "Reinitialize model"
            : "Initialize model"}
        </button>

        {status === CHAT_STATUS.loading && (
          <button type="button" onClick={handleCancelInit}>
            Cancel
          </button>
        )}

        {sending && (
          <button type="button" onClick={handleStop}>
            Stop
          </button>
        )}
      </div>

      {initError && (
        <div style={{ marginTop: "0.5rem", color: "#f97373" }}>{initError}</div>
      )}

      <div
        style={{
          marginTop: "1rem",
          padding: "0.75rem",
          borderRadius: "0.5rem",
          border: "1px solid rgba(148, 163, 184, 0.25)",
          background: "rgba(2, 6, 23, 0.55)",
          maxHeight: "260px",
          overflowY: "auto",
          textAlign: "left",
        }}
      >
        {messages.map((m, idx) => (
          <div key={idx} style={{ marginBottom: "0.75rem" }}>
            <div style={{ opacity: 0.75, fontSize: "0.9rem" }}>
              {m.role === "user" ? "You" : "Assistant"}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} style={{ marginTop: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              status === CHAT_STATUS.ready
                ? "Type a prompt…"
                : "Initialize the model to enable chat"
            }
            disabled={status !== CHAT_STATUS.ready || sending}
            style={{
              flex: 1,
              padding: "0.6rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(148, 163, 184, 0.4)",
              background: "rgba(2, 6, 23, 0.6)",
              color: "inherit",
            }}
          />
          <button type="submit" disabled={!canSend}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>

        {sendError && (
          <div style={{ marginTop: "0.5rem", color: "#f97373" }}>
            {sendError}
          </div>
        )}
      </form>
    </section>
  );
}

export default Chat;
