import type { InterceptorRegistry } from "./registry.js";
import type {
  InterceptorEvent,
  InterceptorInputMap,
  InterceptorName,
  InterceptorOutputMap,
  ToolBeforeOutput,
  MessageBeforeOutput,
  ParamsBeforeOutput,
} from "./types.js";

function detectToolBeforeEvent(
  id: string,
  matchContext: string | undefined,
  output: ToolBeforeOutput,
): InterceptorEvent | null {
  if (output.block) {
    return {
      name: "tool.before",
      interceptorId: id,
      matchContext,
      blocked: true,
      blockReason: output.blockReason,
    };
  }
  return null;
}

function detectMessageBeforeEvent(
  id: string,
  matchContext: string | undefined,
  originalMessage: string,
  output: MessageBeforeOutput,
): InterceptorEvent | null {
  const mutations: string[] = [];
  if (output.message !== originalMessage) {
    mutations.push("message mutated");
  }
  if (Object.keys(output.metadata).length > 0) {
    mutations.push(`metadata: ${Object.keys(output.metadata).join(", ")}`);
  }
  if (mutations.length === 0) {
    return null;
  }
  return { name: "message.before", interceptorId: id, matchContext, mutations };
}

function detectParamsBeforeEvent(
  id: string,
  matchContext: string | undefined,
  before: { thinkLevel?: string; reasoningLevel?: string; temperature?: number },
  output: ParamsBeforeOutput,
): InterceptorEvent | null {
  const mutations: string[] = [];
  if (output.thinkLevel !== before.thinkLevel) {
    mutations.push(`thinkLevel → ${output.thinkLevel}`);
  }
  if (output.reasoningLevel !== before.reasoningLevel) {
    mutations.push(`reasoningLevel → ${output.reasoningLevel}`);
  }
  if (output.temperature !== before.temperature) {
    mutations.push(`temperature → ${output.temperature}`);
  }
  if (mutations.length === 0) {
    return null;
  }
  return { name: "params.before", interceptorId: id, matchContext, mutations };
}

export async function trigger<N extends InterceptorName>(
  registry: InterceptorRegistry,
  name: N,
  input: InterceptorInputMap[N],
  output: InterceptorOutputMap[N],
): Promise<InterceptorOutputMap[N]> {
  // Resolve match context: toolName for tool events, agentId for message/params events
  let matchContext: string | undefined;
  if ("toolName" in input && typeof input.toolName === "string") {
    matchContext = input.toolName;
  } else if ("agentId" in input && typeof input.agentId === "string") {
    matchContext = input.agentId;
  }

  const onEvent = registry.getOnEvent();
  const interceptors = registry.get(name, matchContext);

  for (const interceptor of interceptors) {
    // Snapshot state before handler for change detection
    let snapshotMessage: string | undefined;
    let snapshotParams:
      | { thinkLevel?: string; reasoningLevel?: string; temperature?: number }
      | undefined;

    if (onEvent) {
      if (name === "message.before") {
        snapshotMessage = (output as unknown as MessageBeforeOutput).message;
      } else if (name === "params.before") {
        const p = output as unknown as ParamsBeforeOutput;
        snapshotParams = {
          thinkLevel: p.thinkLevel,
          reasoningLevel: p.reasoningLevel,
          temperature: p.temperature,
        };
      }
    }

    await interceptor.handler(input, output);

    // Emit event if callback is set and something changed
    if (onEvent) {
      let evt: InterceptorEvent | null = null;
      if (name === "tool.before") {
        evt = detectToolBeforeEvent(
          interceptor.id,
          matchContext,
          output as unknown as ToolBeforeOutput,
        );
      } else if (name === "message.before") {
        evt = detectMessageBeforeEvent(
          interceptor.id,
          matchContext,
          snapshotMessage!,
          output as unknown as MessageBeforeOutput,
        );
      } else if (name === "params.before") {
        evt = detectParamsBeforeEvent(
          interceptor.id,
          matchContext,
          snapshotParams!,
          output as unknown as ParamsBeforeOutput,
        );
      }
      if (evt) {
        try {
          onEvent(evt);
        } catch {
          /* ignore callback errors */
        }
      }
    }
  }
  return output;
}
