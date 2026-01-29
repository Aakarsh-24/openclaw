import { useMemo, useState } from "react";
import { ChevronDown, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { ActionReceipt } from "../types";
import { cn, formatRelativeTime } from "../utils";

interface Props {
  receipts: ActionReceipt[];
  onSelectReceipt: (r: ActionReceipt) => void;
}

const tierBadge: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  high: "bg-red-500/10 text-red-400",
};

interface SessionGroup {
  sessionKey: string;
  receipts: ActionReceipt[];
  latestTimestamp: string;
  tierCounts: Record<string, number>;
}

function groupBySession(receipts: ActionReceipt[]): SessionGroup[] {
  const map = new Map<string, ActionReceipt[]>();
  for (const r of receipts) {
    const existing = map.get(r.sessionKey);
    if (existing) {
      existing.push(r);
    } else {
      map.set(r.sessionKey, [r]);
    }
  }

  const groups: SessionGroup[] = [];
  for (const [sessionKey, recs] of map) {
    const sorted = recs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const tierCounts: Record<string, number> = {};
    for (const r of sorted) {
      tierCounts[r.tier] = (tierCounts[r.tier] ?? 0) + 1;
    }
    groups.push({
      sessionKey,
      receipts: sorted,
      latestTimestamp: sorted[0].timestamp,
      tierCounts,
    });
  }

  return groups.sort(
    (a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime(),
  );
}

function SessionCard({
  group,
  onSelectReceipt,
}: {
  group: SessionGroup;
  onSelectReceipt: (r: ActionReceipt) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-neutral-900 rounded-xl border border-neutral-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-neutral-800/30 transition-colors rounded-xl"
      >
        <ChevronDown
          className={cn(
            "w-4 h-4 text-neutral-400 shrink-0 transition-transform",
            expanded && "rotate-180",
          )}
        />
        <span className="font-mono text-xs truncate flex-1 text-neutral-300">
          {group.sessionKey}
        </span>
        <span className="text-xs text-neutral-400 bg-neutral-800 rounded-full px-2 py-0.5">
          {group.receipts.length}
        </span>
        <span className="text-xs text-neutral-400">
          {formatRelativeTime(group.latestTimestamp)}
        </span>
        <div className="flex gap-1">
          {(["low", "medium", "high"] as const).map(
            (tier) =>
              group.tierCounts[tier] && (
                <span
                  key={tier}
                  className={cn("rounded-full px-1.5 py-0.5 text-xs", tierBadge[tier])}
                >
                  {group.tierCounts[tier]}
                </span>
              ),
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-neutral-800 p-3">
          <div className="grid grid-cols-[1fr_80px_90px_40px_40px] gap-2 px-3 pb-2 text-neutral-400 text-xs uppercase tracking-wide">
            <span>Tool</span>
            <span>Tier</span>
            <span>Time</span>
            <span>Status</span>
            <span>Anomaly</span>
          </div>
          {group.receipts.map((r) => (
            <div
              key={r.id}
              onClick={() => onSelectReceipt(r)}
              className="grid grid-cols-[1fr_80px_90px_40px_40px] gap-2 items-center px-3 py-2 rounded-lg cursor-pointer hover:bg-neutral-800/30 transition-colors"
            >
              <span className="text-sm font-mono truncate">{r.toolName}</span>
              <span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs", tierBadge[r.tier])}>
                  {r.tier}
                </span>
              </span>
              <span className="text-xs text-neutral-400">
                {formatRelativeTime(r.timestamp)}
              </span>
              <span>
                {r.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" aria-label="Success" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" aria-label="Failed" />
                )}
              </span>
              <span>
                {r.anomalies.length > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" aria-label="Has anomalies" />
                ) : (
                  <span className="text-neutral-600" aria-label="No anomalies">&mdash;</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SessionView({ receipts, onSelectReceipt }: Props) {
  const groups = useMemo(() => groupBySession(receipts), [receipts]);

  if (groups.length === 0) {
    return (
      <div className="text-neutral-400 text-sm text-center py-12">
        No sessions recorded yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <SessionCard key={g.sessionKey} group={g} onSelectReceipt={onSelectReceipt} />
      ))}
    </div>
  );
}
