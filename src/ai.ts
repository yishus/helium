import { AnthropicProvider } from "./providers/anthropic";
import { AuthStorage } from "./auth-storage";
import { Provider } from "./providers";
import tools from "./tools";

interface MessageStartDelta {
  type: "message_start";
  role: "user" | "assistant";
}

interface TextStartDelta {
  type: "text_start";
  text: string;
}

interface TextUpdateDelta {
  type: "text_update";
  text: string;
}

interface IgnoredDelta {
  type: "ignored";
}

export type MessageDelta =
  | MessageStartDelta
  | TextStartDelta
  | TextUpdateDelta
  | IgnoredDelta;

interface MessageTextContent {
  type: "text";
  text: string;
}

interface MessageToolUseContent {
  type: "tool_use";
  id: string;
  input: unknown;
  name: string;
}

type ContentBlock = MessageTextContent | MessageToolUseContent;

export interface Message {
  role: "user" | "assistant";
  content: ContentBlock[];
}

interface MessageToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: MessageTextContent[];
  isError?: boolean;
}

export interface MessageParam {
  role: "user" | "assistant";
  content: Array<ContentBlock | MessageToolResultContent>;
}

export namespace AI {
  export const prompt = async (provider: Provider, input: MessageParam[]) => {
    const authStorage = new AuthStorage();

    switch (provider) {
      case Provider.Anthropic:
        const apiKey = authStorage.get(Provider.Anthropic);
        const response = AnthropicProvider.prompt(input, {
          apiKey,
          tools: Object.values(tools),
        });
        return response;
    }
  };

  export const stream = (provider: Provider, input: MessageParam[]) => {
    const authStorage = new AuthStorage();

    switch (provider) {
      case Provider.Anthropic:
        const apiKey = authStorage.get(Provider.Anthropic);
        const stream = AnthropicProvider.stream(input, {
          apiKey,
          tools: Object.values(tools),
        });
        return stream;
    }
  };
}
