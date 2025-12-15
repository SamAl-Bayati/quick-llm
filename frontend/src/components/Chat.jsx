import { useEffect, useMemo, useRef, useState } from "react";
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
import InitOverlay from "./InitOverlay";
import ErrorBanner from "./ErrorBanner";
import { mapWorkerError, offlineError } from "../lib/errorMapping";
import { buildChatMessages } from "../lib/chatMessages";
import { Icons } from "../ui/icons";

const CHAT_STATUS = {
  idle: "idle",
  loading: "loading",
  ready: "ready",
  error: "error",
};

function isEnabled(model) {
  return model?.enabled !== false;
}

function Chat({ selectedModel, settings, onResetSession }) {
  const [status, setStatus] = useState(CHAT_STATUS.idle);
  const [initError, setInitError] = useState(null);
  const [banner, setBanner] = useState(null);
  const [modelConfig, setModelConfig] = useState(null);
  const [initProgress, setInitProgress] = useState({
    step: null,
    percent: null,
    message: null,
    seen: [],
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [workerStatus, setWorkerStatus] = useState(null);

  const endRef = useRef(null);
  const assistantIndexRef = useRef(-1);

  const modelId = selectedModel?.id || "";
  const modelLabel = selectedModel?.displayName || modelId || "No model";
  const canInit =
    Boolean(modelId) &&
    isEnabled(selectedModel) &&
    status !== CHAT_STATUS.loading;
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
    setInitProgress({ step: null, percent: null, message: null, seen: [] });
    setMessages([]);
    setInput("");
    setSending(false);
    assistantIndexRef.current = -1;
  }, [modelId]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, status, sending]);

  function handleWorkerStatus(p) {
    const msg = p?.message || null;
    setWorkerStatus(msg);

    if (p?.stage !== "init") return;

    const step = typeof p?.step === "string" ? p.step : null;
    const percent =
      typeof p?.percent === "number" && Number.isFinite(p.percent)
        ? p.percent
        : null;

    setInitProgress((prev) => {
      const seen = Array.isArray(prev.seen) ? prev.seen : [];
      const nextSeen = step && !seen.includes(step) ? [...seen, step] : seen;
      return {
        step: step || prev.step,
        percent: percent != null ? percent : prev.percent,
        message: msg,
        seen: nextSeen,
      };
    });
  }

  async function handleInit() {
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setStatus(CHAT_STATUS.error);
        setInitError(
          offlineError("Model files cannot be downloaded while offline.")
        );
        return;
      }

      resetWorker();
      setStatus(CHAT_STATUS.loading);
      setInitError(null);
      setSendError(null);
      setWorkerStatus(null);
      setBanner(null);
      setModelConfig(null);
      setInitProgress({ step: null, percent: null, message: null, seen: [] });
      await nextFrame();

      const requestedDevice = resolveDevice(selectedModel?.preferredDevice);

      const dtypeFromSettings = settings?.dtype ?? "auto";
      const requestedDtype =
        dtypeFromSettings === "auto"
          ? selectedModel?.defaultDtype ?? "auto"
          : dtypeFromSettings;

      const initPayload = {
        modelId,
        dtype: requestedDtype,
        device: requestedDevice,
      };

      let config = null;
      try {
        config = await initModelInWorker(initPayload, {
          onStatus: handleWorkerStatus,
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
              onStatus: handleWorkerStatus,
              onBanner: (p) => setBanner(p?.message || null),
            }
          );
        } else {
          throw e;
        }
      }

      setModelConfig(config);
      setStatus(CHAT_STATUS.ready);
      setWorkerStatus(null);
      if (messages.length === 0)
        setMessages([{ role: "assistant", content: "Ready." }]);
    } catch (e) {
      setStatus(CHAT_STATUS.error);
      setInitError(mapWorkerError(e, "init"));
    }
  }

  function handleCancelInit() {
    resetWorker("Cancel init");
    setStatus(CHAT_STATUS.idle);
    setInitError(null);
    setWorkerStatus(null);
    setInitProgress({ step: null, percent: null, message: null, seen: [] });
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

    setInput("");
    setMessages((prev) => {
      const next = [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "" },
      ];
      assistantIndexRef.current = next.length - 1;
      return next;
    });

    await nextFrame();

    try {
      const snapshot = Array.isArray(messages) ? messages : [];
      const prompt = buildChatMessages(snapshot, text);

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
            const idx = assistantIndexRef.current;
            setMessages((prev) =>
              prev.map((m, i) => (i === idx ? { ...m, content: acc } : m))
            );
          },
        }
      );

      const finalText = result?.text || acc;
      const idx = assistantIndexRef.current;

      if (result?.aborted) {
        setWorkerStatus("Aborted");
        if (!finalText) {
          setMessages((prev) =>
            prev.map((m, i) => (i === idx ? { ...m, content: "Stopped." } : m))
          );
        }
        return;
      }

      if (finalText && finalText !== acc) {
        setMessages((prev) =>
          prev.map((m, i) => (i === idx ? { ...m, content: finalText } : m))
        );
      }
    } catch (err) {
      setSendError(mapWorkerError(err, "generate"));
      const idx = assistantIndexRef.current;
      setMessages((prev) =>
        prev.map((m, i) =>
          i === idx ? { ...m, content: "Generation failed." } : m
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

  const composerMode = status === CHAT_STATUS.ready ? "chat" : "init";

  return (
    <>
      <div className="q-chatViewport">
        <div className="q-center">
          <div className="q-hud">
            <span>
              <strong>Model</strong> {modelLabel}
            </span>
            <span>·</span>
            <span>
              <strong>Status</strong> {statusText}
            </span>
            {modelConfig?.device && (
              <>
                <span>·</span>
                <span>
                  <strong>Device</strong> {modelConfig.device}
                </span>
              </>
            )}
            {modelConfig?.dtype && (
              <>
                <span>·</span>
                <span>
                  <strong>Dtype</strong> {modelConfig.dtype}
                </span>
              </>
            )}
            {workerStatus && (
              <>
                <span>·</span>
                <span>
                  <strong>Worker</strong> {workerStatus}
                </span>
              </>
            )}
          </div>

          {status === CHAT_STATUS.loading && (
            <InitOverlay
              step={initProgress.step}
              percent={initProgress.percent}
              message={initProgress.message}
            />
          )}

          {banner && <div className="q-banner">{banner}</div>}

          {initError && (
            <ErrorBanner
              title={initError.title}
              message={initError.message}
              details={initError.details}
              tone={initError.tone}
              actions={[
                {
                  label: "Retry init",
                  onClick: handleInit,
                  disabled: status === CHAT_STATUS.loading,
                },
                {
                  label: "Reset session",
                  onClick: () => onResetSession?.("Reset session (init error)"),
                  disabled: typeof onResetSession !== "function",
                },
              ]}
            />
          )}

          <div className="q-messages">
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={idx}
                  className={`q-msgRow ${isUser ? "q-msgRow-user" : ""}`}
                >
                  <div className={`q-bubble ${isUser ? "q-bubble-user" : ""}`}>
                    {m.content}
                    <div className="q-meta">{isUser ? "You" : "Assistant"}</div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {sendError && (
            <ErrorBanner
              title={sendError.title}
              message={sendError.message}
              details={sendError.details}
              tone={sendError.tone}
              actions={[
                {
                  label: "Reset session",
                  onClick: () =>
                    onResetSession?.("Reset session (generation error)"),
                  disabled: typeof onResetSession !== "function",
                },
              ]}
            />
          )}
        </div>
      </div>

      <div className="q-composer">
        <div className="q-composerInner">
          {composerMode === "chat" ? (
            <form
              onSubmit={handleSend}
              style={{ display: "flex", gap: 10, width: "100%" }}
            >
              <input
                className="q-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a prompt..."
                disabled={sending}
              />
              {sending ? (
                <button
                  className="q-btn q-btn-accent"
                  type="button"
                  onClick={handleStop}
                  aria-label="Stop"
                  title="Stop"
                >
                  <Icons.Stop size={18} />
                </button>
              ) : (
                <button
                  className="q-btn q-btn-accent"
                  type="submit"
                  disabled={!canSend}
                  aria-label="Send"
                  title="Send"
                >
                  <Icons.Send size={18} />
                </button>
              )}
            </form>
          ) : (
            <button
              className="q-btn q-btn-accent"
              type="button"
              style={{ width: "100%" }}
              disabled={!canInit && status !== CHAT_STATUS.loading}
              onClick={() => {
                if (status === CHAT_STATUS.loading) handleCancelInit();
                else handleInit();
              }}
            >
              {status === CHAT_STATUS.loading
                ? "Cancel initialization"
                : !modelId
                ? "Select a model"
                : isEnabled(selectedModel)
                ? "Initialize"
                : "Model not supported yet"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default Chat;
