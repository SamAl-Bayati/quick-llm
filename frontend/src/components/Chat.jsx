import { useEffect, useMemo, useState } from "react";
import {
  abortWorker,
  generateInWorker,
  initModelInWorker,
  resetWorker,
} from "../lib/workerClient";
import { nextFrame } from "../lib/async";
import { GENERATION_DEFAULTS } from "../lib/llmConstants";

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

function Chat({ selectedModel }) {
  const [status, setStatus] = useState(CHAT_STATUS.idle);
  const [initError, setInitError] = useState(null);

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

  const canInit =
    Boolean(modelId) &&
    status !== CHAT_STATUS.loading &&
    status !== CHAT_STATUS.ready;

  const canSend =
    status === CHAT_STATUS.ready && !sending && input.trim().length > 0;

  useEffect(() => {
    resetWorker();
    setStatus(CHAT_STATUS.idle);
    setInitError(null);
    setSendError(null);
    setWorkerStatus(null);
  }, [modelId]);

  async function handleInit() {
    try {
      setStatus(CHAT_STATUS.loading);
      setInitError(null);
      setSendError(null);
      setWorkerStatus(null);
      await nextFrame();

      await initModelInWorker(
        {
          modelId,
          dtype: selectedModel?.defaultDtype,
          device: selectedModel?.preferredDevice,
        },
        {
          onStatus: (p) => setWorkerStatus(p?.message || null),
        }
      );

      setStatus(CHAT_STATUS.ready);
    } catch (e) {
      setStatus(CHAT_STATUS.error);
      setInitError(e?.message || "Failed to initialize model.");
    }
  }

  async function handleAbort() {
    abortWorker();
    setSending(false);
    setWorkerStatus("Aborted");
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "Generation aborted. Re-initialize if needed.",
      },
    ]);
    setStatus(CHAT_STATUS.idle);
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

      const finalText = await generateInWorker(
        {
          prompt,
          maxNewTokens: GENERATION_DEFAULTS.MAX_NEW_TOKENS,
          temperature: GENERATION_DEFAULTS.TEMPERATURE,
        },
        {
          onStatus: (p) => setWorkerStatus(p?.message || null),
          onToken: (p) => {
            const chunk = p?.text || "";
            acc += chunk;
            setMessages((prev) =>
              prev.map((m, idx) =>
                idx === assistantIndex ? { ...m, content: acc } : m
              )
            );
          },
        }
      );

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
        {workerStatus && (
          <div style={{ marginTop: "0.25rem", opacity: 0.85 }}>
            <strong>Worker:</strong> {workerStatus}
          </div>
        )}
      </div>

      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
        <button onClick={handleInit} disabled={!canInit}>
          {status === CHAT_STATUS.loading
            ? "Initializing…"
            : "Initialize model"}
        </button>

        {(status === CHAT_STATUS.loading || sending) && (
          <button type="button" onClick={handleAbort}>
            Abort
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
