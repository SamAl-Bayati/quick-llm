export const APP_CACHE_PREFIX = "quick-llm:";

export const STORAGE_ESTIMATE_STATUS = {
  OK: "ok",
  UNSUPPORTED: "unsupported",
  FAILED: "failed",
};

export async function listCacheNames() {
  if (typeof caches === "undefined" || typeof caches.keys !== "function") {
    return [];
  }

  try {
    return await caches.keys();
  } catch {
    return [];
  }
}

async function estimateAppCacheUsageBytes(cacheNames) {
  if (typeof caches === "undefined" || typeof caches.open !== "function") {
    return null;
  }

  const names = Array.isArray(cacheNames) ? cacheNames : await listCacheNames();
  const appNames = names.filter((n) => n.startsWith(APP_CACHE_PREFIX));
  if (appNames.length === 0) return null;

  let total = 0;
  let foundAny = false;

  for (const name of appNames) {
    try {
      const cache = await caches.open(name);
      const requests = await cache.keys();

      for (const req of requests) {
        try {
          const res = await cache.match(req);
          const len = res?.headers?.get?.("content-length");
          const n = len ? Number(len) : NaN;
          if (Number.isFinite(n) && n >= 0) {
            total += n;
            foundAny = true;
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  return foundAny ? total : null;
}

export async function clearAppCaches() {
  const names = await listCacheNames();
  const deleted = [];
  const kept = [];

  if (typeof caches === "undefined" || typeof caches.delete !== "function") {
    return { deleted, kept: names };
  }

  for (const name of names) {
    if (!name.startsWith(APP_CACHE_PREFIX)) {
      kept.push(name);
      continue;
    }

    try {
      const ok = await caches.delete(name);
      if (ok) deleted.push(name);
      else kept.push(name);
    } catch {
      kept.push(name);
    }
  }

  return { deleted, kept };
}

export async function estimateStorage(cacheNames) {
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return {
      status: STORAGE_ESTIMATE_STATUS.UNSUPPORTED,
      usageBytes: null,
      quotaBytes: null,
      source: null,
      reason: "Requires a secure context (https or localhost).",
    };
  }

  const estimate = navigator?.storage?.estimate;
  if (typeof estimate !== "function") {
    const fallbackBytes = await estimateAppCacheUsageBytes(cacheNames);
    if (fallbackBytes != null) {
      return {
        status: STORAGE_ESTIMATE_STATUS.OK,
        usageBytes: fallbackBytes,
        quotaBytes: null,
        source: "cache-headers",
        reason: null,
      };
    }
    return {
      status: STORAGE_ESTIMATE_STATUS.UNSUPPORTED,
      usageBytes: null,
      quotaBytes: null,
      source: null,
      reason: "Storage estimate API not available in this browser.",
    };
  }

  try {
    const res = await estimate();
    const usageBytes =
      typeof res?.usage === "number" && Number.isFinite(res.usage)
        ? res.usage
        : null;
    const quotaBytes =
      typeof res?.quota === "number" && Number.isFinite(res.quota)
        ? res.quota
        : null;

    if (usageBytes != null || quotaBytes != null) {
      return {
        status: STORAGE_ESTIMATE_STATUS.OK,
        usageBytes,
        quotaBytes,
        source: "storage-estimate",
        reason: null,
      };
    }

    const fallbackBytes = await estimateAppCacheUsageBytes(cacheNames);
    if (fallbackBytes != null) {
      return {
        status: STORAGE_ESTIMATE_STATUS.OK,
        usageBytes: fallbackBytes,
        quotaBytes: null,
        source: "cache-headers",
        reason: null,
      };
    }

    return {
      status: STORAGE_ESTIMATE_STATUS.FAILED,
      usageBytes: null,
      quotaBytes: null,
      source: null,
      reason:
        "Estimate returned no numeric usage/quota (often due to privacy settings).",
    };
  } catch (e) {
    const fallbackBytes = await estimateAppCacheUsageBytes(cacheNames);
    if (fallbackBytes != null) {
      return {
        status: STORAGE_ESTIMATE_STATUS.OK,
        usageBytes: fallbackBytes,
        quotaBytes: null,
        source: "cache-headers",
        reason: null,
      };
    }

    return {
      status: STORAGE_ESTIMATE_STATUS.FAILED,
      usageBytes: null,
      quotaBytes: null,
      source: null,
      reason: e?.message ? String(e.message) : "Storage estimate failed.",
    };
  }
}
