import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";


const ALGORITHM = "aes-256-gcm";
const MASTER_KEY_FILENAME = "master.key";

function resolveMasterKeyPath(): string {
    const stateDir = resolveStateDir();
    return path.join(stateDir, MASTER_KEY_FILENAME);
}

function getMasterKey(): Buffer {
    const keyPath = resolveMasterKeyPath();
    if (fs.existsSync(keyPath)) {
        try {
            const hexKey = fs.readFileSync(keyPath, "utf8").trim();
            if (hexKey.length === 64) {
                return Buffer.from(hexKey, "hex");
            }
        } catch {
            // ignore read errors, regenerate
        }
    }

    // Generate new key
    const newKey = crypto.randomBytes(32);
    const dir = path.dirname(keyPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    fs.writeFileSync(keyPath, newKey.toString("hex"), { encoding: "utf8", mode: 0o600 });
    return newKey;
}

export function encryptData(data: unknown): string {
    const key = getMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const text = JSON.stringify(data);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    // Format: iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptData(encryptedString: string): unknown {
    try {
        const parts = encryptedString.split(":");
        if (parts.length !== 3) {
            throw new Error("Invalid encrypted format");
        }

        const [ivHex, authTagHex, encryptedHex] = parts;
        if (!ivHex || !authTagHex || !encryptedHex) {
            throw new Error("Missing encrypted components");
        }

        const key = getMasterKey();
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return JSON.parse(decrypted);
    } catch {
        // If decryption fails (e.g. wrong key, corrupted data), return null or throw
        // For this context, we'll return undefined to mimic loadJsonFile behavior on failure
        return undefined;
    }
}

export function loadEncryptedJsonFile(pathname: string): unknown {
    if (!fs.existsSync(pathname)) {
        return undefined;
    }

    try {
        const raw = fs.readFileSync(pathname, "utf8");
        // Check if it looks encrypted (contains colons and hex)
        // If it's legacy plain JSON, try parsing it directly
        if (raw.trim().startsWith("{")) {
            return JSON.parse(raw);
        }

        return decryptData(raw);
    } catch {
        return undefined;
    }
}

export function saveEncryptedJsonFile(pathname: string, data: unknown) {
    const dir = path.dirname(pathname);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    const encrypted = encryptData(data);
    fs.writeFileSync(pathname, encrypted, { encoding: "utf8", mode: 0o600 });
}
