function isPlaceholderAssistant(m) {
  return (
    m?.role === "assistant" &&
    typeof m?.content === "string" &&
    m.content.toLowerCase().includes("initialize the model")
  );
}

export function buildChatMessages(history, nextUserText) {
  const base = Array.isArray(history) ? history : [];

  const filtered = base
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .filter((m, idx) => !(idx === 0 && isPlaceholderAssistant(m)))
    .map((m) => ({ role: m.role, content: String(m.content ?? "") }));

  const userText = String(nextUserText ?? "").trim();
  if (userText) filtered.push({ role: "user", content: userText });

  return filtered;
}
