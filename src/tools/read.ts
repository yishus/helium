import { createReadStream } from "fs";
import { readFile, stat } from "fs/promises";
import { createInterface } from "readline/promises";
import { Type, type Static } from "typebox";

import type { Tool, ToolConfig } from "./";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const readSchema = Type.Object({
  path: Type.String({
    description: "The absolute path to the file to read",
  }),
  offset: Type.Optional(
    Type.Number({
      description:
        "The line number to start reading from. Only provide if the file is too large to read at once",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      description:
        "The number of lines to read. Only provide if the file is too large to read at once.",
    }),
  ),
});

type argsType = Static<typeof readSchema>;

const definition = {
  name: "read",
  description:
    "Reads a file from the local filesystem. You can access any file directly by using this tool.",
  input_schema: readSchema,
};

const callFunction = async (args: argsType, _config: ToolConfig) => {
  const { path, offset, limit } = args;
  if (offset == null && limit == null) {
    const buffer = await readFile(path, { encoding: "utf8" });
    return buffer.toString();
  } else {
    const stats = await stat(path);
    const fileSizeInBytes = stats.size;
    if (fileSizeInBytes < MAX_FILE_SIZE_BYTES) {
      const buffer = await readFile(path, { encoding: "utf8" });
      const lines = buffer.toString().split("\n");
      return lines
        .slice(offset ?? 0, limit ? (offset ?? 0) + limit : undefined)
        .join("\n");
    } else {
      const rl = createInterface({
        input: createReadStream(path),
        terminal: false,
      });

      let currentLine = 0;
      let lines: string[] = [];
      for await (const line of rl) {
        if (currentLine >= (offset ?? 0) + (limit ?? Infinity)) {
          rl.close();
        }
        if (
          currentLine >= (offset ?? 0) &&
          currentLine < (offset ?? 0) + (limit ?? Infinity)
        ) {
          lines.push(line);
        }
        currentLine += 1;
      }

      return lines.join("\n");
    }
  }
};

export default { definition, callFunction } as Tool<typeof readSchema>;
