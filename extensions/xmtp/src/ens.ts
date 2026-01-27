/**
 * ENS Name Resolution for XMTP Plugin
 * 
 * Pure JavaScript implementation using mainnet RPC providers.
 * No ethers.js dependency - keeps bundle size minimal.
 * 
 * Features:
 * - In-memory cache with configurable TTL (default 1 hour)
 * - Timeout protection (default 5 seconds)
 * - Support for multiple ENS TLDs (.eth, .xyz, .base.eth, etc.)
 * - Handles both `name.eth` and `@name.eth` formats
 * 
 * @module ens
 */

import { keccak256 } from "ox/Hash";
import { fromBytes as hexFromBytes, fromString as hexFromString } from "ox/Hex";
import { fromHex as bytesFromHex } from "ox/Bytes";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Public Ethereum mainnet RPC endpoints
const DEFAULT_RPC_URLS = [
  "https://eth.llamarpc.com",
  "https://rpc.ankr.com/eth",
  "https://cloudflare-eth.com",
];

const ENS_REGISTRY_ADDRESS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

interface CacheEntry {
  address: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Compute ENS namehash for a given domain name.
 * Uses keccak256 recursively to build the hash.
 * 
 * @param name - ENS domain name (e.g., "vitalik.eth")
 * @returns Namehash as hex string
 * 
 * @example
 * ```typescript
 * namehash("vitalik.eth")
 * // => "0xee6c4522aab0003e8d14cd40a6af439055fd2577951148c14b6cea9a53475835"
 * ```
 */
export function namehash(name: string): string {
  if (!name || name === "") {
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  }

  const labels = name.toLowerCase().split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = new Uint8Array(32); // Start with 32 zero bytes

  for (let i = labels.length - 1; i >= 0; i--) {
    const label = labels[i];
    // Convert label string to hex, then hash it to bytes
    const labelHex = hexFromString(label);
    const labelHash = keccak256(labelHex, { as: "Bytes" });
    
    // Combine current node with label hash
    const combined = new Uint8Array(64);
    combined.set(node, 0);
    combined.set(labelHash, 32);
    
    // Hash the combination to get new node
    node = keccak256(combined, { as: "Bytes" });
  }

  return hexFromBytes(node);
}

/**
 * Check if a name looks like an ENS domain.
 * Supports .eth, .xyz, .base.eth, etc.
 * 
 * @param name - Potential ENS name
 * @returns True if it matches ENS pattern
 */
export function isEnsName(name: string): boolean {
  const normalized = name.trim().toLowerCase().replace(/^@/, "");
  return /^[a-z0-9.-]+\.(eth|xyz|kred|luxe|art)$/i.test(normalized);
}

/**
 * Normalize ENS name by removing @ prefix and lowercasing.
 * 
 * @param name - ENS name (may have @ prefix)
 * @returns Normalized name
 */
export function normalizeEnsName(name: string): string {
  return name.trim().toLowerCase().replace(/^@/, "");
}

/**
 * Resolve an ENS name to an Ethereum address.
 * Uses JSON-RPC eth_call to query the ENS resolver.
 * 
 * @param ensName - ENS domain name (e.g., "vitalik.eth")
 * @param options - Resolution options (timeout, cache TTL, RPC URLs)
 * @returns Ethereum address or null if not found
 * 
 * @example
 * ```typescript
 * const address = await resolveEnsName("vitalik.eth");
 * console.log(address); // "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
 * ```
 */
export async function resolveEnsName(
  ensName: string,
  options: {
    timeoutMs?: number;
    cacheTtlMs?: number;
    rpcUrls?: string[];
  } = {}
): Promise<string | null> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    rpcUrls = DEFAULT_RPC_URLS,
  } = options;

  const normalized = normalizeEnsName(ensName);

  if (!isEnsName(normalized)) {
    return null;
  }

  // Check cache
  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
    return cached.address;
  }

  // Resolve via RPC
  const hash = namehash(normalized);
  
  // ENS resolver lookup: resolver(bytes32 node) returns address
  const resolverData = `0x0178b8bf${hash.slice(2)}`; // resolver(bytes32)
  
  try {
    const resolverAddress = await callRpc(
      rpcUrls,
      "eth_call",
      [
        {
          to: ENS_REGISTRY_ADDRESS,
          data: resolverData,
        },
        "latest",
      ],
      timeoutMs
    );

    if (!resolverAddress || resolverAddress === "0x" || resolverAddress.length < 66) {
      return null; // No resolver configured
    }

    // Extract resolver address (last 40 chars = 20 bytes)
    const resolver = "0x" + resolverAddress.slice(-40);

    // Call addr(bytes32) on the resolver
    const addrData = `0x3b3b57de${hash.slice(2)}`; // addr(bytes32)
    const addressResult = await callRpc(
      rpcUrls,
      "eth_call",
      [
        {
          to: resolver,
          data: addrData,
        },
        "latest",
      ],
      timeoutMs
    );

    if (!addressResult || addressResult === "0x" || addressResult.length < 66) {
      return null; // No address set
    }

    // Extract address (last 40 chars = 20 bytes)
    const address = "0x" + addressResult.slice(-40);

    // Validate it's not zero address
    if (address === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    // Cache the result
    cache.set(normalized, { address, timestamp: Date.now() });

    return address;
  } catch (error) {
    console.error(`[ens] Failed to resolve ${normalized}:`, error);
    return null;
  }
}

/**
 * Call JSON-RPC with fallback and timeout.
 * Tries multiple RPC URLs in sequence until one succeeds.
 * 
 * @param rpcUrls - Array of RPC endpoint URLs
 * @param method - JSON-RPC method name
 * @param params - Method parameters
 * @param timeoutMs - Request timeout in milliseconds
 * @returns RPC result
 */
async function callRpc(
  rpcUrls: string[],
  method: string,
  params: unknown[],
  timeoutMs: number
): Promise<string> {
  let lastError: Error | null = null;

  for (const url of rpcUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();

      if (json.error) {
        throw new Error(`RPC error: ${json.error.message}`);
      }

      return json.result;
    } catch (error) {
      lastError = error as Error;
      // Try next RPC URL
      continue;
    }
  }

  throw lastError || new Error("All RPC endpoints failed");
}

/**
 * Clear the ENS resolution cache.
 * Useful for testing or forcing fresh lookups.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get current cache size.
 * 
 * @returns Number of cached ENS names
 */
export function getCacheSize(): number {
  return cache.size;
}

/**
 * Resolve multiple ENS names in parallel.
 * More efficient than calling resolveEnsName multiple times sequentially.
 * 
 * @param names - Array of ENS names
 * @param options - Resolution options
 * @returns Map of ENS name to address (null if not found)
 */
export async function resolveBatch(
  names: string[],
  options: Parameters<typeof resolveEnsName>[1] = {}
): Promise<Map<string, string | null>> {
  const results = await Promise.all(
    names.map(async (name) => {
      const address = await resolveEnsName(name, options);
      return [normalizeEnsName(name), address] as const;
    })
  );

  return new Map(results);
}
