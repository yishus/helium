import { AI, type Message } from "./ai";
import { Provider } from "./providers";

export class Agent {
  _context: Message[] = [];

  stream(input: string) {
    const stream = AI.stream(Provider.Anthropic, [
      ...this._context,
      this.nextMessage(input),
    ]);
    return stream;
  }

  async prompt(input: string) {
    const response = await AI.prompt(Provider.Anthropic, [
      ...this._context,
      this.nextMessage(input),
    ]);
    return { response, text: this.textResponse(response) };
  }

  nextMessage(input: string) {
    return {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: input,
        },
      ],
    };
  }

  textResponse(message: Message) {
    for (const content of message.content) {
      if (content.type === "text") {
        return content.text;
      }
    }
  }
}
