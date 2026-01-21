/**
 * Planning Request Builder for Claude Code
 *
 * Builds the message that gets injected into DyDo's conversation
 * when user runs /claude command. DyDo then:
 * 1. Loads project context
 * 2. Analyzes the task
 * 3. Asks clarifying questions if needed
 * 4. Spawns Claude Code with enriched prompt
 */

export interface PlanningRequestParams {
  /** Action type */
  action: "start" | "resume";
  /** Project name or identifier */
  project: string;
  /** User's task description */
  task?: string;
  /** Resume token (for resume action) */
  resumeToken?: string;
  /** Worktree/branch if specified */
  worktree?: string;
  /** Skip planning (--quick mode) */
  quick?: boolean;
}

/**
 * Build a planning request message for DyDo
 */
export function buildPlanningRequest(params: PlanningRequestParams): string {
  const { action, project, task, resumeToken, worktree, quick } = params;

  if (quick) {
    // Quick mode - minimal planning, just start
    return buildQuickStartRequest(params);
  }

  if (action === "resume") {
    return buildResumeRequest(params);
  }

  return buildFullPlanningRequest(params);
}

/**
 * Build quick-start request (minimal planning)
 */
function buildQuickStartRequest(params: PlanningRequestParams): string {
  const { project, task, worktree } = params;
  const projectSpec = worktree ? `${project} @${worktree}` : project;

  const lines = [
    `[Claude Code Quick Start]`,
    ``,
    `Project: ${projectSpec}`,
    `Task: ${task || "Continue working"}`,
    ``,
    `Start a Claude Code session immediately with this task.`,
    `Use the claude_code_start tool with the task as the prompt.`,
  ];

  return lines.join("\n");
}

/**
 * Build resume request
 */
function buildResumeRequest(params: PlanningRequestParams): string {
  const { project, task, resumeToken } = params;

  const lines = [
    `[Claude Code Resume Request]`,
    ``,
    `Resume Token: ${resumeToken}`,
    `Project: ${project || "(from token)"}`,
    `New Task: ${task || "continue"}`,
    ``,
    `Resume the Claude Code session with this token.`,
    ``,
    `Steps:`,
    `1. Use claude_code_start with resumeToken="${resumeToken}"`,
    `2. If a new task is provided, use it as the prompt`,
    `3. Otherwise, use "continue" as the prompt`,
  ];

  return lines.join("\n");
}

/**
 * Build full planning request
 */
function buildFullPlanningRequest(params: PlanningRequestParams): string {
  const { project, task, worktree } = params;
  const projectSpec = worktree ? `${project} @${worktree}` : project;

  const lines = [
    `[Claude Code Planning Request]`,
    ``,
    `Project: ${projectSpec}`,
    `User's Task: ${task || "(not specified - ask what they want to do)"}`,
    ``,
    `Please help me prepare a Claude Code session for this task.`,
    ``,
    `## Your Steps`,
    ``,
    `### 1. Load Project Context`,
    `Use the \`project_context\` tool to understand this project:`,
    `\`\`\``,
    `project_context({ action: "load", project: "${project}" })`,
    `\`\`\``,
    ``,
    `If the project path isn't found, ask me for the full path.`,
    ``,
    `### 2. Analyze the Task`,
    `Based on the project context, think about:`,
    `- What files/areas will likely be involved?`,
    `- Are there existing patterns to follow?`,
    `- What could go wrong or need clarification?`,
    ``,
    `### 3. Clarify if Needed`,
    `If the task is ambiguous or has multiple valid approaches,`,
    `ask me to clarify. Examples:`,
    `- "For dark mode, should I use CSS variables or styled-components?"`,
    `- "Should authentication be JWT or session-based?"`,
    `- "Do you want tests included?"`,
    ``,
    `### 4. Start Claude Code`,
    `Once you understand the task, use \`claude_code_start\` with:`,
    `- An enriched prompt that includes context and decisions`,
    `- Any clarifications I provided`,
    ``,
    `## Example Enriched Prompt`,
    `\`\`\``,
    `Implement dark mode for this React application.`,
    ``,
    `Context:`,
    `- Project uses CSS variables (src/styles/variables.css)`,
    `- There's an existing ThemeContext in src/context/`,
    `- User wants system preference detection with manual override`,
    ``,
    `Requirements:`,
    `1. Add dark theme CSS variables`,
    `2. Extend ThemeContext with isDarkMode state`,
    `3. Add useMediaQuery for system preference`,
    `4. Create DarkModeToggle component`,
    `5. Persist preference to localStorage`,
    `\`\`\``,
    ``,
    `## Important`,
    `- Don't start Claude Code until you've loaded context and analyzed the task`,
    `- If I didn't specify a task, ask me what I want to do`,
    `- Keep your questions focused and brief`,
  ];

  return lines.join("\n");
}

/**
 * Check if a message looks like it's responding to a Claude Code question
 * (Used to detect when DyDo should forward response to Claude Code)
 */
export function isClaudeCodeResponse(message: string): boolean {
  const lowerMsg = message.toLowerCase();

  // Check for explicit directives
  if (lowerMsg.includes("[to claude code]")) return true;
  if (lowerMsg.includes("tell claude code")) return true;
  if (lowerMsg.includes("claude code:")) return true;

  return false;
}

/**
 * Extract the response content from a Claude Code response message
 */
export function extractClaudeCodeResponse(message: string): string {
  // Remove directive markers
  let response = message
    .replace(/\[to claude code\]/gi, "")
    .replace(/tell claude code:?/gi, "")
    .replace(/claude code:/gi, "")
    .trim();

  return response;
}
