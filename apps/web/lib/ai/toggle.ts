export function isLlmDisabled(): boolean {
  return process.env.BRIEFFORGE_DISABLE_LLM === "1";
}

