export const ERROR_KIND = {
  OFFLINE: "offline",
  NETWORK: "network",
  OOM: "oom",
  INIT: "init",
  GENERATE: "generate",
  UNKNOWN: "unknown",
};

function isOfflineNow() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function toText(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v?.message === "string") return v.message;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function lower(s) {
  return typeof s === "string" ? s.toLowerCase() : "";
}

function includesAny(haystack, needles) {
  const h = lower(haystack);
  return needles.some((n) => h.includes(lower(n)));
}

export function offlineError(context) {
  return {
    kind: ERROR_KIND.OFFLINE,
    title: "You appear to be offline",
    message: context || "Check your connection, then retry.",
    details: null,
    tone: "warning",
  };
}

export function mapBackendError(err) {
  if (isOfflineNow())
    return offlineError("Backend is unreachable while offline.");

  const msg = toText(err);
  const isAxiosNetwork =
    includesAny(msg, ["network error", "failed to fetch", "ecconnrefused"]) ||
    err?.code === "ERR_NETWORK";

  if (isAxiosNetwork) {
    return {
      kind: ERROR_KIND.NETWORK,
      title: "Cannot reach backend",
      message:
        "Confirm the backend is running and VITE_API_BASE_URL is correct.",
      details: msg || null,
      tone: "error",
    };
  }

  return {
    kind: ERROR_KIND.UNKNOWN,
    title: "Backend request failed",
    message: "Try again, or check the console for details.",
    details: msg || null,
    tone: "error",
  };
}

export function mapModelListError(err) {
  if (isOfflineNow())
    return offlineError("Model list cannot load while offline.");

  const msg = toText(err);
  const isNetwork =
    includesAny(msg, ["network error", "failed to fetch", "load failed"]) ||
    err?.code === "ERR_NETWORK";

  if (isNetwork) {
    return {
      kind: ERROR_KIND.NETWORK,
      title: "Failed to load models",
      message:
        "Backend may be down or blocked by CORS. Check the backend and retry.",
      details: msg || null,
      tone: "error",
    };
  }

  return {
    kind: ERROR_KIND.UNKNOWN,
    title: "Failed to load models",
    message: "Try again.",
    details: msg || null,
    tone: "error",
  };
}

export function mapWorkerError(err, stage) {
  if (isOfflineNow()) {
    const ctx =
      stage === "init"
        ? "Model files cannot be downloaded while offline."
        : "Generation may fail while offline.";
    return offlineError(ctx);
  }

  const msg = toText(err);
  const stack = typeof err?.stack === "string" ? err.stack : "";
  const combined = `${msg}\n${stack}`;

  const isOom = includesAny(combined, [
    "out of memory",
    "oom",
    "memory allocation",
    "cannot allocate memory",
    "allocation failed",
  ]);

  if (isOom) {
    return {
      kind: ERROR_KIND.OOM,
      title: "Out of memory",
      message:
        "Try closing other tabs, lowering dtype, or using WASM. If it persists, reset the session.",
      details: msg || null,
      tone: "error",
    };
  }

  const isNetworkFetch = includesAny(combined, [
    "failed to fetch",
    "networkerror",
    "load failed",
    "err_internet_disconnected",
    "fetch",
  ]);

  if (isNetworkFetch) {
    return {
      kind: ERROR_KIND.NETWORK,
      title: "Network error while loading model files",
      message: "Check your connection, then retry init.",
      details: msg || null,
      tone: "error",
    };
  }

  const isInitish = includesAny(combined, [
    "model initialization timed out",
    "initialization timed out",
    "ort init failed",
    "no available backend found",
    "worker crashed",
  ]);

  if (stage === "init" || isInitish) {
    return {
      kind: ERROR_KIND.INIT,
      title: "Model initialization failed",
      message: "Retry init. If it keeps failing, reset the session.",
      details: msg || null,
      tone: "error",
    };
  }

  return {
    kind: stage === "generate" ? ERROR_KIND.GENERATE : ERROR_KIND.UNKNOWN,
    title: stage === "generate" ? "Generation failed" : "Worker error",
    message: "Try again. If it persists, reset the session.",
    details: msg || null,
    tone: "error",
  };
}
