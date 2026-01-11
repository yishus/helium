import { Type, type Static } from "typebox";

import type { Tool } from "./";

const bashSchema = Type.Object({
  command: Type.String({
    description: "The bash command to execute",
  }),
  timeout: Type.Optional(
    Type.Number({
      description: "Timeout in milliseconds (default: 30000)",
    })
  ),
});

type argsType = Static<typeof bashSchema>;

const definition = {
  name: "bash",
  description:
    "Executes a bash command and returns the output. Use this for running shell commands, scripts, and system operations.",
  input_schema: bashSchema,
};

const callFunction = async (args: argsType) => {
  const { command, timeout = 30000 } = args;

  const proc = Bun.spawn(["bash", "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);
  });

  try {
    const exitCode = await Promise.race([proc.exited, timeoutPromise]);
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    let result = "";
    if (stdout) {
      result += stdout;
    }
    if (stderr) {
      result += (result ? "\n" : "") + `stderr: ${stderr}`;
    }
    if (exitCode !== 0) {
      result += (result ? "\n" : "") + `Exit code: ${exitCode}`;
    }

    return result || "Command completed successfully with no output";
  } catch (error) {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    }
    return `Error: ${String(error)}`;
  }
};

export default { definition, callFunction } as Tool<typeof bashSchema>;
