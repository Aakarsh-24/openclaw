type DiffOp = { type: "equal" | "add" | "del"; line: string };

// Simple LCS-based diff for line arrays.
// O(n*m) time, intended for small-ish config previews.
function diffLines(oldLines: string[], newLines: string[]): DiffOp[] {
  const n = oldLines.length;
  const m = newLines.length;

  // dp[i][j] = LCS length for oldLines[i:] and newLines[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ type: "equal", line: oldLines[i] });
      i += 1;
      j += 1;
      continue;
    }

    // Prefer deleting if it doesn't reduce LCS.
    if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "del", line: oldLines[i] });
      i += 1;
    } else {
      ops.push({ type: "add", line: newLines[j] });
      j += 1;
    }
  }

  while (i < n) {
    ops.push({ type: "del", line: oldLines[i] });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: "add", line: newLines[j] });
    j += 1;
  }

  return ops;
}

export type UnifiedDiffOptions = {
  context?: number;
  maxLines?: number;
};

export function unifiedDiff(
  oldText: string,
  newText: string,
  options: UnifiedDiffOptions = {},
): string {
  const context = typeof options.context === "number" ? options.context : 3;
  const maxLines = typeof options.maxLines === "number" ? options.maxLines : 500;

  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  const ops = diffLines(oldLines, newLines);

  // Build hunks by emitting changes plus context lines.
  const out: string[] = ["--- before", "+++ after"];

  // Collect indices of changed ops.
  const changed = ops
    .map((op, idx) => (op.type === "equal" ? -1 : idx))
    .filter((idx) => idx !== -1);

  if (changed.length === 0) {
    out.push("(no changes)");
    return out.join("\n");
  }

  // Expand change indices by context.
  const include = new Set<number>();
  for (const idx of changed) {
    for (let k = Math.max(0, idx - context); k <= Math.min(ops.length - 1, idx + context); k += 1) {
      include.add(k);
    }
  }

  let emitted = 0;
  let lastIncluded = -2;
  for (let idx = 0; idx < ops.length; idx += 1) {
    if (!include.has(idx)) {
      continue;
    }

    if (idx > lastIncluded + 1) {
      out.push("@@");
    }

    const op = ops[idx];
    const prefix = op.type === "add" ? "+" : op.type === "del" ? "-" : " ";
    out.push(prefix + op.line);
    lastIncluded = idx;
    emitted += 1;
    if (emitted >= maxLines) {
      out.push("@@");
      out.push(`(diff truncated at ${maxLines} lines)`);
      break;
    }
  }

  return out.join("\n");
}
