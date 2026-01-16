import { AI, type Message, type MessageParam } from "./ai";
import { Provider } from "./providers";
import tools from "./tools";

interface StreamOptions {
  canUseTool?: (name: string, input: unknown) => Promise<boolean>;
}

export class Agent {
  private context: MessageParam[] = [];

  async *stream(input?: string, options?: StreamOptions) {
    const { canUseTool } = options || {};
    if (input) {
      this.context.push(this.nextMessage(input));
    }
    while (true) {
      const { fullMessage, streamText } = AI.stream(
        Provider.Anthropic,
        this.context,
      );

      for await (const event of streamText()) {
        yield event;
      }

      const message = await fullMessage();
      this.context.push(message);
      if (message.content.every((c) => c.type !== "tool_use")) {
        break;
      }
      await this.runToolCalls(message, canUseTool);
    }
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

  async runToolCalls(
    message: Message,
    canUseTool?: (name: string, input: unknown) => Promise<boolean>,
  ) {
    const messageToProcess = message;
    let responses = [];
    for (const content of messageToProcess.content) {
      if (content.type === "tool_use") {
        const { id, name, input } = content;
        switch (name) {
          case "read":
            const resRead = await tools.read.callFunction(
              input as Parameters<typeof tools.read.callFunction>[0],
            );
            responses.push({
              id,
              content: [{ type: "text" as const, text: resRead }],
            });
            break;
          case "webFetch":
            if (canUseTool) {
              const canUse = await canUseTool(name, input);
              if (!canUse) {
                responses.push({
                  id,
                  content: [
                    { type: "text" as const, text: "Tool use not permitted." },
                  ],
                  isError: true,
                });
                break;
              }
            }
            const resWebFetch = await tools.webFetch.callFunction(
              input as Parameters<typeof tools.webFetch.callFunction>[0],
            );
            responses.push({
              id,
              content: [{ type: "text" as const, text: resWebFetch }],
            });
            break;
        }
      }
    }

    this.context.push({
      role: "user",
      content: responses.map((res) => ({
        type: "tool_result",
        tool_use_id: res.id,
        content: res.content,
      })),
    });
  }
}
