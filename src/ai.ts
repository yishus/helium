import {
  AnthropicProvider,
  type AnthropicModelId,
} from "./providers/anthropic";
import { GoogleProvider, type GoogleModelId } from "./providers/google";
import { OpenAIProvider, type OpenAIModelId } from "./providers/openai";
import { AuthStorage } from "./auth-storage";
import { Provider, SMALL_MODELS } from "./providers";
import tools from "./tools";

export {
  AVAILABLE_ANTHROPIC_MODELS,
  DEFAULT_ANTHROPIC_MODEL,
} from "./providers/anthropic";
export { AVAILABLE_GOOGLE_MODELS } from "./providers/google";
export { AVAILABLE_OPENAI_MODELS } from "./providers/openai";

export type ModelId = AnthropicModelId | GoogleModelId | OpenAIModelId;

// Stream delta types
export interface MessageStartDelta {
  type: "message_start";
  role: "user" | "assistant";
}

export interface TextUpdateDelta {
  type: "text_update";
  text: string;
}

export interface IgnoredDelta {
  type: "ignored";
}

export type MessageDelta = MessageStartDelta | TextUpdateDelta | IgnoredDelta;

// Content block types
export interface TextContent {
  type: "text";
  text: string;
  /** Provider-specific metadata (e.g., Google's thinking signatures) */
  metadata?: Record<string, unknown>;
}

export interface ToolUseContent {
  type: "tool_use";
  /** Unique identifier for this tool use. */
  id: string;
  /** Name of the tool being called */
  name: string;
  /** Input arguments for the tool */
  input: unknown;
  /** Provider-specific metadata (e.g., Google's thinking signatures) */
  metadata?: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  /** ID of the tool_use this is a result for. */
  tool_use_id: string;
  /** Name of the tool */
  name: string;
  /** Result content */
  content: TextContent[];
  /** Whether the tool execution resulted in an error */
  isError?: boolean;
}

export type ContentBlock = TextContent | ToolUseContent;
export type MessageContent = ContentBlock | ToolResultContent;

export interface Message {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export interface MessageParam {
  role: "user" | "assistant";
  content: MessageContent[];
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export interface MessageResponse {
  message: Message;
  usage: Usage;
}

export namespace AI {
  export const prompt = async (
    provider: Provider,
    input: MessageParam[],
    model?: ModelId,
  ) => {
    const authStorage = new AuthStorage();

    switch (provider) {
      case Provider.Anthropic: {
        const apiKey = authStorage.get(Provider.Anthropic);
        const response = AnthropicProvider.prompt(input, {
          apiKey,
          tools: Object.values(tools),
          model: model as AnthropicModelId,
        });
        return response;
      }
      case Provider.Google: {
        const apiKey = authStorage.get(Provider.Google);
        const response = GoogleProvider.prompt(input, {
          apiKey,
          tools: Object.values(tools),
          model: model as GoogleModelId,
        });
        return response;
      }
      case Provider.OpenAI: {
        const apiKey = authStorage.get(Provider.OpenAI);
        const response = OpenAIProvider.prompt(input, {
          apiKey,
          tools: Object.values(tools),
          model: model as OpenAIModelId,
        });
        return response;
      }
    }
  };

  /**
   * Summarize text using the small model for the given provider.
   * Used for context compression when conversation gets too long.
   */
  export const summarize = async (
    provider: Provider,
    text: string,
  ): Promise<string> => {
    const smallModel = SMALL_MODELS[provider];
    const input: MessageParam[] = [
      {
        role: "user",
        content: [{ type: "text", text }],
      },
    ];

    const response = await prompt(provider, input, smallModel);

    // Extract text from response
    for (const block of response.message.content) {
      if (block.type === "text") {
        return block.text;
      }
    }
    return "";
  };

  export const stream = (
    provider: Provider,
    input: MessageParam[],
    systemPrompt?: string,
    model?: ModelId,
  ) => {
    const authStorage = new AuthStorage();

    switch (provider) {
      case Provider.Anthropic: {
        const apiKey = authStorage.get(Provider.Anthropic);
        const stream = AnthropicProvider.stream(input, {
          apiKey,
          systemPrompt,
          tools: Object.values(tools),
          model: model as AnthropicModelId,
        });
        return stream;
      }
      case Provider.Google: {
        const apiKey = authStorage.get(Provider.Google);
        const stream = GoogleProvider.stream(input, {
          apiKey,
          systemPrompt,
          tools: Object.values(tools),
          model: model as GoogleModelId,
        });
        return stream;
      }
      case Provider.OpenAI: {
        const apiKey = authStorage.get(Provider.OpenAI);
        const stream = OpenAIProvider.stream(input, {
          apiKey,
          systemPrompt,
          tools: Object.values(tools),
          model: model as OpenAIModelId,
        });
        return stream;
      }
    }
  };
}
