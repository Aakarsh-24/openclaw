/**
 * Security audit interceptor.
 * Blocks read/write/edit access to sensitive files and paths.
 */

import type { InterceptorRegistration } from "../types.js";
import { isSensitivePath } from "./sensitive-paths.js";

export function createSecurityAudit(): InterceptorRegistration<"tool.before"> {
  return {
    id: "builtin:security-audit",
    name: "tool.before",
    priority: 99, // high priority, just below command-safety-guard
    toolMatcher: /^(read|write|edit)$/,
    handler: (_input, output) => {
      const raw = output.args.file_path ?? output.args.path;
      const filePath = typeof raw === "string" ? raw : "";
      if (filePath && isSensitivePath(filePath)) {
        output.block = true;
        output.blockReason = `Access denied: "${filePath}" contains sensitive data`;
      }
    },
  };
}
