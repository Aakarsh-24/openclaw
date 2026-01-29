import useSWR from "swr";
import type { ActionReceipt, ReceiptStats } from "./types";

// TODO: Telegram OAuth — filter receipts by authenticated user's sessionKey

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  });

export function useStats() {
  const { data, isLoading, error } = useSWR<ReceiptStats>(
    "/boltbot/stats",
    fetcher,
    { refreshInterval: 10000, keepPreviousData: true },
  );
  return { stats: data, isLoading, error };
}

export function useReceipts(limit: number, offset: number) {
  const { data, isLoading, error } = useSWR<{ receipts: ActionReceipt[] }>(
    `/boltbot/receipts?limit=${limit}&offset=${offset}`,
    fetcher,
    { refreshInterval: 10000, keepPreviousData: true },
  );
  return { receipts: data?.receipts, isLoading, error };
}
