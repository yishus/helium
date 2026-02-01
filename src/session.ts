import { mkdir, readFileSync } from "fs";
import { join } from "path";
import EventEmitter from "events";
import { execSync } from "child_process";
import { platform, release, tmpdir } from "os";

import {
  type MessageDelta,
  type ModelId,
  AVAILABLE_ANTHROPIC_MODELS,
  AVAILABLE_GOOGLE_MODELS,
  AVAILABLE_OPENAI_MODELS,
  DEFAULT_ANTHROPIC_MODEL,
} from "./ai";
import { Agent } from "./agent";
import { Provider } from "./providers";
import { toolUseDescription, type ToolInputMap, type ToolName } from "./tools";
import { generateEditDiff, generateWriteDiff } from "./helper";
import { isErrnoException } from "./type-helper";
import { TokenCostHelper } from "./token-cost";

export type { ModelId };
export { Provider };

export interface ProviderModel {
  id: ModelId;
  name: string;
  provider: Provider;
}

export const ALL_MODELS: ProviderModel[] = [
  ...AVAILABLE_ANTHROPIC_MODELS.map((m) => ({
    ...m,
    provider: Provider.Anthropic,
  })),
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
  model: ModelId = DEFAULT_ANTHROPIC_MODEL;
  provider: Provider = Provider.Anthropic;
  eventEmitter = new EventEmitter();
  canUseToolHandler?: (request: ToolUseRequest) => Promise<boolean>;
  memory: { [key: string]: any } = {};
  totalCost = 0;

  constructor() {
    // Create scratchpad directory if it doesn't exist
    const cwd = process.cwd();
    const scratchpadPath = join(
      tmpdir(),
      "helium",
      cwd.replace(/[:/\\]/g, "-"),
      "scratchpad",
    );
    mkdir(scratchpadPath, { recursive: true }, (err) => {
      if (err) throw err;
    });
    let systemPrompt: string | undefined;
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
      const readSystemPrompt = readFileSync(SYSTEM_PROMPT_PATH, "utf8");
      const isGitRepo = execSync("git rev-parse --is-inside-work-tree");
      const modelName = ALL_MODELS.find((m) => m.id === this.model)?.name || "";
      systemPrompt = readSystemPrompt
        .replace("$cwd", cwd)
        .replace("$isGitRepo", isGitRepo ? "true" : "false")
        .replace("$OS", platform())
        .replace("$OSVersion", release())
        .replace("$date", new Date().toISOString().split("T")[0] || "")
        .replace("$model", modelName)
        .replace("$modelId", this.model)
        .replace("$scratchpadPath", scratchpadPath)
        .replace(
          "$branch",
          execSync("git rev-parse --abbrev-ref HEAD").toString().trim(),
        )
        .replace(
          "$gitStatus",
          execSync('git log -n 5 --pretty=format:"%h %s"').toString().trim(),
        )
        .replace("$recentCommits", execSync("git status -s").toString().trim());
    } catch (err: unknown) {
      if (!isErrnoException(err) || err.code !== "ENOENT") {
        throw err;
      }
    } finally {
      this.agent = new Agent(
        this.model,
        this.provider,
        systemPrompt,
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
      input_tokens,
      output_tokens,
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
