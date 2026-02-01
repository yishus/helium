import Anthropic from "@anthropic-ai/sdk";
import type {
  Message as AnthropicMessage,
  MessageParam as AnthropicMessageParam,
  RawMessageStreamEvent,
} from "@anthropic-ai/sdk/resources/messages";

import type {
  MessageResponse,
  MessageParam,
  MessageDelta,
  ContentBlock,
} from "../ai";
import type { Tool } from "../tools";

export type AnthropicModelId =
  | "claude-sonnet-4-5-20250929"
  | "claude-opus-4-20250514"
  | "claude-haiku-4-5-20251001";

export const DEFAULT_ANTHROPIC_MODEL: AnthropicModelId =
  "claude-sonnet-4-5-20250929";

export const SMALL_ANTHROPIC_MODEL: AnthropicModelId =
  "claude-haiku-4-5-20251001";

export const AVAILABLE_ANTHROPIC_MODELS: {
  id: AnthropicModelId;
  name: string;
}[] = [
  { id: "claude-sonnet-4-5-20250929", name: "Sonnet" },
  { id: "claude-opus-4-20250514", name: "Opus" },
];

export interface AnthropicStreamOptions {
  apiKey?: string;
  tools?: Tool<any>[];
  systemPrompt?: string;
  model?: AnthropicModelId;
}

export namespace AnthropicProvider {
  export const prompt = async (
    input: MessageParam[],
    options?: AnthropicStreamOptions,
  ) => {
    const { apiKey, tools, model = DEFAULT_ANTHROPIC_MODEL } = options || {};
    const client = new Anthropic({
      apiKey: apiKey,
    });

    const response = await client.messages.create({
      max_tokens: 16384,
      messages: input.map(message_param_to_anthropic_message_param),
      tools: tools?.map((tool) => tool.definition),
      model,
    });

    return anthropic_message_to_message_response(response);
  };

  export const stream = (
    input: MessageParam[],
    options?: AnthropicStreamOptions,
  ) => {
    const {
      apiKey,
      systemPrompt,
      tools,
      model = DEFAULT_ANTHROPIC_MODEL,
    } = options || {};
    const client = new Anthropic({
      apiKey: apiKey,
    });

    const stream = client.messages.stream({
      max_tokens: 16384,
      messages: input.map(message_param_to_anthropic_message_param),
      tools: tools?.map((tool) => tool.definition),
      model,
      system: systemPrompt,
    });

    return {
      fullMessage: async function () {
        const message: AnthropicMessage = await stream.finalMessage();
        return anthropic_message_to_message_response(message);
      },
      streamText: async function* () {
        for await (const event of stream) {
          yield anthropic_delta_to_message_delta(event);
        }
      },
    };
  };

  const anthropic_delta_to_message_delta = (
    event: RawMessageStreamEvent,
  ): MessageDelta => {
    switch (event.type) {
      case "message_start":
        return {
          type: "message_start",
          role: event.message.role,
        };
      case "content_block_delta":
        if (event.delta.type === "text_delta") {
          return {
            type: "text_update",
            text: event.delta.text,
          };
        }
    }

    return {
      type: "ignored",
    };
  };

  const message_param_to_anthropic_message_param = (
    message: MessageParam,
  ): AnthropicMessageParam => {
    const content: AnthropicMessageParam["content"] = [];

    for (const block of message.content) {
      if (block.type === "text") {
        content.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        // Anthropic always provides IDs, but our generic type allows undefined for Google compatibility
        content.push({
          type: "tool_use",
          id: block.id ?? "",
          name: block.name,
          input: block.input,
        });
      } else if (block.type === "tool_result") {
        content.push({
          type: "tool_result",
          tool_use_id: block.tool_use_id ?? "",
          content: block.content.map((c) => ({
            type: "text" as const,
            text: c.text,
          })),
          is_error: block.isError,
        });
      }
    }

    return {
      role: message.role,
      content,
    };
  };

  const anthropic_message_to_message_response = (
    message: AnthropicMessage,
  ): MessageResponse => {
    const content: ContentBlock[] = [];

    for (const block of message.content) {
      if (block.type === "text") {
        content.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        content.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
    }

    return {
      message: {
        role: message.role,
        content,
      },
      usage: {
        input_tokens: message.usage.input_tokens || 0,
        output_tokens: message.usage.output_tokens || 0,
      },
    };
  };
}
