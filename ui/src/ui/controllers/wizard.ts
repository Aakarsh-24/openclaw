import type { GatewayBrowserClient } from "../gateway";

export type WizardStep = {
  id: string;
  type: "note" | "select" | "text" | "confirm" | "multiselect" | "progress" | "action";
  title?: string;
  message?: string;
  options?: Array<{ value: unknown; label: string; hint?: string }>;
  initialValue?: unknown;
  placeholder?: string;
  sensitive?: boolean;
  executor?: "gateway" | "client";
};

export type WizardResult = {
  done: boolean;
  step?: WizardStep;
  status?: "running" | "done" | "cancelled" | "error";
  error?: string;
};

export async function wizardStart(gateway: GatewayBrowserClient, params: {
  wizard: "configure";
}): Promise<{ sessionId: string } & WizardResult> {
  return gateway.request("wizard.start", {
    wizard: params.wizard,
  });
}

export async function wizardNext(
  gateway: GatewayBrowserClient,
  params: { sessionId: string; answer?: { stepId: string; value?: unknown } },
): Promise<WizardResult> {
  return gateway.request("wizard.next", params);
}

export async function wizardCancel(gateway: GatewayBrowserClient, sessionId: string) {
  return gateway.request("wizard.cancel", { sessionId });
}
