export function withTimeout(promise, ms, label = "Operation timed out") {
  let timer = null;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
