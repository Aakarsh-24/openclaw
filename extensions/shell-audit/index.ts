import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const LOG_PATH = path.join(os.homedir(), ".openclaw", "logs", "shell-audit.log");

function ensureLogDir(): void {
  const logDir = path.dirname(LOG_PATH);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

interface LogEntry {
  timestamp: string;
  session: string;
  tool: string;
  command: string;
  cwd: string | null;
  exitCode: number | null;
  durationMs: number | null;
}

function appendLog(entry: LogEntry): void {
  try {
    ensureLogDir();
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(LOG_PATH, line);
  } catch (err) {
    console.error("[shell-audit] Failed to write log:", (err as Error).message);
  }
}

const plugin = {
  id: "shell-audit",
  name: "Shell Audit",
  description: "Logs every shell command executed via the exec tool.",

  register(api: OpenClawPluginApi) {
    api.logger.info("[plugins] Shell Audit plugin registered");

    // Store pending commands by toolCallId to match with results
    const pendingCommands = new Map<
      string,
      { command: string; cwd: string | null; startTime: number }
    >();

    // Listen to tool execution events via the API
    api.on("tool_call", (event, _ctx) => {
      try {
        const toolName = event.toolName;
        if (
          toolName === "exec" ||
          toolName === "Exec" ||
          toolName === "bash" ||
          toolName === "run_command"
        ) {
          const toolCallId = event.toolCallId;
          const args = (event.args || {}) as Record<string, unknown>;
          const command =
            (args.command as string) ||
            (args.CommandLine as string) ||
            (args.cmd as string) ||
            JSON.stringify(args);
          const cwd =
            (args.cwd as string) || (args.Cwd as string) || null;

          pendingCommands.set(toolCallId, {
            command,
            cwd,
            startTime: Date.now(),
          });
        }
      } catch (err) {
        console.error(
          "[shell-audit] Error in tool_call handler:",
          (err as Error).message
        );
      }
    });

    // Capture result and log the complete entry
    api.on("tool_result_persist", (event, _ctx) => {
      try {
        const toolName = event.toolName;

        if (
          toolName === "exec" ||
          toolName === "Exec" ||
          toolName === "bash" ||
          toolName === "run_command"
        ) {
          const toolCallId = event.toolCallId;
          const pending = pendingCommands.get(toolCallId);
          const details = (event.message?.details || {}) as Record<
            string,
            unknown
          >;

          const logEntry: LogEntry = {
            timestamp: new Date().toISOString(),
            session: event.sessionKey || "unknown",
            tool: toolName,
            command: pending?.command || "(unknown)",
            cwd: pending?.cwd || (details.cwd as string) || null,
            exitCode: (details.exitCode as number) ?? null,
            durationMs: (details.durationMs as number) || null,
          };

          appendLog(logEntry);
          api.logger.info?.(
            `[shell-audit] Logged: ${logEntry.command} (exit: ${logEntry.exitCode})`
          );

          // Cleanup
          if (toolCallId) pendingCommands.delete(toolCallId);
        }
      } catch (err) {
        console.error(
          "[shell-audit] Error in tool_result_persist:",
          (err as Error).message
        );
      }

      return undefined;
    });

    // Register CLI command to view the audit log
    api.registerCli?.(
      ({ program }) => {
        const audit = program
          .command("shell-audit")
          .description("Shell audit log commands");

        audit
          .command("tail")
          .description("Show recent shell commands")
          .option("-n, --lines <n>", "Number of lines", "20")
          .action((opts: { lines: string }) => {
            try {
              if (!fs.existsSync(LOG_PATH)) {
                console.log("No shell audit log found yet.");
                return;
              }
              const content = fs.readFileSync(LOG_PATH, "utf-8");
              const lines = content
                .trim()
                .split("\n")
                .slice(-parseInt(opts.lines));
              for (const line of lines) {
                try {
                  const entry = JSON.parse(line) as LogEntry;
                  console.log(
                    `[${entry.timestamp}] ${entry.tool}: ${entry.command} (exit: ${entry.exitCode})`
                  );
                } catch {
                  console.log(line);
                }
              }
            } catch (err) {
              console.error("Error reading log:", (err as Error).message);
            }
          });

        audit
          .command("clear")
          .description("Clear the shell audit log")
          .action(() => {
            try {
              if (fs.existsSync(LOG_PATH)) {
                fs.unlinkSync(LOG_PATH);
                console.log("Shell audit log cleared.");
              } else {
                console.log("No log file to clear.");
              }
            } catch (err) {
              console.error("Error clearing log:", (err as Error).message);
            }
          });
      },
      { commands: ["shell-audit"] }
    );

    // Register the service for lifecycle management
    api.registerService({
      id: "shell-audit",
      start: () => {
        ensureLogDir();
        api.logger.info("[plugins] Shell Audit service started");
      },
      stop: () => {
        api.logger.info("[plugins] Shell Audit service stopped");
      },
    });
  },
};

export default plugin;
