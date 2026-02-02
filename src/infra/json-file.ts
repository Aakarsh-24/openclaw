import fs from "node:fs";
import path from "node:path";

export function loadJsonFile(pathname: string): unknown {
  try {
    const baseDir = process.cwd();
    const safePath = path.resolve(baseDir, pathname);
    if (!safePath.startsWith(path.resolve(baseDir) + path.sep)) throw new Error("Path traversal detected");
    if (!fs.existsSync(safePath)) {
      return undefined;
    }
    const raw = fs.readFileSync(safePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
// 🔒 VOTAL.AI Security Fix: Path Traversal / Arbitrary File Write via caller-controlled pathname [CWE-22] - CRITICAL

export function saveJsonFile(pathname: string, data: unknown) {
  const baseDir = process.cwd(); // restrict to current working directory
  const safePath = path.resolve(baseDir, pathname);
  if (!safePath.startsWith(path.resolve(baseDir) + path.sep)) throw new Error("Path traversal detected"); // minimal fix
  const dir = path.dirname(safePath);
// 🔒 VOTAL.AI Security Fix: Path Traversal / Arbitrary File Write via caller-controlled pathname [CWE-22] - CRITICAL
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(safePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.chmodSync(safePath, 0o600);
}