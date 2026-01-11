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

interface TextEndDelta {
  type: "text_end";
}

interface IgnoredDelta {
  type: "ignored";
}

export type MessageDelta =
  | MessageStartDelta
  | TextStartDelta
  | TextUpdateDelta
  | TextEndDelta
  | IgnoredDelta;

interface MessageTextContent {
  type: "text";
  text: string;
}

type ContentBlock = MessageTextContent;

export interface Message {
  role: "user" | "assistant";
  content: ContentBlock[];
}

export namespace AI {
  export const prompt = async (provider: Provider, input: Message[]) => {
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

  export const stream = (provider: Provider, input: Message[]) => {
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
