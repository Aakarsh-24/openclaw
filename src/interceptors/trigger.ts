import type { InterceptorRegistry } from "./registry.js";
import type { InterceptorInputMap, InterceptorName, InterceptorOutputMap } from "./types.js";

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
  const interceptors = registry.get(name, matchContext);
  for (const interceptor of interceptors) {
    await interceptor.handler(input, output);
  }
  return output;
}
