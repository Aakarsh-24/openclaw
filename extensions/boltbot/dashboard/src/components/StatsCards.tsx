import { Activity, Shield, Layers, AlertTriangle } from "lucide-react";
import type { ReceiptStats } from "../types";

interface Props {
  stats: ReceiptStats | undefined;
  isLoading: boolean;
  error: unknown;
}

const cards = [
  { label: "Total Actions", key: "total" as const, icon: Activity, color: "text-emerald-400" },
  { label: "Low Tier", key: "low" as const, icon: Shield, color: "text-emerald-400" },
  { label: "Medium Tier", key: "medium" as const, icon: Layers, color: "text-yellow-400" },
  { label: "High Tier", key: "high" as const, icon: AlertTriangle, color: "text-red-400" },
];

function getValue(stats: ReceiptStats | undefined, key: string): number {
  if (!stats) return 0;
  if (key === "total") return stats.total;
  return stats.byTier[key] ?? 0;
}

export default function StatsCards({ stats, isLoading, error }: Props) {
  if (error) {
    return (
      <div className="text-red-400 text-sm p-4">
        Failed to load stats: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.key}
          className="bg-neutral-900 rounded-xl border border-neutral-800 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <card.icon className={`w-4 h-4 ${card.color}`} />
            <span className="text-xs text-neutral-400 uppercase tracking-wide">
              {card.label}
            </span>
          </div>
          {isLoading && !stats ? (
            <div className="h-8 w-16 animate-pulse bg-neutral-800 rounded" />
          ) : (
            <div className="text-2xl font-bold">{getValue(stats, card.key)}</div>
          )}
        </div>
      ))}
    </div>
  );
}
