function stripPromptPrefix(fullText, prompt) {
  if (typeof fullText !== "string") return "";
  const text = fullText.startsWith(prompt)
    ? fullText.slice(prompt.length)
    : fullText;
  return text.trim();
}

export function extractGeneratedText(output, prompt) {
  if (typeof output === "string") return stripPromptPrefix(output, prompt);

  if (Array.isArray(output) && output.length > 0) {
    const first = output[0];
    if (typeof first === "string") return stripPromptPrefix(first, prompt);
    if (first && typeof first.generated_text === "string") {
      return stripPromptPrefix(first.generated_text, prompt);
    }
    if (first && Array.isArray(first.generated_text)) {
      const last = first.generated_text[first.generated_text.length - 1];
      if (last && typeof last.content === "string") return last.content.trim();
    }
    if (first && typeof first.text === "string") {
      return stripPromptPrefix(first.text, prompt);
    }
  }

  if (output && typeof output.generated_text === "string") {
    return stripPromptPrefix(output.generated_text, prompt);
  }
  if (output && Array.isArray(output.generated_text)) {
    const last = output.generated_text[output.generated_text.length - 1];
    if (last && typeof last.content === "string") return last.content.trim();
  }

  return "";
}

export function cleanReply(text, prompt) {
  if (typeof text !== "string") return "";
  let t = text.replace(/\r/g, "").trim();

  t = t.replace(/^\s*(assistant|answer)\s*:\s*/i, "");
  t = t.replace(/\n\s*(assistant|answer)\s*:\s*/gi, "\n");

  if (typeof prompt === "string") {
    t = t.split(/\n\s*(user|assistant|question)\s*:\s*/i)[0].trim();
  }

  const m =
    typeof prompt === "string"
      ? prompt.match(/User:\s*([\s\S]*?)\nAssistant:\s*$/i)
      : null;
  const echoed = m?.[1]?.trim();
  if (echoed && t.toLowerCase().startsWith(echoed.toLowerCase())) {
    t = t.slice(echoed.length).trim();
  }

  return t;
}
