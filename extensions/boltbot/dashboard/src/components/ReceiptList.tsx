import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { ActionReceipt } from "../types";
import { cn, formatRelativeTime } from "../utils";

interface Props {
  receipts: ActionReceipt[];
  isLoading: boolean;
  error: unknown;
  onSelect: (r: ActionReceipt) => void;
  selectedId: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore?: boolean;
}

const tierBadge: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  high: "bg-red-500/10 text-red-400",
};

export default function ReceiptList({
  receipts,
  isLoading,
  error,
  onSelect,
  selectedId,
  hasMore,
  onLoadMore,
  loadingMore = false,
}: Props) {
  if (error) {
    return (
      <div className="text-red-400 text-sm p-4">
        Failed to load receipts: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  if (isLoading && receipts.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse bg-neutral-800 rounded-lg" />
        ))}
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="text-neutral-400 text-sm text-center py-12">
        No actions recorded yet
      </div>
    );
  }

  return (
    <div role="table" aria-label="Action receipts" aria-busy={isLoading}>
      <div role="row" className="grid grid-cols-[1fr_80px_90px_40px_40px] gap-2 px-3 pb-2 text-neutral-400 text-xs uppercase tracking-wide">
        <span role="columnheader">Tool</span>
        <span role="columnheader">Tier</span>
        <span role="columnheader">Time</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">Anomaly</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {receipts.map((r) => (
          <div
            key={r.id}
            role="row"
            tabIndex={0}
            aria-selected={selectedId === r.id}
            onClick={() => onSelect(r)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(r);
              }
            }}
            className={cn(
              "grid grid-cols-[1fr_80px_90px_40px_40px] gap-2 items-center px-3 py-2 rounded-lg cursor-pointer transition-colors",
              selectedId === r.id
                ? "bg-neutral-800/50 border-l-2 border-emerald-400"
                : "hover:bg-neutral-800/30",
            )}
          >
            <span role="cell" className="text-sm font-mono truncate">{r.toolName}</span>
            <span role="cell">
              <span className={cn("rounded-full px-2 py-0.5 text-xs", tierBadge[r.tier])}>
                {r.tier}
              </span>
            </span>
            <span role="cell" className="text-xs text-neutral-400">{formatRelativeTime(r.timestamp)}</span>
            <span role="cell">
              {r.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" aria-label="Success" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" aria-label="Failed" />
              )}
            </span>
            <span role="cell">
              {r.anomalies.length > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" aria-label="Has anomalies" />
              ) : (
                <span className="text-neutral-600" aria-label="No anomalies">&mdash;</span>
              )}
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <div className="pt-4 flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className={cn(
              "px-4 py-2 text-sm bg-neutral-800 rounded-lg transition-colors",
              loadingMore ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-700",
            )}
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
