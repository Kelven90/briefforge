import OpenAI from "openai";
import { isLlmDisabled } from "./toggle";

const apiKey = process.env.OPENAI_API_KEY;

// Treat missing key as "LLM disabled" so builds and local dev can run without secrets.
const disabled = isLlmDisabled() || !apiKey;

export const openai = disabled ? null : new OpenAI({ apiKey: apiKey! });

