/**
 * Web Search CLI Executor
 */

import type { WebSearchResult } from './messages.js';
import type { ExecuteResult, ExecuteOptions } from '../deep-research/executor.js';
import { loadConfig } from '../config/config.js';

export interface ExecuteWebSearchOptions extends Omit<ExecuteOptions, 'topic'> {
  cliPath?: string;
  timeoutMs?: number;
}

export interface ExecuteWebSearchResult extends Omit<ExecuteResult, 'resultJsonPath'> {
  result?: WebSearchResult;
}

/**
 * Execute web search via Gemini CLI
 */
export async function executeWebSearch(
  query: string,
  options: ExecuteWebSearchOptions = {}
): Promise<ExecuteWebSearchResult> {
  const cfg = loadConfig();
  const {
    timeoutMs = cfg.webSearch?.timeoutMs ?? 60000, // Increased from 30s to 60s
    dryRun = false,
  } = options;
  
  if (dryRun) {
    return {
      success: true,
      runId: `dry-run-${Date.now()}`,
      result: {
        response: "DRY RUN: Would search for: " + query,
        session_id: `dry-run-${Date.now()}`,
        stats: {
          models: {
            "gemini-1.5": {
              api: { totalRequests: 0, totalErrors: 0 },
              tokens: { input: 0, candidates: 0, total: 0 }
            }
          }
        }
      },
      stdout: "",
      stderr: ""
    };
  }
  
  try {
    // Simple query validation
    if (!query || query.length < 2) {
      throw new Error("Query too short or empty");
    }
    
    if (query.length > 2000) {
      throw new Error("Query too long (max 2000 characters)");
    }
    
    // Use CUSTOM SKILL BASH SCRIPT (web-search-with-gemini)
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execAsync = promisify(exec);
    
    const cliPath = "/home/almaz/zoo_flow/clawdis/scripts/web_search_with_gemini.sh";
    console.log(`[web-search] Executing CUSTOM SKILL: ${cliPath} "${query}" (timeout: ${timeoutMs}ms)`);
    
    const { stdout, stderr } = await execAsync(`"${cliPath}" ${JSON.stringify(query)}`, {
      timeout: timeoutMs,
      env: { ...process.env, PATH: process.env.PATH },
    });
    
    if (stderr) {
      console.warn(`[web-search] CLI stderr: ${stderr}`);
    }

    // Gemini CLI outputs "Loaded cached credentials." before JSON - extract JSON part
    let jsonStr = stdout.trim();
    const jsonStart = jsonStr.indexOf('{');
    if (jsonStart > 0) {
      jsonStr = jsonStr.slice(jsonStart);
    }

    // Validate JSON before parsing
    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (_) {
      // JSON parse failed - gemini CLI likely output an error
      // Return structured error instead of throwing
      return {
        success: false,
        runId: `error-${Date.now()}`,
        error: `gemini CLI output was not valid JSON: ${jsonStr.slice(0, 200)}`,
        stdout: stdout,
        stderr: stderr
      };
    }

    // Validate required fields exist
    if (!result || typeof result.response !== 'string') {
      return {
        success: false,
        runId: `error-${Date.now()}`,
        error: `Invalid response format from gemini CLI`,
        stdout: stdout,
        stderr: stderr
      };
    }

    return {
      success: true,
      runId: result.session_id || `web-${Date.now()}`,
      result,
      stdout: JSON.stringify(result),
      stderr: ""
    };
    
  } catch (error) {
    const errorStr = String(error);
    console.error(`[web-search] Failed: ${errorStr}`);
    
    let errorMessage = `❌ Поиск не удался: ${errorStr}`;
    
    // Make error messages more user-friendly
    if (errorStr.includes('timeout') || errorStr.includes('ETIMEDOUT') || errorStr.includes('timed out')) {
      errorMessage = '⏱️ Поиск занял слишком много времени';
    } else if (errorStr.includes('not found') || errorStr.includes('exit code 10')) {
      errorMessage = '❌ Gemini CLI не найден или не настроен';
    } else if (errorStr.includes('too short')) {
      errorMessage = '❌ Запрос слишком короткий';
    } else if (errorStr.includes('too long')) {
      errorMessage = '❌ Запрос слишком длинный (макс. 2000 символов)';
    } else if (errorStr.includes('Command failed') || errorStr.includes('Command was killed')) {
      errorMessage = '⏱️ Поиск был прерван (превышено время ожидания или ошибка выполнения)';
    } else if (errorStr.includes('exit code 124')) {
      errorMessage = '⏱️ Поиск превысил 90 секунд (слишком сложный запрос)';
    }
    
    return {
      success: false,
      runId: `error-${Date.now()}`,
      error: errorMessage,
      stdout: "",
      stderr: errorStr
    };
  }
}