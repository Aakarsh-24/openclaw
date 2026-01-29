export interface ActionReceipt {
  id: string;
  timestamp: string;
  sessionKey: string;
  tier: "low" | "medium" | "high";
  toolName: string;
  argumentsHash: string;
  resultHash: string;
  success: boolean;
  durationMs: number;
  anomalies: string[];
  daCommitment?: string;
}

export interface ReceiptStats {
  total: number;
  byTier: Record<string, number>;
  anomalyCount: number;
}
