import { env } from "../config/env.js";

interface VaultResponse<T> {
	data: T;
	lease_id?: string;
	renewable?: boolean;
	lease_duration?: number;
}

interface VaultTransitEncryptResponse {
	ciphertext: string;
}

interface VaultTransitDecryptResponse {
	plaintext: string;
}

interface VaultKVData {
	data: Record<string, unknown>;
	metadata?: {
		created_time: string;
		version: number;
	};
}

/**
 * HashiCorp Vault client for secrets management
 * Uses Transit engine for encryption and KV engine for secret storage
 */
export class VaultClient {
	private baseUrl: string;
	private token: string;

	constructor(address?: string, token?: string) {
		this.baseUrl = address ?? env.VAULT_ADDR ?? "http://localhost:8200";
		this.token = token ?? env.VAULT_TOKEN ?? "";
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown
	): Promise<T> {
		const url = `${this.baseUrl}/v1${path}`;

		const response = await fetch(url, {
			method,
			headers: {
				"X-Vault-Token": this.token,
				"Content-Type": "application/json",
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Vault request failed: ${response.status} - ${error}`);
		}

		// Some endpoints return 204 No Content
		if (response.status === 204) {
			return {} as T;
		}

		return response.json() as Promise<T>;
	}

	/**
	 * Check if Vault is available and authenticated
	 */
	async isHealthy(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/v1/sys/health`, {
				method: "GET",
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	// Transit Engine Methods (for encryption)

	/**
	 * Create a named encryption key in the transit engine
	 */
	async createTransitKey(name: string): Promise<void> {
		await this.request("POST", `/transit/keys/${name}`, {
			type: "aes256-gcm96",
		});
	}

	/**
	 * Encrypt data using a named transit key
	 */
	async transitEncrypt(keyName: string, plaintext: string): Promise<string> {
		const base64Plaintext = Buffer.from(plaintext).toString("base64");

		const response = await this.request<VaultResponse<VaultTransitEncryptResponse>>(
			"POST",
			`/transit/encrypt/${keyName}`,
			{ plaintext: base64Plaintext }
		);

		return response.data.ciphertext;
	}

	/**
	 * Decrypt data using a named transit key
	 */
	async transitDecrypt(keyName: string, ciphertext: string): Promise<string> {
		const response = await this.request<VaultResponse<VaultTransitDecryptResponse>>(
			"POST",
			`/transit/decrypt/${keyName}`,
			{ ciphertext }
		);

		return Buffer.from(response.data.plaintext, "base64").toString("utf8");
	}

	/**
	 * Rotate a transit key
	 */
	async rotateTransitKey(keyName: string): Promise<void> {
		await this.request("POST", `/transit/keys/${keyName}/rotate`);
	}

	// KV Engine Methods (for secret storage)

	/**
	 * Read a secret from KV v2 engine
	 */
	async kvGet(path: string): Promise<Record<string, unknown> | null> {
		try {
			const response = await this.request<VaultResponse<VaultKVData>>(
				"GET",
				`/secret/data/${path}`
			);
			return response.data.data;
		} catch {
			return null;
		}
	}

	/**
	 * Write a secret to KV v2 engine
	 */
	async kvPut(path: string, data: Record<string, unknown>): Promise<void> {
		await this.request("POST", `/secret/data/${path}`, { data });
	}

	/**
	 * Delete a secret from KV v2 engine
	 */
	async kvDelete(path: string): Promise<void> {
		await this.request("DELETE", `/secret/data/${path}`);
	}

	/**
	 * List secrets at a path
	 */
	async kvList(path: string): Promise<string[]> {
		try {
			const response = await this.request<VaultResponse<{ keys: string[] }>>(
				"LIST",
				`/secret/metadata/${path}`
			);
			return response.data.keys;
		} catch {
			return [];
		}
	}
}

// Singleton instance
let vaultClient: VaultClient | null = null;

/**
 * Get the Vault client instance
 */
export function getVaultClient(): VaultClient {
	if (!vaultClient) {
		vaultClient = new VaultClient();
	}
	return vaultClient;
}

/**
 * Create a tenant-specific Vault path
 */
export function tenantVaultPath(tenantId: string, subPath: string): string {
	return `tenants/${tenantId}/${subPath}`;
}
