import { AI } from "./ai";

export namespace Session {
  export const prompt = async (input: string) => {
    const stream = AI.stream(input);
    console.log("Streaming response:");
    for await (const messageStreamEvent of stream) {
      console.log(messageStreamEvent);
    }
  };
}
