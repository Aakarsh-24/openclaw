import { formatEnvelopeTimestamp } from "../agents/date-time.js";

export type AgentEnvelopeParams = {
  channel: string;
  from?: string;
  timestamp?: number | Date;
  host?: string;
  ip?: string;
  body: string;
};

function formatTimestamp(ts?: number | Date): string | undefined {
  if (!ts) return undefined;
  const date = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(date.getTime())) return undefined;
  return formatEnvelopeTimestamp(date);
}

export function formatAgentEnvelope(params: AgentEnvelopeParams): string {
  const channel = params.channel?.trim() || "Channel";
  const parts: string[] = [channel];
  if (params.from?.trim()) parts.push(params.from.trim());
  if (params.host?.trim()) parts.push(params.host.trim());
  if (params.ip?.trim()) parts.push(params.ip.trim());
  const ts = formatTimestamp(params.timestamp);
  if (ts) parts.push(ts);
  const header = `[${parts.join(" ")}]`;
  return `${header} ${params.body}`;
}

export function formatThreadStarterEnvelope(params: {
  channel: string;
  author?: string;
  timestamp?: number | Date;
  body: string;
}): string {
  return formatAgentEnvelope({
    channel: params.channel,
    from: params.author,
    timestamp: params.timestamp,
    body: params.body,
  });
}
