import OpenAI from "openai";
import type {
  Response,
  ResponseInputItem,
  ResponseStreamEvent,
  FunctionTool,
} from "openai/resources/responses/responses";

import type {
  ContentBlock,
  MessageResponse,
  MessageParam,
  MessageDelta,
} from "../ai";
import type { Tool } from "../tools";

export type OpenAIModelId = "gpt-5.2-codex" | "gpt-5.1-codex-mini" | "gpt-4o-mini";

export const DEFAULT_OPENAI_MODEL: OpenAIModelId = "gpt-5.1-codex-mini";

export const SMALL_OPENAI_MODEL: OpenAIModelId = "gpt-4o-mini";

export const AVAILABLE_OPENAI_MODELS: { id: OpenAIModelId; name: string }[] = [
  { id: "gpt-5.2-codex", name: "GPT-5.2 Codex" },
  { id: "gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini" },
];

export interface OpenAIStreamOptions {
  apiKey?: string;
  tools?: Tool<any>[];
  systemPrompt?: string;
  model?: OpenAIModelId;
}

export namespace OpenAIProvider {
  export const prompt = async (
    input: MessageParam[],
    options?: OpenAIStreamOptions,
  ) => {
    const {
      apiKey,
      tools,
      systemPrompt,
      model = DEFAULT_OPENAI_MODEL,
    } = options || {};

    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model,
      instructions: systemPrompt,
      input: input.map(message_param_to_input_item).flat(),
      tools: tools?.map(tool_to_function_tool),
    });

    return response_to_message_response(response);
  };

  export const stream = (
    input: MessageParam[],
    options?: OpenAIStreamOptions,
  ) => {
    const {
      apiKey,
      systemPrompt,
      tools,
      model = DEFAULT_OPENAI_MODEL,
    } = options || {};

    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    const client = new OpenAI({ apiKey });

    const streamResponse = client.responses.create({
      model,
      instructions: systemPrompt,
      input: input.map(message_param_to_input_item).flat(),
      tools: tools?.map(tool_to_function_tool),
      stream: true,
    });

    // Accumulated state for full message
    let accumulatedContent = "";
    let accumulatedFunctionCalls: Map<
      string,
      { call_id: string; name: string; arguments: string }
    > = new Map();
    let finalUsage = { input_tokens: 0, output_tokens: 0 };
    let streamComplete: Promise<void>;
    let resolveStreamComplete: () => void;

    streamComplete = new Promise((resolve) => {
      resolveStreamComplete = resolve;
    });

    return {
      fullMessage: async function () {
        await streamComplete;
        return build_message_response(
          accumulatedContent,
          accumulatedFunctionCalls,
          finalUsage,
        );
      },
      streamText: async function* () {
        let isFirst = true;
        const stream = await streamResponse;

        for await (const event of stream) {
          if (isFirst) {
            yield {
              type: "message_start",
              role: "assistant",
            } as MessageDelta;
            isFirst = false;
          }

          const delta = process_stream_event(
            event,
            accumulatedFunctionCalls,
            (text) => {
              accumulatedContent += text;
            },
            (usage) => {
              finalUsage = usage;
            },
          );

          if (delta) {
            yield delta;
          }
        }

        resolveStreamComplete();
      },
    };
  };

  const process_stream_event = (
    event: ResponseStreamEvent,
    functionCalls: Map<
      string,
      { call_id: string; name: string; arguments: string }
    >,
    onText: (text: string) => void,
    onUsage: (usage: { input_tokens: number; output_tokens: number }) => void,
  ): MessageDelta | null => {
    switch (event.type) {
      case "response.output_text.delta":
        onText(event.delta);
        return { type: "text_update", text: event.delta } as MessageDelta;

      case "response.function_call_arguments.delta": {
        const existing = functionCalls.get(event.item_id);
        if (existing) {
          existing.arguments += event.delta;
        }
        return null;
      }

      case "response.output_item.added": {
        if (
          event.item.type === "function_call" &&
          event.item.id &&
          event.item.call_id
        ) {
          functionCalls.set(event.item.id, {
            call_id: event.item.call_id,
            name: event.item.name,
            arguments: "",
          });
        }
        return null;
      }

      case "response.completed": {
        if (event.response.usage) {
          onUsage({
            input_tokens: event.response.usage.input_tokens,
            output_tokens: event.response.usage.output_tokens,
          });
        }
        return null;
      }

      default:
        return null;
    }
  };

  const tool_to_function_tool = (tool: Tool<any>): FunctionTool => {
    return {
      type: "function",
      name: tool.definition.name,
      description: tool.definition.description,
      parameters: tool.definition.input_schema,
      strict: false,
    };
  };

  const message_param_to_input_item = (
    message: MessageParam,
  ): ResponseInputItem[] => {
    const items: ResponseInputItem[] = [];

    if (message.role === "user") {
      const toolResults = message.content.filter(
        (c) => c.type === "tool_result",
      );
      const textContent = message.content.filter((c) => c.type === "text");

      // Add function call outputs
      for (const result of toolResults) {
        if (result.type === "tool_result") {
          items.push({
            type: "function_call_output",
            // OpenAI always provides call_ids, but our generic type allows undefined for Google compatibility
            call_id: result.tool_use_id ?? "",
            output: result.content.map((c) => c.text).join("\n"),
          });
        }
      }

      // Add user message using EasyInputMessage format
      if (textContent.length > 0) {
        items.push({
          role: "user",
          content: textContent
            .map((c) => (c.type === "text" ? c.text : ""))
            .join("\n"),
        });
      }
    } else if (message.role === "assistant") {
      const textContent = message.content.filter((c) => c.type === "text");
      const toolUses = message.content.filter((c) => c.type === "tool_use");

      // Add assistant message with text using EasyInputMessage format
      if (textContent.length > 0) {
        items.push({
          role: "assistant",
          content: textContent
            .map((c) => (c.type === "text" ? c.text : ""))
            .join("\n"),
        });
      }

      // Add function calls as separate items
      for (const toolUse of toolUses) {
        if (toolUse.type === "tool_use") {
          items.push({
            type: "function_call",
            // OpenAI always provides call_ids, but our generic type allows undefined for Google compatibility
            call_id: toolUse.id ?? "",
            name: toolUse.name,
            arguments: JSON.stringify(toolUse.input),
          });
        }
      }
    }

    return items;
  };

  const build_message_response = (
    content: string,
    functionCalls: Map<
      string,
      { call_id: string; name: string; arguments: string }
    >,
    usage: { input_tokens: number; output_tokens: number },
  ): MessageResponse => {
    const contentBlocks: ContentBlock[] = [];

    if (content) {
      contentBlocks.push({ type: "text", text: content });
    }

    for (const [, funcCall] of functionCalls) {
      try {
        contentBlocks.push({
          type: "tool_use",
          id: funcCall.call_id,
          name: funcCall.name,
          input: JSON.parse(funcCall.arguments),
        });
      } catch {
        // Skip malformed function calls
      }
    }

    return {
      message: {
        role: "assistant",
        content: contentBlocks,
      },
      usage,
    };
  };

  const response_to_message_response = (
    response: Response,
  ): MessageResponse => {
    const content: ContentBlock[] = [];

    for (const item of response.output) {
      if (item.type === "message" && item.role === "assistant") {
        for (const contentItem of item.content) {
          if (contentItem.type === "output_text") {
            content.push({ type: "text", text: contentItem.text });
          }
        }
      } else if (item.type === "function_call") {
        content.push({
          type: "tool_use",
          id: item.call_id,
          name: item.name,
          input: JSON.parse(item.arguments),
        });
      }
    }

    return {
      message: {
        role: "assistant",
        content,
      },
      usage: {
        input_tokens: response.usage?.input_tokens || 0,
        output_tokens: response.usage?.output_tokens || 0,
      },
    };
  };
}
