import { readFile, writeFile } from "fs/promises";
import { Type, type Static } from "typebox";

import type { Tool, ToolConfig } from "./";

const editSchema = Type.Object({
  path: Type.String({
    description: "The absolute path to the file to edit",
  }),
  old_string: Type.String({
    description: "The exact text to find and replace",
  }),
  new_string: Type.String({
    description: "The text to replace it with",
  }),
  replace_all: Type.Optional(
    Type.Boolean({
      description: "Replace all occurrences (default: false)",
    })
  ),
});

type argsType = Static<typeof editSchema>;

const definition = {
  name: "edit",
  description:
    "Performs exact string replacements in a file. The old_string must be unique in the file unless replace_all is true.",
  input_schema: editSchema,
};

const callFunction = async (args: argsType, _config: ToolConfig) => {
  const { path, old_string, new_string, replace_all = false } = args;

  const content = await readFile(path, { encoding: "utf8" });

  if (!content.includes(old_string)) {
    return `Error: old_string not found in file`;
  }

  const occurrences = content.split(old_string).length - 1;

  if (!replace_all && occurrences > 1) {
    return `Error: old_string appears ${occurrences} times in file. Use replace_all: true to replace all occurrences, or provide a more unique string.`;
  }

  const newContent = replace_all
    ? content.replaceAll(old_string, new_string)
    : content.replace(old_string, new_string);

  await writeFile(path, newContent, { encoding: "utf8" });

  const replacedCount = replace_all ? occurrences : 1;
  return `Successfully replaced ${replacedCount} occurrence${replacedCount > 1 ? "s" : ""} in ${path}`;
};

export default { definition, callFunction } as Tool<typeof editSchema>;
