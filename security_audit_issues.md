# 🛡️ OpenClaw Security Audit - Verified GitHub Issues

> **Note to Maintainer:** These issues were generated as part of a comprehensive security audit (Jan 2026).  
> **Status:** All findings below have been verified against the codebase.

---

## 🔴 Security Finding: Critical Supply Chain Vulnerability in `form-data` (RCE Risk)

### Severity: CRITICAL
**CVSS Score:** 9.8 (Critical)

### Affected Component
- **Dependency:** `form-data` (< 2.5.4)
- **Path:** `extensions/matrix` -> `@vector-im/matrix-bot-sdk` -> `request` -> `form-data`
- **File:** `package.json` / `pnpm-lock.yaml`

### Description
The `form-data` package (versions prior to 2.5.4) uses `Math.random()` to generate multipart boundaries. This allows an attacker to predict the boundary and inject arbitrary data into the request body by controlling a part of the form data. This is introduced via the deprecated `request` library used by the Matrix extension.

### Proof of Concept
The vulnerability is present in the dependency tree. Run `pnpm audit` to verify:

```bash
# Output from pnpm audit
Path: extensions__matrix>@vector-im/matrix-bot-sdk>request>form-data
Severity: critical
Vulnerable versions: <2.5.4
Advisory: GHSA-fjxv-7rqg-78g4
```

### Why This Is a Security Risk
- **Attack Vector:** Remote (Network)
- **Impact:** Server-Side Request Forgery (SSRF) or internal data manipulation. If an attacker can influence the content of a multipart request (e.g., via a compromised Matrix bridge), they can alter the structure of the HTTP request sent by the bot.

### Suggested Fix
Since `matrix-bot-sdk` relies on the deprecated `request` package, you must force a resolution to a safe version of `form-data` in your top-level `package.json`.

**Modify `package.json`:**

```json
{
  "pnpm": {
    "overrides": {
      "form-data": ">=4.0.0",
      "request": "$request" 
    }
  }
}
```
*Note: If `request` breaks with newer `form-data`, consider replacing `matrix-bot-sdk` or finding a fork.*

---

## 🟠 Security Finding: Insecure Credential Storage (Plain Text)

### Severity: HIGH

### Affected Component
- **File:** `src/infra/json-file.ts` (lines 16-27)
- **File:** `src/agents/auth-profiles/store.ts`
- **Function:** `saveJsonFile`

### Description
The application stores sensitive authentication profiles (API Keys, OAuth Tokens) in plain text JSON files on the disk. While `fs.chmodSync(pathname, 0o600)` is attempted, it offers no protection against malware running under the same user account, nor does it work effectively on standard Windows filesystems.

### Proof of Concept
```typescript
// src/infra/json-file.ts
export function saveJsonFile(pathname: string, data: unknown) {
  // ...
  // VULNERABILITY: Data is stringified and written directly without encryption
  fs.writeFileSync(pathname, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  // ...
}
```

### Why This Is a Security Risk
- **Confidentiality Loss:** Any malicious process running as the user or any local file inclusion (LFI) vulnerability could read all API keys and tokens.
- **Compliance:** Violates best practices for credential management.

### Suggested Fix
Implement a transparent encryption layer for sensitive stores using `node:crypto`.

```typescript
// Proposed secure-json-file.ts
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
// In detailed fix: Derive key from machine-id or user-provided master password

function encrypt(text: string, key: Buffer) {
  // implementation using crypto.createCipheriv
}

export function saveEncryptedJsonFile(pathname: string, data: unknown, key: Buffer) {
  const encrypted = encrypt(JSON.stringify(data), key);
  fs.writeFileSync(pathname, encrypted);
}
```

---

## 🟠 Security Finding: Missing HTTP Security Headers

### Severity: HIGH

### Affected Component
- **File:** `src/gateway/server-http.ts`
- **Function:** `createGatewayHttpServer` / `handleRequest`

### Description
The Gateway HTTP server is built using raw `node:http` (`createHttpServer`). It manually routes requests but fails to set standard HTTP security headers that protect against common web attacks.

**Missing Headers:**
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

### Proof of Concept
Inspect `src/gateway/server-http.ts`. No header setting logic exists in the `handleRequest` function.

```typescript
// src/gateway/server-http.ts
async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // ... (routing logic)
  
  // No security headers are set here
  
  if (await handleHooksRequest(req, res)) { return; }
  // ...
}
```

### Why This Is a Security Risk
- **MIME Sniffing:** Without `X-Content-Type-Options: nosniff`, browsers may execute uploaded non-script files as scripts (e.g., an image that contains JS).
- **Clickjacking:** Without frame protection, the control UI could be embedded in a malicious site.

### Suggested Fix
Create a utility to apply headers for every response, similar to the `helmet` middleware in Express.

```typescript
function applySecurityHeaders(res: ServerResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'self'");
  // ...
}

// Apply in handleRequest
async function handleRequest(req, res) {
  applySecurityHeaders(res);
  // ...
}
```

---

## 🟡 Security Finding: Arbitrary Code Execution via Dynamic Plugin Imports

### Severity: MEDIUM

### Affected Component
- **File:** `src/gateway/hooks-mapping.ts` (lines 316-326)
- **Function:** `loadTransform`

### Description
The webhook transformation system allows loading JavaScript modules dynamically based on a path defined in the configuration. While the path is resolved relative to a config directory, there is no strict allowlist or sandboxing. If an attacker can modify the configuration (e.g., via a separate config-injection vulnerability) or place a file in the config directory, they can execute arbitrary code within the main process.

### Proof of Concept
```typescript
// src/gateway/hooks-mapping.ts
async function loadTransform(transform: HookMappingTransformResolved): Promise<HookTransformFn> {
  // ...
  const url = pathToFileURL(transform.modulePath).href;
  const mod = (await import(url)) as Record<string, unknown>; // DANGEROUS IMPORT
  // ...
}
```

### Why This Is a Security Risk
- **Impact:** Remote Code Execution (RCE) if filesystem/config write access is gained.
- **Persistence:** Can be used as a persistence mechanism by an attacker who has already gained partial access.

### Suggested Fix
- **Restrict extensions:** Only allow loading `.js` files from a specific, read-only `plugins` directory.
- **Sanitization:** Ensure `transform.modulePath` does not traverse outside the allowed directory (`..` checks).
