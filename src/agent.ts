import { AI, type Message } from "./ai";
import { Provider } from "./providers";

export class Agent {
  private context: Message[] = [];

  async *stream(input: string) {
    const { fullMessage, streamText } = AI.stream(Provider.Anthropic, [
      ...this.context,
      this.nextMessage(input),
    ]);

    for await (const event of streamText()) {
      yield event;
    }

    const message = await fullMessage();
    this.runToolCalls(message);
    this.context.push(message);
  }

  async prompt(input: string) {
    const response = await AI.prompt(Provider.Anthropic, [
      ...this.context,
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

  runToolCalls(message: Message) {
    console.log(message);
  }
}
