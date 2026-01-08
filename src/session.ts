import { AI } from "./ai";
import { type EventBusController } from "./event-bus";

interface SessionOptions {
  eventBus: EventBusController;
}

export class Session {
  messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  eventBus: EventBusController;

  constructor(options: SessionOptions) {
    this.eventBus = options.eventBus;
  }

  prompt(input: string) {
    (async () => {
      const stream = AI.stream(input);
      for await (const event of stream) {
        console.log("Session stream event:", event);
        this.eventBus.emit("sessionStream", event);
      }
    })();
  }
}
