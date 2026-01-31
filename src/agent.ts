import {
  AI,
  type Message,
  type MessageParam,
  type ModelId,
  DEFAULT_MODEL,
} from "./ai";
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
  updateTokenUsage?: (input_tokens: number, output_tokens: number) => void;
}

export class Agent {
  private context: MessageParam[] = [];
  totalTokensUsed = 0;
  model: ModelId = DEFAULT_MODEL;
  provider: Provider = Provider.Anthropic;

  constructor(
    public systemPrompt?: string,
    public systemReminderStart?: string,
  ) {}

  async *stream(input?: string, options?: StreamOptions) {
    const { canUseTool, emitMessage, saveToSessionMemory, updateTokenUsage } =
      options || {};
    if (this.context.length === 0 && this.systemReminderStart) {
      this.context.push({
        role: "user",
        content: [
          {
            type: "text",
            text: this.systemReminderStart,
          },
        ],
      });
    }

    if (input) {
      this.context.push(this.nextMessage(input));
    }

    while (true) {
      const { fullMessage, streamText } = AI.stream(
        this.provider,
        this.context,
        this.systemPrompt,
        this.model,
      );

      for await (const event of streamText()) {
        yield event;
      }

      const { message, usage } = await fullMessage();
      this.totalTokensUsed += usage.input_tokens + usage.output_tokens;
      updateTokenUsage?.(usage.input_tokens, usage.output_tokens);
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
    const { message } = await AI.prompt(
      this.provider,
      [...this.context, this.nextMessage(input)],
      this.model,
    );
    return { message, text: this.textResponse(message) };
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
            name,
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
              name,
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
            name,
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
        name: res.name,
        content: res.content,
      })),
    });

    return interrupted === false;
  }
}
