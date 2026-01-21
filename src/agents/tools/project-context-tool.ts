/**
 * Project Context Tool for DyDo
 *
 * Allows DyDo to load, explore, and update project context
 * for Claude Code planning and session guidance.
 */

import { Type } from "@sinclair/typebox";
import {
  exploreProject,
  formatContextForPrompt,
  hasProjectContext,
  isContextStale,
  listProjectsWithContext,
  loadOrExploreProject,
  loadProjectContext,
  updateProjectContext,
  type ProjectContext,
} from "../claude-code/project-context.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam } from "./common.js";
import { optionalStringEnum } from "../schema/typebox.js";

const ProjectContextToolSchema = Type.Object({
  action: optionalStringEnum(["load", "explore", "update", "list", "format"] as const),
  project: Type.Optional(Type.String()),
  path: Type.Optional(Type.String()),
  forceRefresh: Type.Optional(Type.Boolean()),
  // For update action
  preferences: Type.Optional(Type.Array(Type.String())),
  sessionSummary: Type.Optional(
    Type.Object({
      task: Type.String(),
      outcome: optionalStringEnum(["completed", "partial", "failed"] as const),
      notes: Type.Optional(Type.String()),
    }),
  ),
});

export function createProjectContextTool(): AnyAgentTool {
  return {
    label: "Project Context",
    name: "project_context",
    description: `Load, explore, or update project context for Claude Code planning.

Actions:
- load: Load existing context for a project (returns cached or explores if missing/stale)
- explore: Force re-exploration of a project (refreshes cached context)
- update: Add preferences or session summaries to existing context
- list: List all projects with cached context
- format: Format context as markdown for prompt inclusion

Use this before starting a Claude Code session to understand the project.`,
    parameters: ProjectContextToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action") || "load";
      const project = readStringParam(params, "project");
      const projectPath = readStringParam(params, "path");
      const forceRefresh = params.forceRefresh === true;

      // Handle list action
      if (action === "list") {
        const projects = listProjectsWithContext();
        if (projects.length === 0) {
          return jsonResult({
            status: "ok",
            projects: [],
            message: "No projects with cached context found.",
          });
        }

        // Load summary for each project
        const summaries = projects.map((name) => {
          const ctx = loadProjectContext(name);
          return {
            name,
            type: ctx?.type || "unknown",
            path: ctx?.path || "unknown",
            lastExplored: ctx?.lastExplored || "unknown",
            isStale: ctx ? isContextStale(ctx) : true,
          };
        });

        return jsonResult({
          status: "ok",
          projects: summaries,
        });
      }

      // All other actions require project or path
      if (!project && !projectPath) {
        return jsonResult({
          status: "error",
          error: "Either 'project' name or 'path' is required for this action.",
        });
      }

      const resolvedProject = project || (projectPath ? undefined : undefined);
      const resolvedPath = projectPath || findProjectPath(project!);

      if (!resolvedPath) {
        return jsonResult({
          status: "error",
          error: `Could not resolve path for project: ${project}. Provide explicit 'path' parameter.`,
        });
      }

      // Handle explore action
      if (action === "explore") {
        try {
          const context = exploreProject(resolvedPath, resolvedProject);
          return jsonResult({
            status: "ok",
            action: "explored",
            context: summarizeContext(context),
            formatted: formatContextForPrompt(context),
          });
        } catch (err) {
          return jsonResult({
            status: "error",
            error: `Failed to explore project: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }

      // Handle load action
      if (action === "load") {
        try {
          const result = loadOrExploreProject(resolvedPath, resolvedProject, forceRefresh);
          return jsonResult({
            status: "ok",
            action: result.isNew ? "explored" : result.wasStale ? "refreshed" : "loaded",
            context: summarizeContext(result.context),
            formatted: formatContextForPrompt(result.context),
          });
        } catch (err) {
          return jsonResult({
            status: "error",
            error: `Failed to load project context: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }

      // Handle format action
      if (action === "format") {
        const context = loadProjectContext(resolvedProject || "");
        if (!context) {
          return jsonResult({
            status: "error",
            error: `No context found for project: ${resolvedProject}. Use 'load' or 'explore' first.`,
          });
        }
        return jsonResult({
          status: "ok",
          formatted: formatContextForPrompt(context),
        });
      }

      // Handle update action
      if (action === "update") {
        const projectName = resolvedProject || (resolvedPath ? undefined : undefined);
        if (!projectName) {
          return jsonResult({
            status: "error",
            error: "Project name required for update action.",
          });
        }

        if (!hasProjectContext(projectName)) {
          return jsonResult({
            status: "error",
            error: `No existing context for project: ${projectName}. Use 'load' or 'explore' first.`,
          });
        }

        const preferences = Array.isArray(params.preferences)
          ? (params.preferences as string[])
          : undefined;

        const sessionSummary = params.sessionSummary as
          | { task: string; outcome: "completed" | "partial" | "failed"; notes?: string }
          | undefined;

        const recentSessions = sessionSummary
          ? [{ date: new Date().toISOString(), ...sessionSummary }]
          : undefined;

        const updated = updateProjectContext(projectName, {
          preferences,
          recentSessions,
        });

        if (!updated) {
          return jsonResult({
            status: "error",
            error: `Failed to update context for: ${projectName}`,
          });
        }

        return jsonResult({
          status: "ok",
          action: "updated",
          context: summarizeContext(updated),
        });
      }

      return jsonResult({
        status: "error",
        error: `Unknown action: ${action}`,
      });
    },
  };
}

/**
 * Try to find project path from registered aliases or common locations
 */
function findProjectPath(projectName: string): string | undefined {
  // Check common project locations
  const commonBases = [
    "/Users/dydo/Documents/agent",
    "/Users/dydo/clawd/projects",
    "/Users/dydo/clawdbot",
    "/Users/dydo",
  ];

  for (const base of commonBases) {
    const candidate = `${base}/${projectName}`;
    try {
      const fs = require("node:fs");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore
    }
  }

  // Check if it's already an absolute path
  if (projectName.startsWith("/")) {
    try {
      const fs = require("node:fs");
      if (fs.existsSync(projectName)) {
        return projectName;
      }
    } catch {
      // Ignore
    }
  }

  return undefined;
}

/**
 * Create a summary of context for tool response (avoid sending full claudeMd)
 */
function summarizeContext(context: ProjectContext): object {
  return {
    name: context.name,
    path: context.path,
    type: context.type,
    packageManager: context.packageManager,
    testFramework: context.testFramework,
    buildTool: context.buildTool,
    structureCount: Object.keys(context.structure).length,
    conventionsCount: context.conventions.length,
    preferencesCount: context.preferences.length,
    hasClaudeMd: !!context.claudeMd,
    hasAgentsMd: !!context.agentsMd,
    lastExplored: context.lastExplored,
    isStale: isContextStale(context),
  };
}
