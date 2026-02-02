import type { AvailableCommand } from "@agentclientprotocol/sdk";
import { execSync } from "node:child_process";
import type { McpServerConfig } from "./types.js";

/**
 * Get available MCP tools from configured servers
 */
export function getAvailableMcpCommands(servers: McpServerConfig[]): AvailableCommand[] {
  const commands: AvailableCommand[] = [];

  for (const server of servers) {
    try {
      const cmd = `mcporter list ${server.name} --schema`;
      const result = execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
      const parsed = JSON.parse(result);
      const tools = parsed.tools ?? [];

      for (const tool of tools) {
        commands.push({
          name: `${server.name}.${tool.name}`,
          description: `MCP tool from ${server.name}: ${tool.description ?? "No description"}`,
          input: tool.inputSchema?.properties
            ? {
                hint: Object.keys(tool.inputSchema.properties).join(" | "),
              }
            : undefined,
        });
      }
    } catch {
      // Server might not be running or configured, skip
    }
  }

  return commands;
}

/**
 * Check if a command is an MCP tool
 */
export function isMcpCommand(command: string, servers: McpServerConfig[]): boolean {
  const [serverName] = command.split(".");
  return servers.some((s) => s.name === serverName);
}
