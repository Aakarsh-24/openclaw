import { cn } from "../utils";

interface Props {
  selectedTiers: string[];
  onTiersChange: (tiers: string[]) => void;
  anomalyOnly: boolean;
  onAnomalyOnlyChange: (v: boolean) => void;
}

const tiers = [
  { value: "low", label: "Low", color: "emerald" },
  { value: "medium", label: "Medium", color: "yellow" },
  { value: "high", label: "High", color: "red" },
] as const;

const tierStyles: Record<string, { active: string; inactive: string }> = {
  emerald: {
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500",
    inactive: "border-neutral-700 text-neutral-400 hover:border-emerald-500/50",
  },
  yellow: {
    active: "bg-yellow-500/20 text-yellow-400 border-yellow-500",
    inactive: "border-neutral-700 text-neutral-400 hover:border-yellow-500/50",
  },
  red: {
    active: "bg-red-500/20 text-red-400 border-red-500",
    inactive: "border-neutral-700 text-neutral-400 hover:border-red-500/50",
  },
};

export default function FilterControls({
  selectedTiers,
  onTiersChange,
  anomalyOnly,
  onAnomalyOnlyChange,
}: Props) {
  function toggleTier(tier: string) {
    if (selectedTiers.includes(tier)) {
      onTiersChange(selectedTiers.filter((t) => t !== tier));
    } else {
      onTiersChange([...selectedTiers, tier]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <div role="group" aria-label="Filter by tier" className="flex flex-wrap gap-2">
        {tiers.map((t) => {
          const isActive = selectedTiers.includes(t.value);
          const style = tierStyles[t.color];
          return (
            <button
              key={t.value}
              onClick={() => toggleTier(t.value)}
              aria-pressed={isActive}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                isActive ? style.active : style.inactive,
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => onAnomalyOnlyChange(!anomalyOnly)}
        aria-pressed={anomalyOnly}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
          anomalyOnly
            ? "bg-red-500/20 text-red-400 border-red-500"
            : "border-neutral-700 text-neutral-400 hover:border-red-500/50",
        )}
      >
        Anomalies Only
      </button>
    </div>
  );
}
