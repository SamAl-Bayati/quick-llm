import { REQUEST_TYPES, RESPONSE_TYPES } from "./llmProtocol";

let worker = null;
let seq = 0;
let activeGenerateRequestId = null;

const pending = new Map();

function nextRequestId() {
  seq += 1;
  return `${Date.now()}-${seq}`;
}

function rejectAll(err) {
  for (const [, entry] of pending) {
    entry.reject(err);
  }
  pending.clear();
}

function ensureWorker() {
  if (worker) return worker;

  worker = new Worker(new URL("../workers/llmWorker.js", import.meta.url), {
    type: "module",
  });

  worker.onmessage = (evt) => {
    const msg = evt?.data || {};
    const { type, requestId, payload } = msg;

    const entry = pending.get(requestId);
    if (!entry) return;

    if (type === RESPONSE_TYPES.STATUS) {
      entry.onStatus?.(payload);
      return;
    }

    if (type === RESPONSE_TYPES.BANNER) {
      entry.onBanner?.(payload);
      return;
    }

    if (type === RESPONSE_TYPES.TOKEN) {
      entry.onToken?.(payload);
      return;
    }

    if (type === RESPONSE_TYPES.READY) {
      pending.delete(requestId);
      entry.resolve(payload?.config || null);
      return;
    }

    if (type === RESPONSE_TYPES.DONE) {
      pending.delete(requestId);
      if (activeGenerateRequestId === requestId) activeGenerateRequestId = null;
      entry.resolve(payload || { text: "", aborted: false });
      return;
    }

    if (type === RESPONSE_TYPES.ERROR) {
      pending.delete(requestId);
      if (activeGenerateRequestId === requestId) activeGenerateRequestId = null;
      const err = new Error(payload?.message || "Worker error");
      if (payload?.stack) err.stack = payload.stack;
      err.config = payload?.config || null;
      err.action = payload?.action || null;
      entry.reject(err);
    }
  };

  worker.onerror = () => {
    const err = new Error("Worker crashed");
    resetWorker();
    rejectAll(err);
  };

  worker.onmessageerror = () => {
    const err = new Error("Worker message error");
    resetWorker();
    rejectAll(err);
  };

  return worker;
}

export function resetWorker() {
  if (!worker) return;
  try {
    worker.terminate();
  } finally {
    worker = null;
    activeGenerateRequestId = null;
  }
}

function send(type, payload, handlers) {
  const w = ensureWorker();
  const requestId = nextRequestId();

  if (type === REQUEST_TYPES.GENERATE) {
    activeGenerateRequestId = requestId;
  }

  return new Promise((resolve, reject) => {
    pending.set(requestId, {
      resolve,
      reject,
      onToken: handlers?.onToken || null,
      onStatus: handlers?.onStatus || null,
      onBanner: handlers?.onBanner || null,
    });

    w.postMessage({ type, requestId, payload });
  });
}

export function abortWorker() {
  if (!worker) return;
  if (!activeGenerateRequestId) return;

  try {
    worker.postMessage({
      type: REQUEST_TYPES.ABORT,
      requestId: nextRequestId(),
      payload: { targetRequestId: activeGenerateRequestId },
    });
  } catch {
    // ignore
  }
}

export function initModelInWorker({ modelId, dtype, device }, handlers) {
  return send(
    REQUEST_TYPES.INIT,
    { modelId, dtype, device },
    { onStatus: handlers?.onStatus, onBanner: handlers?.onBanner }
  );
}

export function generateInWorker(
  { prompt, maxNewTokens, temperature },
  handlers
) {
  return send(
    REQUEST_TYPES.GENERATE,
    { prompt, maxNewTokens, temperature },
    { onToken: handlers?.onToken, onStatus: handlers?.onStatus }
  );
}
