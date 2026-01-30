export const isPrintableASCII = (str: string) => /^[\x20-\x7E]*$/.test(str);

const CONTEXT_LINES = 3;

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

type DiffOp = { type: "equal" | "delete" | "insert"; lines: string[] };

export function generateEditDiff(
  filePath: string,
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false
): string {
  const matchIndex = content.indexOf(oldString);
  if (matchIndex === -1) {
    throw new Error("old_string not found in content");
  }

  const oldLines = content.split("\n");
  const newContent = replaceAll
    ? content.replaceAll(oldString, newString)
    : content.replace(oldString, newString);
  const newLines = newContent.split("\n");

  const diffOps = computeDiffOps(oldLines, newLines);
  const hunks = buildHunks(diffOps, CONTEXT_LINES);

  if (hunks.length === 0) {
    return "";
  }

  const output: string[] = [];
  output.push(`--- a/${filePath}`);
  output.push(`+++ b/${filePath}`);

  for (const hunk of hunks) {
    output.push(
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`
    );
    output.push(...hunk.lines);
  }

  return output.join("\n");
}

export function generateWriteDiff(
  filePath: string,
  existingContent: string | undefined,
  newContent: string
): string {
  const oldLines = existingContent ? existingContent.split("\n") : [];
  const newLines = newContent.split("\n");

  const diffOps = computeDiffOps(oldLines, newLines);
  const hunks = buildHunks(diffOps, CONTEXT_LINES);

  if (hunks.length === 0) {
    return "";
  }

  const output: string[] = [];
  if (existingContent === undefined) {
    output.push(`--- /dev/null`);
  } else {
    output.push(`--- a/${filePath}`);
  }
  output.push(`+++ b/${filePath}`);

  for (const hunk of hunks) {
    output.push(
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`
    );
    output.push(...hunk.lines);
  }

  return output.join("\n");
}

function computeDiffOps(oldLines: string[], newLines: string[]): DiffOp[] {
  const lcs = longestCommonSubsequence(oldLines, newLines);
  const ops: DiffOp[] = [];

  let oldIdx = 0;
  let newIdx = 0;

  for (const commonLine of lcs) {
    // Collect deletions (lines in old but not in LCS)
    const deletes: string[] = [];
    while (oldIdx < oldLines.length && oldLines[oldIdx] !== commonLine) {
      deletes.push(oldLines[oldIdx]!);
      oldIdx++;
    }
    if (deletes.length > 0) {
      ops.push({ type: "delete", lines: deletes });
    }

    // Collect insertions (lines in new but not in LCS)
    const inserts: string[] = [];
    while (newIdx < newLines.length && newLines[newIdx] !== commonLine) {
      inserts.push(newLines[newIdx]!);
      newIdx++;
    }
    if (inserts.length > 0) {
      ops.push({ type: "insert", lines: inserts });
    }

    // Add the common line
    ops.push({ type: "equal", lines: [commonLine] });
    oldIdx++;
    newIdx++;
  }

  // Handle remaining lines after LCS
  if (oldIdx < oldLines.length) {
    ops.push({ type: "delete", lines: oldLines.slice(oldIdx) });
  }
  if (newIdx < newLines.length) {
    ops.push({ type: "insert", lines: newLines.slice(newIdx) });
  }

  return ops;
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // DP table for LCS length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to reconstruct LCS
  const lcs: string[] = [];
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]!);
      i--;
      j--;
    } else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

function buildHunks(ops: DiffOp[], contextLines: number): Hunk[] {
  if (ops.length === 0) return [];

  // Build unified representation with line positions
  type UnifiedLine = {
    type: "context" | "remove" | "add";
    text: string;
    oldNum?: number;
    newNum?: number;
  };

  const unified: UnifiedLine[] = [];
  let oldNum = 1;
  let newNum = 1;

  for (const op of ops) {
    for (const text of op.lines) {
      if (op.type === "equal") {
        unified.push({ type: "context", text, oldNum, newNum });
        oldNum++;
        newNum++;
      } else if (op.type === "delete") {
        unified.push({ type: "remove", text, oldNum });
        oldNum++;
      } else {
        unified.push({ type: "add", text, newNum });
        newNum++;
      }
    }
  }

  // Find indices of changed lines
  const changeIndices = unified
    .map((u, i) => (u.type !== "context" ? i : -1))
    .filter((i) => i !== -1);

  if (changeIndices.length === 0) return [];

  // Group changes with context, merging overlapping groups
  type Group = { start: number; end: number };
  const groups: Group[] = [];

  for (const changeIdx of changeIndices) {
    const start = Math.max(0, changeIdx - contextLines);
    const end = Math.min(unified.length - 1, changeIdx + contextLines);

    if (groups.length > 0 && start <= groups[groups.length - 1]!.end + 1) {
      groups[groups.length - 1]!.end = Math.max(
        groups[groups.length - 1]!.end,
        end
      );
    } else {
      groups.push({ start, end });
    }
  }

  // Build hunks from groups
  return groups.map((g) => {
    const lines: string[] = [];
    let oldStart = 0,
      newStart = 0;
    let oldCount = 0,
      newCount = 0;

    for (let i = g.start; i <= g.end; i++) {
      const u = unified[i]!;

      if (u.type === "context") {
        if (oldStart === 0) oldStart = u.oldNum!;
        if (newStart === 0) newStart = u.newNum!;
        lines.push(` ${u.text}`);
        oldCount++;
        newCount++;
      } else if (u.type === "remove") {
        if (oldStart === 0) oldStart = u.oldNum!;
        lines.push(`-${u.text}`);
        oldCount++;
      } else {
        if (newStart === 0) newStart = u.newNum!;
        lines.push(`+${u.text}`);
        newCount++;
      }
    }

    return { oldStart, oldCount, newStart, newCount, lines };
  });
}
