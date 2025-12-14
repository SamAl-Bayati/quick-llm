export function formatBytes(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
    return "Unknown";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;

  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }

  const fixed = i === 0 ? 0 : v < 10 ? 2 : 1;
  return `${v.toFixed(fixed)} ${units[i]}`;
}
