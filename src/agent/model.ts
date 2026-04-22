import type { LanguageModel } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export interface OpenAICompatConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export function createOpenAICompatModel(
  opts: OpenAICompatConfig,
): LanguageModel {
  const provider = createOpenAICompatible({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
    name: "openai-compat",
    supportsStructuredOutputs: true,
  });
  return provider.chatModel(opts.model);
}

export function createModelFromEnv(): LanguageModel {
  const apiKey = process.env["MRBROWN_LLM_API_KEY"];
  const baseURL = process.env["MRBROWN_LLM_BASE_URL"];
  const model = process.env["MRBROWN_LLM_MODEL"];

  if (!apiKey || !baseURL || !model) {
    throw new Error(
      "Missing env vars: MRBROWN_LLM_API_KEY, MRBROWN_LLM_BASE_URL, MRBROWN_LLM_MODEL",
    );
  }

  return createOpenAICompatModel({ apiKey, baseURL, model });
}
