import { AI, type Message, type MessageParam } from "./ai";
import { Provider } from "./providers";
import tools, {
  callTool,
  requestToolUsePermission,
  toolUseDescription,
  type ToolInputMap,
  type ToolName,
} from "./tools";

interface StreamOptions {
  canUseTool?: (name: string, input: unknown) => Promise<boolean>;
  emitMessage?: (message: string) => void;
  saveToSessionMemory?: (key: string, value: unknown) => void;
}

export class Agent {
  private context: MessageParam[] = [];

  constructor(public systemPrompt?: string) {}

  async *stream(input?: string, options?: StreamOptions) {
    const { canUseTool, emitMessage, saveToSessionMemory } = options || {};
    if (input) {
      this.context.push(this.nextMessage(input));
    }
    while (true) {
      const { fullMessage, streamText } = AI.stream(
        Provider.Anthropic,
        this.context,
        this.systemPrompt,
      );

      for await (const event of streamText()) {
        yield event;
      }

      const message = await fullMessage();
      this.context.push(message);
      if (message.content.every((c) => c.type !== "tool_use")) {
        break;
      }
      const success = await this.runToolCalls(
        message,
        canUseTool,
        emitMessage,
        saveToSessionMemory,
      );
      if (!success) {
        break;
      }
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
    emitMessage?: (message: string) => void,
    saveToSessionMemory?: (key: string, value: unknown) => void,
  ): Promise<boolean> {
    const messageToProcess = message;
    let responses = [];
    let interrupted = false;
    for (const content of messageToProcess.content) {
      if (content.type === "tool_use") {
        const { id, name, input } = content;
        if (interrupted) {
          responses.push({
            id,
            content: [
              {
                type: "text" as const,
                text: "Tool use was interrupted.",
              },
            ],
            isError: true,
          });
          continue;
        }
        if (requestToolUsePermission[name as ToolName] && canUseTool) {
          const canUse = await canUseTool(name, input);
          if (!canUse) {
            emitMessage?.(
              `Interrupted: ${name} ${toolUseDescription(name as ToolName, input)}`,
            );
            responses.push({
              id,
              content: [
                {
                  type: "text" as const,
                  text: "Tool use is not permitted.",
                },
              ],
              isError: true,
            });
            interrupted = true;
            continue;
          }
        }
        const tool = tools[name as ToolName];
        if (tool) {
          emitMessage?.(
            `${name} ${toolUseDescription(name as ToolName, input)}`,
          );
          const result = await callTool(
            name as ToolName,
            input as ToolInputMap[ToolName],
          );
          if (name === "read") {
            const readInput = input as ToolInputMap["read"];
            saveToSessionMemory?.(readInput.path, result);
          }
          responses.push({
            id,
            content: [{ type: "text" as const, text: result }],
          });
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

    return interrupted === false;
  }
}
