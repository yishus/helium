import { SMALL_ANTHROPIC_MODEL } from "./anthropic";
import { SMALL_GOOGLE_MODEL } from "./google";
import { SMALL_OPENAI_MODEL } from "./openai";
import type { ModelId } from "../ai";

export enum Provider {
  Anthropic = "anthropic",
  Google = "google",
  OpenAI = "openai",
}

export const SMALL_MODELS: Record<Provider, ModelId> = {
  [Provider.Anthropic]: SMALL_ANTHROPIC_MODEL,
  [Provider.Google]: SMALL_GOOGLE_MODEL,
  [Provider.OpenAI]: SMALL_OPENAI_MODEL,
};
