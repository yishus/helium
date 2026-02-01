import {
  GoogleGenAI,
  type Content,
  type Part,
  type FunctionDeclaration,
  type GenerateContentResponseUsageMetadata,
} from "@google/genai";

import type {
  ContentBlock,
  MessageResponse,
  MessageParam,
  MessageDelta,
} from "../ai";
import type { Tool } from "../tools";

export type GoogleModelId =
  | "gemini-3-flash-preview"
  | "gemini-3-pro-preview"
  | "gemini-2.5-pro"
  | "gemini-2.0-flash";

export const DEFAULT_GOOGLE_MODEL: GoogleModelId = "gemini-3-flash-preview";

export const SMALL_GOOGLE_MODEL: GoogleModelId = "gemini-2.0-flash";

export const AVAILABLE_GOOGLE_MODELS: { id: GoogleModelId; name: string }[] = [
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro Preview" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
];

export interface GoogleStreamOptions {
  apiKey?: string;
  tools?: Tool<any>[];
  systemPrompt?: string;
  model?: GoogleModelId;
}

export namespace GoogleProvider {
  export const prompt = async (
    input: MessageParam[],
    options?: GoogleStreamOptions,
  ) => {
    const { apiKey, tools, model = DEFAULT_GOOGLE_MODEL } = options || {};

    if (!apiKey) {
      throw new Error("Google API key is required");
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: input.map(message_param_to_google_content),
      config: {
        tools: tools
          ? [{ functionDeclarations: tools.map(tool_to_function_declaration) }]
          : undefined,
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    return google_response_to_message_response(parts, response.usageMetadata);
  };

  export const stream = (
    input: MessageParam[],
    options?: GoogleStreamOptions,
  ) => {
    const {
      apiKey,
      systemPrompt,
      tools,
      model = DEFAULT_GOOGLE_MODEL,
    } = options || {};

    if (!apiKey) {
      throw new Error("Google API key is required");
    }

    const ai = new GoogleGenAI({ apiKey });
    const streamResponse = ai.models.generateContentStream({
      model,
      contents: input.map(message_param_to_google_content),
      config: {
        tools: tools
          ? [{ functionDeclarations: tools.map(tool_to_function_declaration) }]
          : undefined,
        systemInstruction: systemPrompt,
      },
    });

    // Shared state accumulated by streamText
    let accumulatedParts: Part[] = [];
    let usageMetadata: GenerateContentResponseUsageMetadata = {};
    let streamComplete: Promise<void>;
    let resolveStreamComplete: () => void;

    // Create a promise that resolves when streaming is complete
    streamComplete = new Promise((resolve) => {
      resolveStreamComplete = resolve;
    });

    return {
      fullMessage: async function () {
        // Wait for streamText to finish accumulating data
        await streamComplete;
        return google_response_to_message_response(
          accumulatedParts,
          usageMetadata,
        );
      },
      streamText: async function* () {
        let isFirst = true;

        const response = await streamResponse;
        for await (const chunk of response) {
          if (isFirst) {
            yield { type: "message_start", role: "assistant" } as MessageDelta;
            isFirst = false;
          }

          accumulatedParts.push(
            ...(chunk.candidates?.[0]?.content?.parts || []),
          );
          usageMetadata = chunk.usageMetadata || {};

          yield { type: "text_update", text: chunk.text || "" } as MessageDelta;
        }

        // Signal that streaming is complete
        resolveStreamComplete();
      },
    };
  };

  const tool_to_function_declaration = (
    tool: Tool<any>,
  ): FunctionDeclaration => {
    return {
      name: tool.definition.name,
      description: tool.definition.description,
      parameters: tool.definition.input_schema,
    };
  };

  const message_param_to_google_content = (message: MessageParam): Content => {
    const parts: Part[] = [];

    for (const content of message.content) {
      if (content.type === "text") {
        parts.push({
          text: content.text,
          thoughtSignature: content.metadata?.thoughtSignature as
            | string
            | undefined,
        });
      } else if (content.type === "tool_use") {
        parts.push({
          functionCall: {
            name: content.name,
            id: content.id,
            args: content.input as Record<string, unknown>,
          },
          thoughtSignature: content.metadata?.thoughtSignature as
            | string
            | undefined,
        });
      } else if (content.type === "tool_result") {
        const textContent = content.content
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("\n");
        parts.push({
          functionResponse: {
            name: content.name,
            id: content.tool_use_id,
            response: { result: textContent },
          },
        });
      }
    }

    return {
      role: message.role === "assistant" ? "model" : "user",
      parts,
    };
  };

  const google_response_to_message_response = (
    parts: Part[],
    usage: GenerateContentResponseUsageMetadata = {},
  ): MessageResponse => {
    const content: ContentBlock[] = [];

    for (const part of parts) {
      if (part.text) {
        content.push({
          type: "text",
          text: part.text,
          metadata: part.thoughtSignature
            ? { thoughtSignature: part.thoughtSignature }
            : undefined,
        });
      }

      if (part.functionCall) {
        const { args, id, name } = part.functionCall;
        if (!args || !name) continue;
        content.push({
          type: "tool_use",
          id,
          name,
          input: args,
          metadata: part.thoughtSignature
            ? { thoughtSignature: part.thoughtSignature }
            : undefined,
        });
      }
    }

    return {
      message: {
        role: "assistant",
        content,
      },
      usage: {
        input_tokens: usage.promptTokenCount || 0,
        output_tokens: usage.candidatesTokenCount || 0,
      },
    };
  };
}
