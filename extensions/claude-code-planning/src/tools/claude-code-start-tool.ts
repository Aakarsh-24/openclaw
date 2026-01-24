/**
 * Claude Code Start Tool
 *
 * Allows agents to spawn Claude Code sessions with enriched context
 * after planning phase. This tool:
 * - Starts Claude Code session with the agent's refined prompt
 * - Stores session context for later Q&A handling
 * - Returns session info for monitoring
 */

import path from "node:path";
import { Type, type Static } from "@sinclair/typebox";
import {
  startSession,
  getSessionByToken,
  sendInput,
} from "../session/manager.js";
import {
  resolveProject,
  getGitBranch,
  getWorkingDirFromResumeToken,
} from "../context/resolver.js";
import { loadProjectContext } from "../context/explorer.js";
import type { ProjectContext, SessionState, BlockerInfo } from "../types.js";

// Re-export core AI-driven blocker detection utilities
// These are used for AI-driven question handling instead of pattern-based detection
export {
  assessQuestion,
  generateOrchestratorResponse,
  getAttemptHistory,
  recordAttempt,
  clearAttemptHistory,
  isSimilarQuestion,
} from "../../../../src/agents/claude-code/orchestrator.js";
export type {
  OrchestratorContext,
  OrchestratorAttempt,
} from "../../../../src/agents/claude-code/orchestrator.js";

/** Logger interface */
interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}

/** Default console logger */
const defaultLogger: Logger = {
  info: (msg) => console.log(`[claude-code-start] ${msg}`),
  warn: (msg) => console.warn(`[claude-code-start] ${msg}`),
  error: (msg) => console.error(`[claude-code-start] ${msg}`),
  debug: () => {},
};

let log: Logger = defaultLogger;

/**
 * Set the logger.
 */
export function setLogger(logger: Logger): void {
  log = logger;
}

/**
 * Session planning context stored for Q&A routing.
 */
export interface SessionPlanningContext {
  /** Requester session ID */
  requesterSessionId: string;
  /** Project context from exploration */
  projectContext?: ProjectContext;
  /** Original user task */
  originalTask: string;
  /** Enriched prompt */
  enrichedPrompt: string;
  /** Planning decisions made */
  planningDecisions: string[];
  /** Clarifications from user */
  userClarifications: string[];
  /** Timestamp when planning started */
  planningStartedAt: number;
}

/**
 * Map of Claude Code sessionId -> planning context.
 */
const sessionContexts = new Map<string, SessionPlanningContext>();

/**
 * Get planning context for a Claude Code session.
 */
export function getSessionPlanningContext(
  sessionId: string,
): SessionPlanningContext | undefined {
  return sessionContexts.get(sessionId);
}

/**
 * Store planning context for a session.
 */
export function setSessionPlanningContext(
  sessionId: string,
  context: SessionPlanningContext,
): void {
  sessionContexts.set(sessionId, context);
}

/**
 * Remove planning context (on session end).
 */
export function clearSessionPlanningContext(sessionId: string): void {
  sessionContexts.delete(sessionId);
}

/**
 * Tool schema using TypeBox.
 */
export const ClaudeCodeStartToolSchema = Type.Object({
  project: Type.String({ description: "Project name or path" }),
  prompt: Type.String({ description: "The enriched prompt for Claude Code" }),
  originalTask: Type.Optional(
    Type.String({ description: "Original user task before enrichment" }),
  ),
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
  permissionMode: Type.Optional(
    Type.Union([
      Type.Literal("default"),
      Type.Literal("acceptEdits"),
      Type.Literal("bypassPermissions"),
    ]),
  ),
  model: Type.Optional(
    Type.Union([Type.Literal("opus"), Type.Literal("sonnet"), Type.Literal("haiku")]),
  ),
});

export type ClaudeCodeStartToolParams = Static<typeof ClaudeCodeStartToolSchema>;

/**
 * Helper to read string param.
 */
function readStringParam(
  params: Record<string, unknown>,
  key: string,
  options?: { required?: boolean },
): string | undefined {
  const value = params[key];
  const str = typeof value === "string" ? value.trim() : undefined;
  if (options?.required && !str) {
    throw new Error(`${key} is required`);
  }
  return str;
}

/**
 * JSON result helper.
 */
function jsonResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    details: payload,
  };
}

/**
 * Options for creating the tool.
 */
export interface ClaudeCodeStartToolOptions {
  /** Session ID of the requester (e.g., orchestrator) */
  requesterSessionId?: string;

  /** Callback when session starts */
  onSessionStart?: (sessionId: string, context: SessionPlanningContext) => void;

  /** Callback for state changes */
  onStateChange?: (sessionId: string, state: SessionState) => void;

  /** Callback when Claude Code asks a question */
  onQuestion?: (sessionId: string, question: string) => Promise<string | null>;

  /** Callback when a blocker is detected (return true to pause, false to let complete) */
  onBlocker?: (sessionId: string, blocker: BlockerInfo) => Promise<boolean>;

  /** Default permission mode */
  defaultPermissionMode?: "default" | "acceptEdits" | "bypassPermissions";

  /** Default model */
  defaultModel?: "opus" | "sonnet" | "haiku";
}

/**
 * Create an AI-driven question handler.
 *
 * This implements the same pattern as core:
 * 1. AI assessment - Can the orchestrator handle this question?
 * 2. Retry detection - Has this question been asked multiple times?
 * 3. AI response - Generate a contextual answer
 *
 * @param getContext - Function to get orchestrator context for a session
 * @param onBlocker - Called when a true blocker is detected (user intervention needed)
 */
export function createAIDrivenQuestionHandler(params: {
  getContext: (sessionId: string) => import("../../../../src/agents/claude-code/orchestrator.js").OrchestratorContext;
  onBlocker?: (sessionId: string, question: string, reason: string) => Promise<void>;
}): (sessionId: string, question: string) => Promise<string | null> {
  const { getContext, onBlocker } = params;

  return async (sessionId: string, question: string): Promise<string | null> => {
    // Dynamic import to avoid issues if core is not available
    const {
      assessQuestion,
      generateOrchestratorResponse,
      getAttemptHistory,
      recordAttempt,
      isSimilarQuestion,
    } = await import("../../../../src/agents/claude-code/orchestrator.js");

    const context = getContext(sessionId);

    // Step 1: AI assessment
    const assessment = await assessQuestion(context, question);

    // Step 1a: Impossible = true blocker
    if (assessment.confidence === "impossible") {
      log.warn(`[${sessionId}] AI cannot handle: ${question.slice(0, 100)}...`);
      if (onBlocker) {
        await onBlocker(sessionId, question, assessment.reasoning || "Requires user input");
      }
      return null;
    }

    // Step 2: Check retry history
    const history = getAttemptHistory(sessionId);
    const similarAttempts = history.filter((a) => isSimilarQuestion(a.question, question));

    if (similarAttempts.length >= 3) {
      log.warn(`[${sessionId}] AI failed 3 times on similar questions`);
      if (onBlocker) {
        const previousAnswers = similarAttempts
          .map((a, i) => `${i + 1}. ${a.myAnswer.slice(0, 80)}...`)
          .join("\n");
        await onBlocker(
          sessionId,
          question,
          `Tried ${similarAttempts.length} times. Previous answers:\n${previousAnswers}`,
        );
      }
      return null;
    }

    // Step 3: Generate answer
    const answer = await generateOrchestratorResponse(context, question);
    log.info(`[${sessionId}] AI answer (${assessment.confidence}): ${answer.slice(0, 100)}...`);

    // Step 4: Record attempt
    recordAttempt(sessionId, {
      question,
      myAnswer: answer,
      confidence: assessment.confidence,
      timestamp: Date.now(),
    });

    return answer;
  };
}

/**
 * Create the claude_code_start tool.
 */
export function createClaudeCodeStartTool(options?: ClaudeCodeStartToolOptions) {
  return {
    name: "claude_code_start",
    label: "Claude Code",
    description: `Start a Claude Code session with your enriched prompt and context.

Use this after:
1. Loading project context with project_context tool
2. Analyzing the task
3. Asking user for any clarifications
4. Formulating a detailed, enriched prompt

The session will run in background. You'll receive questions via conversation.`,
    parameters: ClaudeCodeStartToolSchema,
    execute: async (
      _toolCallId: string,
      args: unknown,
    ): Promise<{ content: Array<{ type: "text"; text: string }>; details: unknown }> => {
      const params = args as Record<string, unknown>;

      try {
        const projectInput = readStringParam(params, "project", { required: true })!;
        const prompt = readStringParam(params, "prompt", { required: true })!;
        const originalTask = readStringParam(params, "originalTask") || prompt;
        const worktree = readStringParam(params, "worktree");
        const resumeToken = readStringParam(params, "resumeToken");

        const planningDecisions = Array.isArray(params.planningDecisions)
          ? (params.planningDecisions as string[])
          : [];
        const userClarifications = Array.isArray(params.userClarifications)
          ? (params.userClarifications as string[])
          : [];

        // Permission mode and model
        const permissionModeInput = readStringParam(params, "permissionMode");
        const permissionMode =
          permissionModeInput === "default" ||
          permissionModeInput === "acceptEdits" ||
          permissionModeInput === "bypassPermissions"
            ? permissionModeInput
            : options?.defaultPermissionMode || "default";

        const modelInput = readStringParam(params, "model");
        const model =
          modelInput === "opus" || modelInput === "sonnet" || modelInput === "haiku"
            ? modelInput
            : options?.defaultModel;

        // Check for duplicate resume
        if (resumeToken) {
          const existingSession = getSessionByToken(resumeToken);
          if (existingSession && existingSession.status === "running") {
            log.info(
              `Session ${resumeToken.slice(0, 8)}... is already running, sending input`,
            );

            const inputSent = sendInput(existingSession.id, prompt);
            if (inputSent) {
              return jsonResult({
                status: "already_running",
                message:
                  "Session is already active - your message was sent to the existing session",
                sessionId: existingSession.id,
                resumeToken: existingSession.resumeToken,
              });
            }
          }
        }

        // Resolve project path
        let projectPath: string | undefined;
        let projectName: string = projectInput;

        // If resuming, get working directory from the resume token first
        if (resumeToken) {
          const tokenWorkingDir = getWorkingDirFromResumeToken(resumeToken);
          if (tokenWorkingDir) {
            projectPath = tokenWorkingDir;
            projectName = path.basename(tokenWorkingDir);
            const worktreeMatch = tokenWorkingDir.match(
              /(.+)\/\.worktrees\/([^/]+)$/,
            );
            if (worktreeMatch) {
              projectName = `${path.basename(worktreeMatch[1])} @${worktreeMatch[2]}`;
            }
            log.info(`Using working dir from token: ${projectPath}`);
          }
        }

        // Fall back to project resolution
        if (!projectPath) {
          if (projectInput.startsWith("/")) {
            projectPath = projectInput;
            projectName = path.basename(projectInput);
          } else {
            const projectSpec = worktree
              ? `${projectInput} @${worktree}`
              : projectInput;
            const resolved = resolveProject(projectSpec);

            if (resolved) {
              projectPath = resolved.workingDir;
              projectName = resolved.displayName.split(" ")[0] || projectInput;
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

        // Create planning context
        const planningContext: SessionPlanningContext = {
          requesterSessionId: options?.requesterSessionId || "unknown",
          originalTask,
          enrichedPrompt: prompt,
          planningDecisions,
          userClarifications,
          planningStartedAt: Date.now(),
        };

        // Try to load project context if available
        try {
          const projectCtx = loadProjectContext(projectName);
          if (projectCtx) {
            planningContext.projectContext = projectCtx;
          }
        } catch {
          // Ignore - project context is optional
        }

        // Start the Claude Code session
        const result = await startSession({
          workingDir: projectPath,
          prompt,
          resumeToken,
          permissionMode,
          model,

          // State change handler
          onStateChange: options?.onStateChange
            ? (state: SessionState) => {
                if (result.sessionId) {
                  options.onStateChange!(result.sessionId, state);
                }
              }
            : undefined,

          // Question handler
          onQuestion: options?.onQuestion
            ? async (question: string): Promise<string | null> => {
                if (result.sessionId) {
                  return options.onQuestion!(result.sessionId, question);
                }
                return null;
              }
            : undefined,

          // Blocker handler
          onBlocker: options?.onBlocker
            ? async (blocker: BlockerInfo): Promise<boolean> => {
                if (result.sessionId) {
                  return options.onBlocker!(result.sessionId, blocker);
                }
                return false;
              }
            : undefined,
        });

        if (!result.success) {
          return jsonResult({
            status: "error",
            error: result.error || "Failed to start Claude Code session",
          });
        }

        const sessionId = result.sessionId!;

        // Store planning context
        setSessionPlanningContext(sessionId, planningContext);

        // Notify callback
        if (options?.onSessionStart) {
          options.onSessionStart(sessionId, planningContext);
        }

        log.info(`Claude Code session started: ${sessionId}`);

        return jsonResult({
          status: "ok",
          sessionId,
          resumeToken: result.resumeToken,
          project: projectName,
          workingDir: projectPath,
          branch: getGitBranch(projectPath),
          message: `Claude Code session started for ${projectName}. Session is running in background.`,
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
