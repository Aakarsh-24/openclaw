import { execSync } from "node:child_process";
import type { McpServerConfig } from "./types.js";

/**
 * Call an MCP tool using mcporter
 */
export async function callMcpTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const argsJson = JSON.stringify(args);
  const cmd = `mcporter call ${serverName}.${toolName} --args '${argsJson}' --output json`;

  try {
    const result = execSync(cmd, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    const parsed = JSON.parse(result);
    return parsed.result ?? parsed;
  } catch (error) {
    throw new Error(`MCP tool call failed: ${error}`);
  }
}

/**
 * List available MCP tools from configured servers
 */
export async function listMcpTools(servers: McpServerConfig[]): Promise<string[]> {
  const tools: string[] = [];

  for (const server of servers) {
    try {
      const cmd = `mcporter list ${server.name} --schema`;
      const result = execSync(cmd, { encoding: "utf-8" });
      // Parse the schema and extract tool names
      const parsed = JSON.parse(result);
      const serverTools =
        parsed.tools?.map((t: { name: string }) => `${server.name}.${t.name}`) ?? [];
      tools.push(...serverTools);
    } catch {
      // Server might not be configured, skip
    }
  }

  return tools;
}

/**
 * Check if a tool name refers to an MCP tool
 */
export function isMcpTool(toolName: string, servers: McpServerConfig[]): boolean {
  const [serverName] = toolName.split(".");
  return servers.some((s) => s.name === serverName);
}
