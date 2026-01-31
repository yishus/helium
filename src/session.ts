import { readFileSync } from "fs";
import { join } from "path";
import EventEmitter from "events";

import {
  type MessageDelta,
  type ModelId,
  DEFAULT_MODEL,
  AVAILABLE_MODELS,
  DEFAULT_GOOGLE_MODEL,
  AVAILABLE_GOOGLE_MODELS,
  DEFAULT_OPENAI_MODEL,
  AVAILABLE_OPENAI_MODELS,
} from "./ai";
import { Agent } from "./agent";
import { Provider } from "./providers";
import { toolUseDescription, type ToolInputMap, type ToolName } from "./tools";
import { generateEditDiff, generateWriteDiff } from "./helper";
import { isErrnoException } from "./type-helper";
import { TokenCostHelper } from "./token-cost";

export type { ModelId };
export { Provider };
export {
  DEFAULT_MODEL,
  AVAILABLE_MODELS,
  DEFAULT_GOOGLE_MODEL,
  AVAILABLE_GOOGLE_MODELS,
  DEFAULT_OPENAI_MODEL,
  AVAILABLE_OPENAI_MODELS,
};

export interface ProviderModel {
  id: ModelId;
  name: string;
  provider: Provider;
}

export const ALL_MODELS: ProviderModel[] = [
  ...AVAILABLE_MODELS.map((m) => ({ ...m, provider: Provider.Anthropic })),
  ...AVAILABLE_GOOGLE_MODELS.map((m) => ({ ...m, provider: Provider.Google })),
  ...AVAILABLE_OPENAI_MODELS.map((m) => ({ ...m, provider: Provider.OpenAI })),
];

export interface UIMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ToolUseRequest {
  toolName: string;
  description: string;
  input: unknown;
}

const SYSTEM_PROMPT_PATH = join(__dirname, "prompts/system_workflow.md");

export class Session {
  agent: Agent;
  eventEmitter = new EventEmitter();
  canUseToolHandler?: (request: ToolUseRequest) => Promise<boolean>;
  memory: { [key: string]: any } = {};
  totalCost = 0;

  constructor() {
    let systemReminderStart;
    try {
      const claudeMd = readFileSync(process.cwd() + "/CLAUDE.md", "utf8");
      if (claudeMd) {
        const startReminder = readFileSync(
          join(__dirname, "prompts/system_reminder_start.md"),
          "utf8",
        );
        systemReminderStart = startReminder.replace(
          "${START_CONTEXT}",
          claudeMd,
        );
      }
    } catch (err: unknown) {
      if (!isErrnoException(err) || err.code !== "ENOENT") {
        throw err;
      }
    } finally {
      this.agent = new Agent(
        readFileSync(SYSTEM_PROMPT_PATH, "utf8"),
        systemReminderStart,
      );
    }
  }

  async prompt(input: string) {
    const stream = this.agent.stream(input, {
      canUseTool: this.handleToolUseRequest.bind(this),
      emitMessage: this.handleEmitMessage.bind(this),
      saveToSessionMemory: this.handleSaveToSessionMemory.bind(this),
      updateTokenUsage: this.handleTokenUsage.bind(this),
    });
    for await (const event of stream) {
      this.processDelta(event);
    }
  }

  async handleToolUseRequest(toolName: string, input: unknown) {
    const description = toolUseDescription(toolName as ToolName, input);
    const canUse = await this.canUseToolHandler?.({
      toolName,
      description,
      input,
    });
    return canUse || false;
  }

  handleEmitMessage(message: string) {
    this.eventEmitter.emit("message_start", { role: "assistant" });
    this.eventEmitter.emit("message_update", { text: message });
  }

  handleSaveToSessionMemory(key: string, value: unknown) {
    this.memory[key] = value;
  }

  handleTokenUsage(input_tokens: number, output_tokens: number) {
    const streamCost = TokenCostHelper.calculateCost(
      input_tokens,
      output_tokens,
      this.agent.model,
    ).totalCost;
    this.totalCost += streamCost;
    this.eventEmitter.emit("token_usage_update", {
      cost: this.totalCost,
      token_count: input_tokens + output_tokens,
    });
  }

  setModel(model: ModelId, provider?: Provider) {
    this.agent.model = model;
    if (provider) {
      this.agent.provider = provider;
    }
  }

  getModel(): ModelId {
    return this.agent.model;
  }

  setProvider(provider: Provider) {
    this.agent.provider = provider;
  }

  getProvider(): Provider {
    return this.agent.provider;
  }

  processDelta(delta: MessageDelta) {
    if (delta.type === "message_start") {
      this.eventEmitter.emit("message_start", { role: delta.role });
    }

    if (delta.type == "text_update") {
      this.eventEmitter.emit("message_update", { text: delta.text });
    }
  }

  computeEditDiff(input: ToolInputMap["edit"]): string {
    const content = this.memory[input.path] as string;
    return generateEditDiff(
      input.path,
      content,
      input.old_string,
      input.new_string,
    );
  }

  computeWriteDiff(input: ToolInputMap["write"]): string {
    const existingContent = this.memory[input.path] as string | undefined;
    return generateWriteDiff(input.path, existingContent, input.content);
  }
}
