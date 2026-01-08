import { AnthropicProvider } from "./providers/anthropic";
import { AuthStorage } from "./auth-storage";

export namespace AI {
  export const stream = (input: string) => {
    const authStorage = new AuthStorage();
    const apiKey = authStorage.get("anthropic");
    const stream = AnthropicProvider.stream(input, { apiKey });
    return stream;
  };
}
