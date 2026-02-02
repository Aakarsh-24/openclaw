export type RiskLevel = "low" | "medium" | "high" | "critical";

export function analyzeContent(_text: string): { riskLevel: RiskLevel; matches: Array<{ risk: RiskLevel; reason: string }>; isSuspicious: boolean } {
  // Minimal placeholder analysis: treat all content as low-risk with no matches.
  return { riskLevel: "low", matches: [], isSuspicious: false };
}
