import Anthropic from "@anthropic-ai/sdk";
import type {
  Message as AnthropicMessage,
  MessageParam,
  RawMessageStreamEvent,
} from "@anthropic-ai/sdk/resources/messages";

import type { Message, MessageDelta } from "../ai";
import type { Tool } from "../tools";

export interface AnthropicStreamOptions {
  apiKey?: string;
  tools?: Tool<any>[];
}

export namespace AnthropicProvider {
  export const prompt = async (
    input: Message[],
    options?: AnthropicStreamOptions,
  ) => {
    const { apiKey, tools } = options || {};
    const client = new Anthropic({
      apiKey: apiKey,
    });

    const response = await client.messages.create({
      max_tokens: 1024,
      messages: input.map(message_to_anthropic_message_param),
      tools: tools?.map((tool) => tool.definition),
      model: "claude-sonnet-4-5-20250929",
    });

    return anthropic_message_to_message(response);
  };

  export const stream = async function* (
    input: Message[],
    options?: AnthropicStreamOptions,
  ) {
    const { apiKey, tools } = options || {};
    const client = new Anthropic({
      apiKey: apiKey,
    });

    const stream = await client.messages.create({
      max_tokens: 1024,
      messages: input.map(message_to_anthropic_message_param),
      tools: tools?.map((tool) => tool.definition),
      model: "claude-sonnet-4-5-20250929",
      stream: true,
    });

    for await (const messageStreamEvent of stream) {
      yield anthropic_delta_to_message_delta(messageStreamEvent);
    }

    return stream;
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

  const message_to_anthropic_message_param = (
    messge: Message,
  ): MessageParam => {
    return {
      role: messge.role,
      content: messge.content,
    };
  };

  const anthropic_message_to_message = (message: AnthropicMessage) => {
    return {
      role: message.role,
      content: message.content.filter((c) => c.type === "text"),
    };
  };
}
