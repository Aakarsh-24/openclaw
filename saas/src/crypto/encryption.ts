import crypto from "node:crypto";
import { env } from "../config/env.js";

// AES-256-GCM configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derive an encryption key from the master key and a salt
 * Uses PBKDF2 with SHA-256
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
	return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, "sha256");
}

/**
 * Encrypt data using AES-256-GCM
 * Returns: salt (16 bytes) + iv (12 bytes) + authTag (16 bytes) + ciphertext
 */
export function encrypt(plaintext: string, masterKey?: string): Buffer {
	const key = masterKey ?? env.ENCRYPTION_KEY;

	// Generate random salt and IV
	const salt = crypto.randomBytes(SALT_LENGTH);
	const iv = crypto.randomBytes(IV_LENGTH);

	// Derive key from master key
	const derivedKey = deriveKey(key, salt);

	// Encrypt
	const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);

	const authTag = cipher.getAuthTag();

	// Combine: salt + iv + authTag + ciphertext
	return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * Decrypt data encrypted with encrypt()
 */
export function decrypt(encryptedData: Buffer, masterKey?: string): string {
	const key = masterKey ?? env.ENCRYPTION_KEY;

	// Extract components
	const salt = encryptedData.subarray(0, SALT_LENGTH);
	const iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
	const authTag = encryptedData.subarray(
		SALT_LENGTH + IV_LENGTH,
		SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
	);
	const ciphertext = encryptedData.subarray(
		SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
	);

	// Derive key from master key
	const derivedKey = deriveKey(key, salt);

	// Decrypt
	const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([
		decipher.update(ciphertext),
		decipher.final(),
	]);

	return decrypted.toString("utf8");
}

/**
 * Encrypt data and return as base64 string
 */
export function encryptToBase64(plaintext: string, masterKey?: string): string {
	return encrypt(plaintext, masterKey).toString("base64");
}

/**
 * Decrypt base64-encoded encrypted data
 */
export function decryptFromBase64(
	encryptedBase64: string,
	masterKey?: string
): string {
	return decrypt(Buffer.from(encryptedBase64, "base64"), masterKey);
}

/**
 * Encrypt an object as JSON
 */
export function encryptObject<T>(obj: T, masterKey?: string): string {
	const json = JSON.stringify(obj);
	return encryptToBase64(json, masterKey);
}

/**
 * Decrypt an object from encrypted JSON
 */
export function decryptObject<T>(encryptedBase64: string, masterKey?: string): T {
	const json = decryptFromBase64(encryptedBase64, masterKey);
	return JSON.parse(json) as T;
}

/**
 * Generate a per-tenant encryption key
 * Derives from master key + tenant ID using HKDF
 */
export function deriveTenantKey(
	tenantId: string,
	masterKey?: string
): string {
	const key = masterKey ?? env.ENCRYPTION_KEY;

	// Use HKDF to derive a tenant-specific key
	const info = Buffer.from(`moltbot-tenant-${tenantId}`, "utf8");
	const salt = Buffer.alloc(KEY_LENGTH, 0); // Fixed salt for determinism

	// HKDF-Extract
	const prk = crypto.createHmac("sha256", salt).update(key).digest();

	// HKDF-Expand
	const derived = crypto
		.createHmac("sha256", prk)
		.update(Buffer.concat([info, Buffer.from([1])]))
		.digest();

	return derived.toString("base64");
}

/**
 * Generate a secure random string for tokens, API keys, etc.
 */
export function generateSecureRandomString(length: number = 32): string {
	return crypto.randomBytes(length).toString("base64url");
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);

	if (bufA.length !== bufB.length) {
		return false;
	}

	return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hash data using SHA-256
 */
export function sha256(data: string): string {
	return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Hash data using SHA-512
 */
export function sha512(data: string): string {
	return crypto.createHash("sha512").update(data).digest("hex");
}
