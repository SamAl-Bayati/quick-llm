export async function smokeLoadTransformers() {
  const { pipeline } = await import("@huggingface/transformers");

  // Very small pipeline init just to prove it works end-to-end.
  // This will download model assets on first run.
  const gen = await pipeline("text-generation", "Xenova/distilgpt2");

  return { pipelineLoaded: Boolean(gen) };
}
