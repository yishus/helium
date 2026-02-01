import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
import { Type, type Static } from "typebox";

import type { Tool, ToolConfig } from "./";

const writeSchema = Type.Object({
  path: Type.String({
    description: "The absolute path to the file to write",
  }),
  content: Type.String({
    description: "The content to write to the file",
  }),
});

type argsType = Static<typeof writeSchema>;

const definition = {
  name: "write",
  description:
    "Writes content to a file at the specified path. Creates the file if it doesn't exist, or overwrites it if it does. Parent directories are created automatically if needed.",
  input_schema: writeSchema,
};

const callFunction = async (args: argsType, _config: ToolConfig) => {
  const { path, content } = args;

  // Ensure parent directory exists
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });

  await writeFile(path, content, { encoding: "utf8" });

  return `Successfully wrote ${content.length} characters to ${path}`;
};

export default { definition, callFunction } as Tool<typeof writeSchema>;
