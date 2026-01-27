import Anthropic from "@anthropic-ai/sdk";
import type {
  Message as AnthropicMessage,
  MessageParam as AnthropicMessageParam,
  RawMessageStreamEvent,
} from "@anthropic-ai/sdk/resources/messages";

import type { Message, MessageParam, MessageDelta } from "../ai";
import type { Tool } from "../tools";

export interface AnthropicStreamOptions {
  apiKey?: string;
  tools?: Tool<any>[];
  systemPrompt?: string;
}

export namespace AnthropicProvider {
  export const prompt = async (
    input: MessageParam[],
    options?: AnthropicStreamOptions,
  ) => {
    const { apiKey, tools } = options || {};
    const client = new Anthropic({
      apiKey: apiKey,
    });

    const response = await client.messages.create({
      max_tokens: 1024,
      messages: input.map(message_param_to_anthropic_message_param),
      tools: tools?.map((tool) => tool.definition),
      model: "claude-sonnet-4-5-20250929",
    });

    return anthropic_message_to_message(response);
  };

  export const stream = (
    input: MessageParam[],
    options?: AnthropicStreamOptions,
  ) => {
    const { apiKey, systemPrompt, tools } = options || {};
    const client = new Anthropic({
      apiKey: apiKey,
    });

    const stream = client.messages.stream({
      max_tokens: 1024,
      messages: input.map(message_param_to_anthropic_message_param),
      tools: tools?.map((tool) => tool.definition),
      model: "claude-sonnet-4-5-20250929",
      system: systemPrompt,
    });

    return {
      fullMessage: async function () {
        const message: AnthropicMessage = await stream.finalMessage();
        return anthropic_message_to_message(message);
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
    messge: MessageParam,
  ): AnthropicMessageParam => {
    return {
      role: messge.role,
      content: messge.content,
    };
  };

  const anthropic_message_to_message = (message: AnthropicMessage): Message => {
    return {
      role: message.role,
      content: message.content.filter(
        (c) => c.type === "text" || c.type === "tool_use",
      ),
    };
  };
}
