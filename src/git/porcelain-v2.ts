export function tokenizePorcelainV2Line(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  const pushToken = (t: string) => {
    if (t.length > 0) {
      tokens.push(t);
    }
  };

  while (i < line.length) {
    while (i < line.length && line[i] === " ") {
      i++;
    }
    if (i >= line.length) {
      break;
    }

    if (line[i] === '"') {
      // Git porcelain v2 uses C-style quoting for paths that contain spaces/special chars.
      i++; // skip opening quote
      let out = "";
      while (i < line.length) {
        const ch = line[i];

        if (ch === '"') {
          i++; // closing quote
          break;
        }

        if (ch === "\\") {
          i++;
          if (i >= line.length) {
            break;
          }
          const esc = line[i];
          switch (esc) {
            case "n": {
              out += "\n";
              break;
            }
            case "t": {
              out += "\t";
              break;
            }
            case "r": {
              out += "\r";
              break;
            }
            case "b": {
              out += "\b";
              break;
            }
            case "f": {
              out += "\f";
              break;
            }
            case "v": {
              out += "\v";
              break;
            }
            case "a": {
              out += "\u0007";
              break;
            }
            case "\\": {
              out += "\\";
              break;
            }
            case '"': {
              out += '"';
              break;
            }
            case "x": {
              // \xHH (best-effort)
              const h1 = line[i + 1];
              const h2 = line[i + 2];
              const hex = `${h1 ?? ""}${h2 ?? ""}`;
              if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                out += String.fromCharCode(Number.parseInt(hex, 16));
                i += 2;
              } else {
                out += "x";
              }
              break;
            }
            case "u": {
              const hex = line.slice(i + 1, i + 5);
              if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                out += String.fromCharCode(Number.parseInt(hex, 16));
                i += 4;
              } else {
                out += "u";
              }
              break;
            }
            case "U": {
              const hex = line.slice(i + 1, i + 9);
              if (/^[0-9a-fA-F]{8}$/.test(hex)) {
                out += String.fromCodePoint(Number.parseInt(hex, 16));
                i += 8;
              } else {
                out += "U";
              }
              break;
            }
            default: {
              if (/[0-7]/.test(esc)) {
                // Octal escape: \123 (up to 3 digits, includes current digit)
                let oct = esc;
                const n1 = line[i + 1];
                const n2 = line[i + 2];
                if (n1 && /[0-7]/.test(n1)) {
                  oct += n1;
                  i++;
                  if (n2 && /[0-7]/.test(n2)) {
                    oct += n2;
                    i++;
                  }
                }
                out += String.fromCharCode(Number.parseInt(oct, 8));
              } else {
                // Unknown escape; keep best-effort.
                out += esc;
              }
              break;
            }
          }
          i++;
          continue;
        }

        out += ch;
        i++;
      }
      pushToken(out);
      continue;
    }

    // Unquoted token: read until next space.
    const start = i;
    while (i < line.length && line[i] !== " ") {
      i++;
    }
    pushToken(line.slice(start, i));
  }

  return tokens;
}

export type GitStatusPorcelainV2 = {
  branch: {
    oid?: string;
    head?: string;
    upstream?: string;
    ahead?: number;
    behind?: number;
  };
  entries: Array<{
    code: string;
    xy: string;
    sub?: string;
    path: string;
    origPath?: string;
    raw?: string;
  }>;
};

function splitFixedFields(line: string, fieldCount: number): { fields: string[]; rest: string } {
  const fields: string[] = [];
  let i = 0;

  const skipSpaces = () => {
    while (i < line.length && line[i] === " ") {
      i++;
    }
  };

  skipSpaces();
  while (i < line.length && fields.length < fieldCount) {
    const start = i;
    while (i < line.length && line[i] !== " ") {
      i++;
    }
    fields.push(line.slice(start, i));
    skipSpaces();
  }

  const rest = line.slice(i).replace(/^[ \t]+/, "");
  return { fields, rest };
}

export function parseGitStatusPorcelainV2(stdout: string): GitStatusPorcelainV2 {
  const result: GitStatusPorcelainV2 = {
    branch: {},
    entries: [],
  };

  const lines = stdout.split("\n");
  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (line.startsWith("# ")) {
      const content = line.slice(2);
      if (content.startsWith("branch.oid ")) {
        result.branch.oid = content.slice(11);
      } else if (content.startsWith("branch.head ")) {
        result.branch.head = content.slice(12);
      } else if (content.startsWith("branch.upstream ")) {
        result.branch.upstream = content.slice(16);
      } else if (content.startsWith("branch.ab ")) {
        const [ahead, behind] = content.slice(10).split(" ");
        result.branch.ahead = Number.parseInt(ahead.replace("+", ""), 10);
        result.branch.behind = Number.parseInt(behind.replace("-", ""), 10);
      }
      continue;
    }

    // Prefer tokenization when C-quoted fields are present.
    const hasQuotes = line.includes('"');
    const rec = line[0] ?? "";

    if (rec === "1") {
      // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
      if (hasQuotes) {
        const tokens = tokenizePorcelainV2Line(line);
        const xy = tokens[1] ?? "";
        const sub = tokens[2];
        const p = tokens[8];
        result.entries.push(
          p ? { code: "1", xy, sub, path: p } : { code: "1", xy, sub, path: "", raw: line },
        );
      } else {
        const { fields, rest } = splitFixedFields(line, 8);
        const xy = fields[1] ?? "";
        const sub = fields[2];
        const p = rest;
        result.entries.push(
          p ? { code: "1", xy, sub, path: p } : { code: "1", xy, sub, path: "", raw: line },
        );
      }
      continue;
    }

    if (rec === "2") {
      // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path> <origPath>
      if (hasQuotes) {
        const tokens = tokenizePorcelainV2Line(line);
        const xy = tokens[1] ?? "";
        const sub = tokens[2];
        const p = tokens[9];
        const o = tokens[10];
        result.entries.push(
          p
            ? { code: "2", xy, sub, path: p, origPath: o }
            : { code: "2", xy, sub, path: "", raw: line },
        );
      } else {
        const { fields, rest } = splitFixedFields(line, 9);
        const xy = fields[1] ?? "";
        const sub = fields[2];
        // In non-quoted output, git often separates paths with TAB.
        const parts = rest.split("\t").filter((p) => p.length > 0);
        const p = parts[0];
        const o = parts[1];
        result.entries.push(
          p
            ? { code: "2", xy, sub, path: p, origPath: o }
            : { code: "2", xy, sub, path: "", raw: line },
        );
      }
      continue;
    }

    if (rec === "?") {
      // ? <path>
      const p = line.replace(/^\?\s+/, "");
      result.entries.push({ code: "?", xy: "??", path: p || "", raw: p ? undefined : line });
      continue;
    }

    if (rec === "u") {
      // u <XY> <sub> ... <path>
      if (hasQuotes) {
        const tokens = tokenizePorcelainV2Line(line);
        const xy = tokens[1] ?? "uu";
        const sub = tokens[2];
        const p = tokens.at(-1) ?? "";
        result.entries.push({ code: "u", xy, sub, path: p || "", raw: p ? undefined : line });
      } else {
        const p = line.split("\t").at(-1) ?? "";
        const { fields } = splitFixedFields(line, 3);
        const xy = fields[1] ?? "uu";
        const sub = fields[2];
        result.entries.push({ code: "u", xy, sub, path: p || "", raw: p ? undefined : line });
      }
      continue;
    }
  }

  return result;
}
