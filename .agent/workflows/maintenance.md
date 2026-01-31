---
description: Maintain and update repository dependencies securely
---

# Maintenance and Updates

Standard procedure for keeping the repository secure and up-to-date.

## 1. Check for Outdated Packages
Run the following check weekly:

```bash
pnpm outdated
```

## 2. Update Safe Packages (Minor/Patch)
Update standard dependencies:

```bash
pnpm update
```

## 3. Verify Security (Audit)
Run a security audit after updates to ensure no new vulnerabilities were introduced or unpatched.

```bash
pnpm audit --prod
```

## 4. Fix Vulnerabilities (Overrides)
If `pnpm audit` reports high/critical issues that `pnpm update` cannot fix (due to nested dependencies), add an override in `package.json`.

Example `package.json`:
```json
"pnpm": {
  "overrides": {
    "vulnerable-package": ">=1.2.3"
  }
}
```

Then run `pnpm install` to apply.

## 5. Validate Build & Tests
Always verify that updates didn't break the system.

```bash
# Lint checks
pnpm lint

# Run tests
pnpm test
```
