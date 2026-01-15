import { describe, expect, it, vi } from 'vitest';
import { setupInternalHooks } from './onboard-hooks.js';
import type { ClawdbotConfig } from '../config/config.js';
import type { RuntimeEnv } from '../runtime.js';
import type { WizardPrompter } from '../wizard/prompts.js';

describe('onboard-hooks', () => {
  const createMockPrompter = (confirmValue: boolean): WizardPrompter => ({
    confirm: vi.fn().mockResolvedValue(confirmValue),
    note: vi.fn().mockResolvedValue(undefined),
    intro: vi.fn().mockResolvedValue(undefined),
    outro: vi.fn().mockResolvedValue(undefined),
    text: vi.fn().mockResolvedValue(''),
    select: vi.fn().mockResolvedValue(''),
    multiselect: vi.fn().mockResolvedValue([]),
    progress: vi.fn().mockReturnValue({
      stop: vi.fn(),
      update: vi.fn(),
    }),
  });

  const createMockRuntime = (): RuntimeEnv => ({
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  });

  describe('setupInternalHooks', () => {
    it('should enable internal hooks when user confirms', async () => {
      const cfg: ClawdbotConfig = {};
      const prompter = createMockPrompter(true);
      const runtime = createMockRuntime();

      const result = await setupInternalHooks(cfg, runtime, prompter);

      expect(result.hooks?.internal?.enabled).toBe(true);
      expect(result.hooks?.internal?.handlers).toHaveLength(1);
      expect(result.hooks?.internal?.handlers?.[0]).toEqual({
        event: 'command:new',
        module: './hooks/handlers/session-memory.ts',
      });
      expect(prompter.note).toHaveBeenCalledTimes(2);
      expect(prompter.confirm).toHaveBeenCalledWith({
        message: 'Enable session memory hook? (saves context on /new)',
        initialValue: true,
      });
    });

    it('should not enable hooks when user declines', async () => {
      const cfg: ClawdbotConfig = {};
      const prompter = createMockPrompter(false);
      const runtime = createMockRuntime();

      const result = await setupInternalHooks(cfg, runtime, prompter);

      expect(result.hooks?.internal).toBeUndefined();
      expect(prompter.note).toHaveBeenCalledTimes(1);
      expect(prompter.confirm).toHaveBeenCalledWith({
        message: 'Enable session memory hook? (saves context on /new)',
        initialValue: true,
      });
    });

    it('should preserve existing hooks config when enabled', async () => {
      const cfg: ClawdbotConfig = {
        hooks: {
          enabled: true,
          path: '/webhook',
          token: 'existing-token',
        },
      };
      const prompter = createMockPrompter(true);
      const runtime = createMockRuntime();

      const result = await setupInternalHooks(cfg, runtime, prompter);

      expect(result.hooks?.enabled).toBe(true);
      expect(result.hooks?.path).toBe('/webhook');
      expect(result.hooks?.token).toBe('existing-token');
      expect(result.hooks?.internal?.enabled).toBe(true);
    });

    it('should preserve existing config when not enabled', async () => {
      const cfg: ClawdbotConfig = {
        agents: { defaults: { workspace: '/workspace' } },
      };
      const prompter = createMockPrompter(false);
      const runtime = createMockRuntime();

      const result = await setupInternalHooks(cfg, runtime, prompter);

      expect(result).toEqual(cfg);
      expect(result.agents?.defaults?.workspace).toBe('/workspace');
    });

    it('should show informative notes to user', async () => {
      const cfg: ClawdbotConfig = {};
      const prompter = createMockPrompter(true);
      const runtime = createMockRuntime();

      await setupInternalHooks(cfg, runtime, prompter);

      const noteCalls = (prompter.note as ReturnType<typeof vi.fn>).mock.calls;
      expect(noteCalls).toHaveLength(2);

      // First note should explain what internal hooks are
      expect(noteCalls[0][0]).toContain('Internal hooks');
      expect(noteCalls[0][0]).toContain('automate actions');

      // Second note should confirm configuration
      expect(noteCalls[1][0]).toContain('Session memory hook enabled');
      expect(noteCalls[1][0]).toContain('~/.clawdbot/memory/sessions');
    });
  });
});
