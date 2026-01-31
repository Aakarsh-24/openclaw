# Troubleshooting Liam

> **For complex issues** (Telegram stalling, Discord context overflow, session accumulation, gateway instability): See the comprehensive guide at [`diagnostics/SYSTEMS-DIAGNOSTIC-GUIDE.md`](./diagnostics/SYSTEMS-DIAGNOSTIC-GUIDE.md)

---

## Liam Not Responding

1. Check gateway status:
   ```bash
   cd "/home/liam/clawdbot"
   pnpm run clawdbot gateway status
   ```

2. Restart gateway:
   ```bash
   pnpm run clawdbot gateway stop
   pnpm run clawdbot gateway start
   ```

3. Check logs:
   ```bash
   pnpm run clawdbot logs --limit 50
   ```

## Liam Doesn't Know His Name / Has Amnesia

**Symptom:** Liam says "I don't have my own name" or "IDENTITY.md is blank"

**Cause:** The `agents.defaults.workspace` is pointing to the wrong location (`~/.clawdbot/workspace` instead of `~/clawd`)

**Diagnosis:**
```bash
jq '.agents.defaults.workspace' ~/.clawdbot/clawdbot.json
```

If it shows `~/.clawdbot/workspace` or anything other than `/home/liam/clawd`, that's the problem.

**Fix:**
```bash
cd "/home/liam/clawdbot"
pnpm run clawdbot config set agents.defaults.workspace '"/home/liam/clawd"'
pkill -9 -f clawdbot-gateway || true
pnpm run clawdbot gateway start
```

**Prevention:** Run `~/clawd/health-check.sh` - it now checks for this.

---

## Liam Confused About Email

**Two accounts, two purposes:**
- `clawdbot@puenteworks.com` = YOUR email (send FROM here, calendar)
- `simon@puenteworks.com` = SIMON's email (manage inbox: read, archive, label, organize)

**Quick check:**
- Sending email? → `--account clawdbot@puenteworks.com`
- Managing Simon's inbox? → `--account simon@puenteworks.com`
- Creating labels on Simon's inbox? → `--account simon@puenteworks.com` (allowed!)
- Confused? → Re-read JOB.md "GOG Accounts" section

**The ONLY restriction on simon@:** Don't send emails from it. All outbound = clawdbot@.

**If session is polluted, fix:**
```bash
~/clawd/restore-liam.sh
```

This clears sessions and resets configs.

## Liam Trying to Modify Protected Files

Protected files are locked with `chmod 444`. If Liam somehow modifies them:

1. Check permissions:
   ```bash
   ls -la ~/clawd/SOUL.md
   ```

2. Re-lock if needed:
   ```bash
   chmod 444 ~/clawd/SOUL.md ~/clawd/IDENTITY.md ~/clawd/STATUS.md ~/clawd/AGENTS.md
   ```

3. Restore from git:
   ```bash
   cd ~/clawd && git checkout -- SOUL.md IDENTITY.md STATUS.md AGENTS.md
   ```

## Gateway Won't Start

1. Check if port is in use:
   ```bash
   lsof -i :18789
   ```

2. Kill conflicting process:
   ```bash
   kill -9 PID
   ```

3. Retry start

## Cron Jobs Not Running

1. Check cron status:
   ```bash
   cd "/home/liam/clawdbot"
   pnpm run clawdbot cron list
   ```

2. Verify jobs.json:
   ```bash
   cat ~/.clawdbot/cron/jobs.json | jq '.jobs[].name'
   ```

## Full Reset

If nothing else works:

```bash
~/clawd/restore-liam.sh
```

This will:
- Stop the gateway
- Clear all sessions
- Restore config files
- Restart with clean state

## Check System Health

Run the health check script:
```bash
~/clawd/health-check.sh
```

## Contact

For complex issues, work with Claude in Cursor to diagnose and fix.
