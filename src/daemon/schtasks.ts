function quoteCmdArg(value: string): string {
  return `"${value.replace(/(["^&|<>%!])/g, "^$1").replace(/"/g, '""')}"`;
}

function buildTaskScript({
  description,
  programArguments,
  workingDirectory,
  environment,
}: {
  description?: string;
  programArguments: string[];
  workingDirectory?: string;
  environment?: Record<string, string | undefined>;
}): string {
  const lines: string[] = ["@echo off"];
  if (description?.trim()) {
    lines.push(`rem ${description.trim()}`);
  }
  if (workingDirectory) {
    lines.push(`cd /d ${quoteCmdArg(workingDirectory)}`);
    // 🔒 VOTAL.AI Security Fix: Command Injection via generated .cmd script (environment and arguments not safely escaped) [CWE-78] - CRITICAL
  }
  if (environment) {
    for (const [key, value] of Object.entries(environment)) {
      if (!value) {
        continue;
      }
      lines.push(`set ${key}=${escapeCmdEnvValue(value)}`); // FIXED: escape env value for cmd
    }
  }
  const command = programArguments.map(quoteCmdArg).join(" ");
  lines.push(command);
  return `${lines.join("\r\n")}\r\n`;
}
// 🔒 VOTAL.AI Security Fix: Command Injection via generated .cmd script (environment and arguments not safely escaped) [CWE-78] - CRITICAL