import { readFile } from "fs/promises";
import { AI, type Message, type MessageParam, type ModelId } from "./ai";
import { Provider } from "./providers";
import type { QuestionAnswer } from "./session";
import tools, {
  callTool,
  requestToolUsePermission,
  toolUseDescription,
  type ToolInputMap,
  type ToolName,
  type AskUserQuestionInput,
} from "./tools";

interface StreamOptions {
  canUseTool?: (name: string, input: unknown) => Promise<boolean>;
  askUserQuestion?: (input: AskUserQuestionInput) => Promise<QuestionAnswer[]>;
  emitMessage?: (message: string) => void;
  saveToSessionMemory?: (key: string, value: unknown) => void;
  updateTokenUsage?: (input_tokens: number, output_tokens: number) => void;
}

// Token thresholds for summarization
const TOKEN_THRESHOLD = 80000; // Trigger summarization at 80K tokens
const RECENT_TURNS_TO_KEEP = 10; // Keep last 10 conversation turns intact

export class Agent {
  private context: MessageParam[] = [];
  private contextTokens: number = 0;

  constructor(
    public model: ModelId,
    public provider: Provider,
    public systemPrompt?: string,
    public systemReminderStart?: string,
  ) {}

  /**
   * Format messages as readable text for summarization.
   */
  private formatMessagesAsText(messages: MessageParam[]): string {
    const parts: string[] = [];

    for (const message of messages) {
      const role = message.role === "user" ? "User" : "Assistant";
      const contentParts: string[] = [];

      for (const block of message.content) {
        if (block.type === "text") {
          contentParts.push(block.text);
        } else if (block.type === "tool_use") {
          contentParts.push(
            `[Tool: ${block.name}] Input: ${JSON.stringify(block.input).slice(0, 200)}...`,
          );
        } else if (block.type === "tool_result") {
          // Truncate long tool results
          const resultText = block.content
            .map((c) => c.text)
            .join("\n")
            .slice(0, 500);
          contentParts.push(
            `[Tool Result: ${block.name}] ${resultText}${resultText.length >= 500 ? "..." : ""}`,
          );
        }
      }

      parts.push(`${role}:\n${contentParts.join("\n")}`);
    }

    return parts.join("\n\n---\n\n");
  }

  /**
   * Generate a summary of messages using a small model.
   */
  private async generateSummary(messages: MessageParam[]): Promise<string> {
    const promptTemplate = await readFile(
      new URL("./prompts/summarize.md", import.meta.url),
      "utf-8",
    );

    const conversationText = this.formatMessagesAsText(messages);
    const prompt = promptTemplate.replace("$conversation", conversationText);

    return AI.summarize(this.provider, prompt);
  }

  /**
   * Check if context needs summarization and perform it if necessary.
   */
  private async maybeSummarize(
    emitMessage?: (message: string) => void,
  ): Promise<void> {
    if (this.contextTokens < TOKEN_THRESHOLD) {
      return;
    }

    // Calculate how many messages to keep (recent turns)
    // Each turn is typically 2 messages (user + assistant)
    const recentCount = RECENT_TURNS_TO_KEEP * 2;

    // Don't summarize if we don't have enough messages
    if (this.context.length <= recentCount) {
      return;
    }

    const toSummarize = this.context.slice(0, -recentCount);
    const toKeep = this.context.slice(-recentCount);

    emitMessage?.("Summarizing conversation context...");

    const summary = await this.generateSummary(toSummarize);

    // Replace old messages with summary
    this.context = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `<context-summary>\nThe following is a summary of our earlier conversation:\n\n${summary}\n</context-summary>`,
          },
        ],
      },
      ...toKeep,
    ];

    // Reset token count - will be updated on next API call
    this.contextTokens = 0;

    emitMessage?.("Context summarized.");
  }

  async *stream(input?: string, options?: StreamOptions) {
    const {
      canUseTool,
      askUserQuestion,
      emitMessage,
      saveToSessionMemory,
      updateTokenUsage,
    } = options || {};
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
      updateTokenUsage?.(usage.input_tokens, usage.output_tokens);
      this.contextTokens = usage.input_tokens; // Track current context size

      // Check if we need to summarize before continuing
      await this.maybeSummarize(emitMessage);

      this.context.push(message);
      if (message.content.every((c) => c.type !== "tool_use")) {
        break;
      }
      const success = await this.runToolCalls(
        message,
        canUseTool,
        askUserQuestion,
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

  formatQuestionAnswers(answers: QuestionAnswer[]): string {
    if (answers.length === 0) {
      return "User cancelled the question dialog.";
    }

    return answers
      .map((answer, idx) => {
        const parts: string[] = [`Question ${idx + 1}: ${answer.question}`];

        if (answer.selectedLabels.length > 0) {
          parts.push(`Selected: ${answer.selectedLabels.join(", ")}`);
        }

        if (answer.customText) {
          parts.push(`Custom response: ${answer.customText}`);
        }

        if (answer.selectedLabels.length === 0 && !answer.customText) {
          parts.push("No selection made.");
        }

        return parts.join("\n");
      })
      .join("\n\n");
  }

  async runToolCalls(
    message: Message,
    canUseTool?: (name: string, input: unknown) => Promise<boolean>,
    askUserQuestion?: (
      input: AskUserQuestionInput,
    ) => Promise<QuestionAnswer[]>,
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

          // Special handling for askUserQuestion tool
          if (name === "askUserQuestion" && askUserQuestion) {
            const askInput = input as AskUserQuestionInput;
            const answers = await askUserQuestion(askInput);
            const result = this.formatQuestionAnswers(answers);
            responses.push({
              id,
              name,
              content: [{ type: "text" as const, text: result }],
            });
            continue;
          }

          const result = await callTool(
            name as ToolName,
            input as ToolInputMap[ToolName],
            { provider: this.provider },
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
        } else {
          responses.push({
            id,
            name,
            content: [
              {
                type: "text" as const,
                text: "Tool not found.",
              },
            ],
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
