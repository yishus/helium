import Anthropic from "@anthropic-ai/sdk";

export interface AnthropicStreamOptions {
  apiKey?: string;
}

export namespace AnthropicProvider {
  export const stream = async function* (
    input: string,
    option?: AnthropicStreamOptions,
  ) {
    const client = new Anthropic({
      apiKey: option?.apiKey,
    });

    const stream = await client.messages.create({
      max_tokens: 1024,
      messages: [{ role: "user", content: "Hello, Claude" }],
      model: "claude-sonnet-4-5-20250929",
      stream: true,
    });

    for await (const messageStreamEvent of stream) {
      yield messageStreamEvent;
    }

    return stream;
  };
}
