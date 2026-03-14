type PricePer1K = {
  input: number;
  output: number;
};

// Approximate per-1K token pricing; adjust as needed.
const MODEL_PRICES: Record<string, PricePer1K> = {
  "gpt-4.1-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4.1": { input: 0.003, output: 0.015 }
};

const FALLBACK_PRICE: PricePer1K = { input: 0.00015, output: 0.0006 };

export function estimateChatCostUsd(args: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const prices = MODEL_PRICES[args.model] ?? FALLBACK_PRICE;
  const inputCost = (args.promptTokens / 1000) * prices.input;
  const outputCost = (args.completionTokens / 1000) * prices.output;
  return inputCost + outputCost;
}

