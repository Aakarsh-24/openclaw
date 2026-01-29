/**
 * WebSocket Gateway Client for Security Testing
 *
 * Provides direct protocol communication with the Moltbot gateway
 * for E2E security test scenarios.
 */
import WebSocket from "ws";

export interface GatewayMessage {
  type: string;
  payload: unknown;
}

export class GatewayTestClient {
  private ws: WebSocket | null = null;
  private messageQueue: GatewayMessage[] = [];
  private responseWaiters: Map<string, (msg: GatewayMessage) => void> =
    new Map();

  constructor(
    private gatewayUrl: string,
    private authToken: string,
  ) {}

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.gatewayUrl, {
      headers: { Authorization: `Bearer ${this.authToken}` },
    });

    return new Promise((resolve, reject) => {
      this.ws!.on("open", resolve);
      this.ws!.on("error", reject);
      this.ws!.on("message", (data) => {
        const msg = JSON.parse(data.toString()) as GatewayMessage;
        this.messageQueue.push(msg);

        const waiter = this.responseWaiters.get(msg.type);
        if (waiter) {
          waiter(msg);
          this.responseWaiters.delete(msg.type);
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    this.ws?.close();
    this.ws = null;
  }

  async sendMessage(sessionKey: string, content: string): Promise<void> {
    this.ws?.send(
      JSON.stringify({
        type: "message",
        sessionKey,
        content,
      }),
    );
  }

  async waitForResponse(
    type: string,
    timeoutMs = 30000,
  ): Promise<GatewayMessage> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timeout waiting for ${type}`)),
        timeoutMs,
      );

      this.responseWaiters.set(type, (msg) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });
  }

  getMessages(): GatewayMessage[] {
    return this.messageQueue;
  }

  clearMessages(): void {
    this.messageQueue = [];
  }
}
