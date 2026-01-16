import EventEmitter from "events";

import { type MessageDelta } from "./ai";
import { Agent } from "./agent";

export interface UIMessage {
  role: "user" | "assistant";
  text: string;
}

export class Session {
  agent = new Agent();
  eventEmitter = new EventEmitter();
  canUseToolHandler?: (toolName: string) => Promise<boolean>;

  async prompt(input: string) {
    const stream = this.agent.stream(input, {
      canUseTool: this.handleToolUseRequest.bind(this),
    });
    for await (const event of stream) {
      this.processDelta(event);
    }
  }

  async handleToolUseRequest(toolName: string, input: unknown) {
    const canUse = await this.canUseToolHandler?.(toolName);
    return canUse || false;
  }

  processDelta(delta: MessageDelta) {
    if (delta.type === "message_start") {
      this.eventEmitter.emit("message_start", { role: delta.role });
    }

    if (delta.type == "text_start" || delta.type == "text_update") {
      this.eventEmitter.emit("message_update", { text: delta.text });
    }
  }
}
