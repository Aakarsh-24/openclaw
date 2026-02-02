import type { InterceptorEvent } from "./types.js";

export function formatInterceptorEvent(evt: InterceptorEvent): string | null {
  if (evt.blocked) {
    const ctx = evt.matchContext ? ` ${evt.matchContext}` : "";
    const reason = evt.blockReason ? ` — "${evt.blockReason}"` : "";
    return `🛡️ ${evt.interceptorId} · blocked${ctx}${reason}`;
  }
  if (evt.mutations?.length) {
    const emoji = evt.name === "message.before" ? "📨" : "⚙️";
    return `${emoji} ${evt.name} · ${evt.mutations.join(", ")}`;
  }
  return null;
}
