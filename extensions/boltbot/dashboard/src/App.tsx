import { useState, useEffect, useCallback, useRef } from "react";
import type { ActionReceipt } from "./types";
import { useStats, useReceipts } from "./hooks";
import { cn } from "./utils";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import StatsCards from "./components/StatsCards";
import FilterControls from "./components/FilterControls";
import ReceiptList from "./components/ReceiptList";
import ReceiptDetail from "./components/ReceiptDetail";
import SessionView from "./components/SessionView";

const LIMIT = 50;

export default function App() {
  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [allReceipts, setAllReceipts] = useState<ActionReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ActionReceipt | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "sessions">("list");
  const [hasMore, setHasMore] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const { stats, isLoading: statsLoading, error: statsError } = useStats();
  const { receipts, isLoading: receiptsLoading, error: receiptsError } = useReceipts(LIMIT, 0);

  // Polling: merge new receipts at the top, do NOT touch loadedCount or hasMore
  useEffect(() => {
    if (receipts) {
      setAllReceipts((prev) => {
        const ids = new Set(prev.map((r) => r.id));
        const newOnes = receipts.filter((r) => !ids.has(r.id));
        if (newOnes.length === 0) return prev;
        return [...newOnes, ...prev];
      });
    }
  }, [receipts]);

  // Initial load: set hasMore and loadedCount once
  useEffect(() => {
    if (receipts && !initialLoadDone.current) {
      initialLoadDone.current = true;
      setLoadedCount(receipts.length);
      setHasMore(receipts.length === LIMIT);
    }
  }, [receipts]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    fetch(`/boltbot/receipts?limit=${LIMIT}&offset=${loadedCount}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((data: { receipts: ActionReceipt[] }) => {
        setAllReceipts((prev) => {
          const ids = new Set(prev.map((r) => r.id));
          const newOnes = data.receipts.filter((r) => !ids.has(r.id));
          return [...prev, ...newOnes];
        });
        setHasMore(data.receipts.length === LIMIT);
        setLoadedCount((prev) => prev + data.receipts.length);
      })
      .catch((err) => {
        setLoadMoreError(err instanceof Error ? err.message : "Failed to load more");
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [loadedCount, loadingMore]);

  const filtered = allReceipts.filter((r) => {
    if (selectedTiers.length > 0 && !selectedTiers.includes(r.tier)) return false;
    if (anomalyOnly && r.anomalies.length === 0) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Header />
      <Sidebar />
      <main className="pt-14 pl-0 lg:pl-56 p-6">
        <div className="max-w-6xl mx-auto space-y-6 pt-6">
          <StatsCards stats={stats} isLoading={statsLoading} error={statsError} />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "px-4 py-1.5 text-sm rounded-lg transition-colors",
                viewMode === "list"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200",
              )}
            >
              All Receipts
            </button>
            <button
              onClick={() => setViewMode("sessions")}
              className={cn(
                "px-4 py-1.5 text-sm rounded-lg transition-colors",
                viewMode === "sessions"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-neutral-200",
              )}
            >
              By Session
            </button>
          </div>

          <FilterControls
            selectedTiers={selectedTiers}
            onTiersChange={setSelectedTiers}
            anomalyOnly={anomalyOnly}
            onAnomalyOnlyChange={setAnomalyOnly}
          />

          {viewMode === "list" ? (
            <ReceiptList
              receipts={filtered}
              isLoading={receiptsLoading}
              error={receiptsError}
              onSelect={setSelectedReceipt}
              selectedId={selectedReceipt?.id ?? null}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              loadingMore={loadingMore}
            />
          ) : (
            <SessionView
              receipts={filtered}
              onSelectReceipt={setSelectedReceipt}
            />
          )}
        </div>
      </main>

      <ReceiptDetail
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
}
