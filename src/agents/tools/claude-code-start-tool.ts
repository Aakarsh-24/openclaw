/**
 * Claude Code Start Tool for DyDo
 *
 * Allows DyDo to spawn Claude Code sessions with enriched context
 * after planning phase. This tool:
 * - Starts Claude Code session with DyDo's refined prompt
 * - Stores session context for later Q&A handling
 * - Returns session info for monitoring
 */

import path from "node:path";
import { Type } from "@sinclair/typebox";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { startSession, resolveProject, getGitBranch } from "../claude-code/index.js";
import type { ProjectContext } from "../claude-code/project-context.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";

const log = createSubsystemLogger("tools/claude-code-start");

/**
 * Session planning context stored for Q&A routing
 */
export interface SessionPlanningContext {
  /** DyDo's session ID (requester) */
  dyDoSessionId: string;
  /** Project context from exploration */
  projectContext?: ProjectContext;
  /** Original user task */
  originalTask: string;
  /** DyDo's enriched prompt */
  enrichedPrompt: string;
  /** Planning decisions made */
  planningDecisions: string[];
  /** Clarifications from user */
  userClarifications: string[];
  /** Timestamp when planning started */
  planningStartedAt: number;
}

/**
 * Map of Claude Code sessionId -> planning context
 * Used for Q&A routing to give DyDo full context
 */
const sessionContexts = new Map<string, SessionPlanningContext>();

/**
 * Get planning context for a Claude Code session
 */
export function getSessionPlanningContext(sessionId: string): SessionPlanningContext | undefined {
  return sessionContexts.get(sessionId);
}

/**
 * Store planning context for a session
 */
export function setSessionPlanningContext(
  sessionId: string,
  context: SessionPlanningContext,
): void {
  sessionContexts.set(sessionId, context);
}

/**
 * Remove planning context (on session end)
 */
export function clearSessionPlanningContext(sessionId: string): void {
  sessionContexts.delete(sessionId);
}

const ClaudeCodeStartToolSchema = Type.Object({
  project: Type.String({ description: "Project name or path" }),
  prompt: Type.String({ description: "The enriched prompt for Claude Code" }),
  originalTask: Type.Optional(Type.String({ description: "Original user task before enrichment" })),
  worktree: Type.Optional(
    Type.String({ description: "Worktree/branch name (e.g., @experimental)" }),
  ),
  planningDecisions: Type.Optional(
    Type.Array(Type.String(), { description: "Decisions made during planning" }),
  ),
  userClarifications: Type.Optional(
    Type.Array(Type.String(), { description: "Clarifications from user" }),
  ),
  resumeToken: Type.Optional(
    Type.String({ description: "Resume token for continuing existing session" }),
  ),
});

export function createClaudeCodeStartTool(options?: {
  dyDoSessionId?: string;
  onSessionStart?: (sessionId: string, context: SessionPlanningContext) => void;
}): AnyAgentTool {
  return {
    label: "Claude Code",
    name: "claude_code_start",
    description: `Start a Claude Code session with your enriched prompt and context.

Use this after:
1. Loading project context with project_context tool
2. Analyzing the task
3. Asking user for any clarifications
4. Formulating a detailed, enriched prompt

The session will run in background. You'll receive questions via conversation.`,
    parameters: ClaudeCodeStartToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const projectInput = readStringParam(params, "project", { required: true });
      const prompt = readStringParam(params, "prompt", { required: true });
      const originalTask = readStringParam(params, "originalTask") || prompt;
      const worktree = readStringParam(params, "worktree");
      const resumeToken = readStringParam(params, "resumeToken");
      const planningDecisions = Array.isArray(params.planningDecisions)
        ? (params.planningDecisions as string[])
        : [];
      const userClarifications = Array.isArray(params.userClarifications)
        ? (params.userClarifications as string[])
        : [];

      // Resolve project path
      let projectPath: string | undefined;
      let projectName: string = projectInput; // Default to input

      // Check if it's a path
      if (projectInput.startsWith("/")) {
        projectPath = projectInput;
        projectName = path.basename(projectInput);
      } else {
        // Try to resolve as project name
        const projectSpec = worktree ? `${projectInput} @${worktree}` : projectInput;
        const resolved = resolveProject(projectSpec);

        if (resolved) {
          projectPath = resolved.workingDir;
          // Extract project name from displayName (e.g., "juzi @experimental" -> "juzi")
          projectName = resolved.displayName.split(" ")[0] || projectInput;
        } else {
          // Try common locations
          const commonBases = [
            "/Users/dydo/Documents/agent",
            "/Users/dydo/clawd/projects",
            "/Users/dydo",
          ];

          for (const base of commonBases) {
            const candidate = path.join(base, projectInput);
            const fs = require("node:fs");
            if (fs.existsSync(candidate)) {
              projectPath = candidate;
              projectName = projectInput;
              break;
            }
          }
        }
      }

      if (!projectPath) {
        return jsonResult({
          status: "error",
          error: `Could not resolve project: ${projectInput}. Provide full path or register the project.`,
        });
      }

      log.info(`Starting Claude Code session for ${projectName} at ${projectPath}`);
      log.info(`Prompt: ${prompt.slice(0, 100)}...`);

      // Create planning context
      const planningContext: SessionPlanningContext = {
        dyDoSessionId: options?.dyDoSessionId || "unknown",
        originalTask,
        enrichedPrompt: prompt,
        planningDecisions,
        userClarifications,
        planningStartedAt: Date.now(),
      };

      // Try to load project context if available
      try {
        const { loadProjectContext } = await import("../claude-code/project-context.js");
        const projectCtx = loadProjectContext(projectName);
        if (projectCtx) {
          planningContext.projectContext = projectCtx;
        }
      } catch {
        // Ignore - project context is optional
      }

      try {
        // Start the Claude Code session
        const result = await startSession({
          workingDir: projectPath,
          prompt,
          resumeToken,
          permissionMode: "bypassPermissions",
          // Note: onEvent, onQuestion, onStateChange will be set up by the command handler
          // This tool just initiates the session
        });

        if (!result.success) {
          return jsonResult({
            status: "error",
            error: result.error || "Failed to start Claude Code session",
          });
        }

        // Store planning context for Q&A routing
        if (result.sessionId) {
          setSessionPlanningContext(result.sessionId, planningContext);

          // Notify callback if provided
          if (options?.onSessionStart) {
            options.onSessionStart(result.sessionId, planningContext);
          }
        }

        log.info(`Claude Code session started: ${result.sessionId}`);

        return jsonResult({
          status: "ok",
          sessionId: result.sessionId,
          resumeToken: result.resumeToken,
          project: projectName,
          workingDir: projectPath,
          branch: getGitBranch(projectPath),
          message: `Claude Code session started for ${projectName}. I'll monitor progress and help if it has questions.`,
        });
      } catch (err) {
        log.error(`Failed to start Claude Code session: ${err}`);
        return jsonResult({
          status: "error",
          error: `Failed to start session: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };
}
