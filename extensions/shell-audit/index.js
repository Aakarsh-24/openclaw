import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Try to import the agent events listener from full path
let onAgentEvent;
try {
  const agentEvents = require('~/.nvm/versions/node/v25.4.0/lib/node_modules/openclaw/dist/infra/agent-events.js');
  onAgentEvent = agentEvents.onAgentEvent;
  // Successfully imported
} catch (e) {
  console.log('[shell-audit] Could not import agent-events:', e.message);
}

const LOG_PATH = path.join(os.homedir(), '.openclaw', 'logs', 'shell-audit.log');

function ensureLogDir() {
  const logDir = path.dirname(LOG_PATH);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function appendLog(entry) {
  try {
    ensureLogDir();
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(LOG_PATH, line);
  } catch (err) {
    console.error('[shell-audit] Failed to write log:', err.message);
  }
}

const shellAuditPlugin = {
  id: 'shell-audit',
  name: 'Shell Audit',
  description: 'Logs every shell command executed via the exec tool.',
  
  register(api) {
    api.logger.info('[plugins] Shell Audit plugin registered');

    // Store pending commands by toolCallId to match with results
    const pendingCommands = new Map();

    // Use onAgentEvent to capture tool execution start events (has args with command)
    if (onAgentEvent) {
      onAgentEvent((event) => {
        try {
          if (event.stream === 'tool' && event.data?.phase === 'start') {
            const toolName = event.data.name;
            if (toolName === 'exec' || toolName === 'Exec' || toolName === 'bash' || toolName === 'run_command') {
              const toolCallId = event.data.toolCallId;
              const args = event.data.args || {};
              const command = args.command || args.CommandLine || args.cmd || JSON.stringify(args);
              const cwd = args.cwd || args.Cwd || null;
              
              pendingCommands.set(toolCallId, { command, cwd, startTime: Date.now() });
              // Command captured via agent event
            }
          }
        } catch (err) {
          console.error('[shell-audit] Error in onAgentEvent:', err.message);
        }
      });
      api.logger.info('[shell-audit] Listening to agent events for tool commands');
    } else {
      api.logger.warn('[shell-audit] Could not set up agent event listener');
    }

    // Capture result and log the complete entry (sync hook)
    api.on('tool_result_persist', (event, ctx) => {
      try {
        const toolName = event.toolName;
        
        if (toolName === 'exec' || toolName === 'Exec' || toolName === 'bash' || toolName === 'run_command') {
          const toolCallId = event.toolCallId;
          const pending = pendingCommands.get(toolCallId);
          const details = event.message?.details || {};
          
          // Try to find command from multiple sources
          let command = pending?.command;
          
          // Check if ctx has session/transcript with the tool call
          if (!command && ctx) {
            // ctx doesn't have transcript, command should come from onAgentEvent
            // Try to find the tool call message in transcript
            const transcript = ctx.transcript || ctx.session?.transcript || ctx.messages || [];
            for (const msg of transcript) {
              if (msg.toolCallId === toolCallId && msg.role === 'assistant') {
                const toolCall = msg.toolCalls?.find(tc => tc.id === toolCallId);
                if (toolCall?.args) {
                  command = toolCall.args.command || toolCall.args.cmd || JSON.stringify(toolCall.args);
                  break;
                }
              }
            }
          }
          
          // Check event for meta (might have command info)
          if (!command && event.meta) {
            command = event.meta;
          }
          
          const logEntry = {
            timestamp: new Date().toISOString(),
            session: event.sessionKey || 'unknown',
            tool: toolName,
            command: command || '(unknown)',
            cwd: pending?.cwd || details.cwd || null,
            exitCode: details.exitCode ?? null,
            durationMs: details.durationMs || null,
          };

          appendLog(logEntry);
          api.logger.info?.(`[shell-audit] Logged: ${logEntry.command} (exit: ${logEntry.exitCode})`);
          
          // Cleanup
          if (toolCallId) pendingCommands.delete(toolCallId);
        }
      } catch (err) {
        console.error('[shell-audit] Error in tool_result_persist:', err.message);
      }
      
      return undefined;
    });

    // Also register a CLI command to view the audit log
    api.registerCli?.(
      ({ program }) => {
        const audit = program.command('shell-audit').description('Shell audit log commands');
        
        audit
          .command('tail')
          .description('Show recent shell commands')
          .option('-n, --lines <n>', 'Number of lines', '20')
          .action((opts) => {
            try {
              if (!fs.existsSync(LOG_PATH)) {
                console.log('No shell audit log found yet.');
                return;
              }
              const content = fs.readFileSync(LOG_PATH, 'utf-8');
              const lines = content.trim().split('\n').slice(-parseInt(opts.lines));
              for (const line of lines) {
                try {
                  const entry = JSON.parse(line);
                  console.log(`[${entry.timestamp}] ${entry.tool}: ${entry.command} (exit: ${entry.exitCode})`);
                } catch {
                  console.log(line);
                }
              }
            } catch (err) {
              console.error('Error reading log:', err.message);
            }
          });

        audit
          .command('clear')
          .description('Clear the shell audit log')
          .action(() => {
            try {
              if (fs.existsSync(LOG_PATH)) {
                fs.unlinkSync(LOG_PATH);
                console.log('Shell audit log cleared.');
              } else {
                console.log('No log file to clear.');
              }
            } catch (err) {
              console.error('Error clearing log:', err.message);
            }
          });
      },
      { commands: ['shell-audit'] }
    );

    // Register the service for lifecycle management
    api.registerService({
      id: 'shell-audit',
      start: () => {
        ensureLogDir();
        api.logger.info('[plugins] Shell Audit service started');
      },
      stop: () => {
        api.logger.info('[plugins] Shell Audit service stopped');
      },
    });
  }
};

export default shellAuditPlugin;
