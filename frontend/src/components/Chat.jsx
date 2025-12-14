import { useEffect, useMemo, useState } from "react";
import { generate, initModel, resetModel } from "../lib/llmClient";
import { nextFrame } from "../lib/async";

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
    resetModel();
    setStatus(CHAT_STATUS.idle);
    setInitError(null);
    setSendError(null);
  }, [modelId]);

  async function handleInit() {
    try {
      setStatus(CHAT_STATUS.loading);
      setInitError(null);
      setSendError(null);
      await nextFrame();

      await initModel({
        modelId,
        dtype: selectedModel?.defaultDtype,
        device: selectedModel?.preferredDevice,
      });

      setStatus(CHAT_STATUS.ready);
    } catch (e) {
      setStatus(CHAT_STATUS.error);
      setInitError(e?.message || "Failed to initialize model.");
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !canSend) return;

    setSending(true);
    setSendError(null);

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    await nextFrame();

    try {
      const prompt = buildPrompt(messages, text);
      const reply = await generate({
        prompt,
        maxNewTokens: 32,
        temperature: 0.4,
      });

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setSendError(err?.message || "Generation failed.");
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
      </div>

      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
        <button onClick={handleInit} disabled={!canInit}>
          {status === CHAT_STATUS.loading
            ? "Initializing…"
            : "Initialize model"}
        </button>

        {status === CHAT_STATUS.loading && (
          <button
            type="button"
            onClick={() => {
              resetModel();
              setStatus(CHAT_STATUS.idle);
              setInitError(null);
            }}
          >
            Cancel
          </button>
        )}
      </div>

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
