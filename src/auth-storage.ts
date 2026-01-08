import { join } from "path";
import { homedir } from "os";
import { readFileSync } from "fs";

interface AuthCredential {
  apiKey?: string;
}

type AuthStorageData = Record<string, AuthCredential>;

export class AuthStorage {
  private data: AuthStorageData = {};

  constructor() {
    const authFilePath = join(homedir(), ".helium", "agent", "auth.json");
    this.data = JSON.parse(readFileSync(authFilePath, "utf-8"));
  }

  get(provider: string): string | undefined {
    return this.data[provider]?.apiKey;
  }
}
