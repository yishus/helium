import { Type, type Static } from "typebox";

import type { Tool, ToolConfig } from "./";

// Patterns for destructive commands that should be blocked
const destructivePatterns: { pattern: RegExp; reason: string }[] = [
  // Recursive deletion of root or home
  {
    pattern: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?[~\/]\s*$/,
    reason: "Recursive deletion of root or home directory",
  },
  {
    pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*\s+)?[~\/]\s*$/,
    reason: "Recursive deletion of root or home directory",
  },
  {
    pattern: /\brm\s+-[a-zA-Z]*rf[a-zA-Z]*\s+[~\/]/,
    reason: "Recursive forced deletion of root or home",
  },
  {
    pattern: /\brm\s+-[a-zA-Z]*fr[a-zA-Z]*\s+[~\/]/,
    reason: "Recursive forced deletion of root or home",
  },
  // Disk/filesystem operations
  {
    pattern: /\bmkfs\b/,
    reason: "Filesystem formatting",
  },
  {
    pattern: /\bdd\b.*\bof\s*=\s*\/dev\//,
    reason: "Direct disk write with dd",
  },
  {
    pattern: />\s*\/dev\/[sh]d[a-z]/,
    reason: "Overwriting disk device",
  },
  // Fork bomb
  {
    pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;?\s*:/,
    reason: "Fork bomb",
  },
  // System-wide permission changes
  {
    pattern: /\bchmod\s+(-[a-zA-Z]*R[a-zA-Z]*\s+)?\d{3,4}\s+[\/~]\s*$/,
    reason: "Recursive permission change on root or home",
  },
  {
    pattern: /\bchown\s+(-[a-zA-Z]*R[a-zA-Z]*\s+).*\s+[\/~]\s*$/,
    reason: "Recursive ownership change on root or home",
  },
  // System control
  {
    pattern: /\b(shutdown|reboot|halt|poweroff|init\s+[06])\b/,
    reason: "System shutdown/reboot command",
  },
  // Kill system processes
  {
    pattern: /\bkill\s+(-9\s+)?(-KILL\s+)?(-SIGKILL\s+)?(1|-1)\b/,
    reason: "Killing init or all processes",
  },
  // Pipe to shell (arbitrary code execution)
  {
    pattern: /\b(curl|wget)\b.*\|\s*(ba)?sh/,
    reason: "Piping remote content to shell",
  },
  // Dangerous git operations
  {
    pattern: /\bgit\s+push\s+.*--force.*\s+(main|master)\b/,
    reason: "Force push to main/master branch",
  },
  {
    pattern: /\bgit\s+push\s+.*\s+(main|master)\b.*--force/,
    reason: "Force push to main/master branch",
  },
  {
    pattern: /\bgit\s+reset\s+--hard\s+origin\//,
    reason: "Hard reset to remote (discards local changes)",
  },
  {
    pattern: /\bgit\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*d|git\s+clean\s+-[a-zA-Z]*d[a-zA-Z]*f/,
    reason: "Git clean with force (removes untracked files)",
  },
];

function checkDestructiveCommand(command: string): string | null {
  for (const { pattern, reason } of destructivePatterns) {
    if (pattern.test(command)) {
      return reason;
    }
  }
  return null;
}

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

const callFunction = async (args: argsType, _config: ToolConfig) => {
  const { command, timeout = 30000 } = args;

  // Check for destructive commands
  const blockReason = checkDestructiveCommand(command);
  if (blockReason) {
    return `Error: Command blocked - ${blockReason}. This command has been identified as potentially destructive and cannot be executed.`;
  }

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
