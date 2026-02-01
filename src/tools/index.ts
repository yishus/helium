import type { Static, TSchema } from "typebox";

import { Provider } from "../providers";
import askUserQuestion from "./ask-user-question";
import bash from "./bash";
import edit from "./edit";
import read from "./read";
import webFetch from "./web-fetch";
import write from "./write";

export interface ToolConfig {
  provider: Provider;
}

export interface Tool<T extends TSchema> {
  definition: {
    name: string;
    description: string;
    input_schema: T;
  };
  callFunction: (args: Static<T>, config: ToolConfig) => Promise<string>;
}

const tools = { askUserQuestion, bash, edit, read, webFetch, write };

export type ToolName = keyof typeof tools;

// Type map that extracts input types from each tool
export type ToolInputMap = {
  [K in ToolName]: Static<(typeof tools)[K]["definition"]["input_schema"]>;
};

// Typed call function that preserves the relationship
export async function callTool<T extends ToolName>(
  name: T,
  input: ToolInputMap[T],
  config: ToolConfig,
): Promise<string> {
  try {
    return await tools[name].callFunction(input as never, config);
  } catch (error) {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return "Error: Unknown error occurred";
  }
}

export const requestToolUsePermission: Record<ToolName, boolean> = {
  askUserQuestion: false, // Handled separately via askUserQuestionHandler
  bash: true,
  edit: true,
  read: false,
  webFetch: true,
  write: true,
};

export const toolUseDescription = (
  toolName: ToolName,
  input: unknown,
): string => {
  switch (toolName) {
    case "askUserQuestion":
      const askInput = input as ToolInputMap["askUserQuestion"];
      const questionCount = askInput.questions.length;
      return `${questionCount} question${questionCount > 1 ? "s" : ""}`;
    case "bash":
      const bashInput = input as ToolInputMap["bash"];
      return bashInput.command;
    case "edit":
      const editInput = input as ToolInputMap["edit"];
      return `file at path: ${editInput.path}`;
    case "read":
      const readInput = input as ToolInputMap["read"];
      return `file at path: ${readInput.path}`;
    case "webFetch":
      const webFetchInput = input as ToolInputMap["webFetch"];
      return `URL: ${webFetchInput.url}`;
    case "write":
      const writeInput = input as ToolInputMap["write"];
      return `file at path: ${writeInput.path}`;
  }
};

export type {
  AskUserQuestionInput,
  QuestionInput,
  OptionInput,
} from "./ask-user-question";

export default tools;
