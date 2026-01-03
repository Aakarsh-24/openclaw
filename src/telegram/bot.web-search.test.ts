import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTelegramBot } from './bot.js';
import type { Message } from 'grammy';

// Mock web search modules
vi.mock('../web-search/executor.js', () => ({
  executeWebSearch: vi.fn(),
}));

vi.mock('../web-search/detect.js', () => ({
  detectWebSearchIntent: vi.fn(),
  extractSearchQuery: vi.fn(),
}));

vi.mock('../web-search/messages.js', () => ({
  messages: {
    acknowledgment: () => '🔍 Выполняю веб-поиск...',
    resultDelivery: (result: any) => `🌐 Результат поиска:\n\n${result.response}`,
    error: (error: string) => `❌ Ошибка поиска:\n\n${error}`,
  }
}));

// Mock deep research to avoid conflicts
vi.mock('../deep-research/index.js', () => ({
  detectDeepResearchIntent: vi.fn(() => false),
  executeDeepResearch: vi.fn(),
  messages: {
    error: (msg: string) => `Deep research error: ${msg}`,
  },
  createExecuteButton: vi.fn(),
  createRetryButton: vi.fn(),
  parseCallbackData: vi.fn(),
  CALLBACK_PREFIX: 'dr_',
  CallbackActions: {},
  deliverResults: vi.fn(),
  truncateForTelegram: vi.fn((x: string) => x),
  generateGapQuestions: vi.fn(() => []),
}));

// Mock grammy
const useSpy = vi.fn();
const onSpy = vi.fn();
const stopSpy = vi.fn();
const sendChatActionSpy = vi.fn();
const sendMessageSpy = vi.fn(async () => ({ message_id: 77 }));

vi.mock('grammy', () => ({
  Bot: class {
    api = {
      config: { use: useSpy },
      sendChatAction: sendChatActionSpy,
      sendMessage: sendMessageSpy,
    };
    on = onSpy;
    stop = stopSpy;
    handleUpdate: any;
    constructor(public token: string) {
      // @ts-ignore
      this.handleUpdate = async (update: any) => {
        // Find the message handler and call it
        const messageHandler = onSpy.mock.calls.find(call => call[0] === 'message')?.[1];
        if (messageHandler) {
          const mockCtx = {
            message: update.message,
            chat: update.message.chat,
            from: update.message.from,
            me: { username: 'testbot' },
            api: this.api,
            reply: (text: string) => this.api.sendMessage(update.message.chat.id, text),
          };
          await messageHandler(mockCtx);
        }
      };
    }
  },
  InputFile: class {},
  webhookCallback: vi.fn(),
}));

const throttlerSpy = vi.fn(() => 'throttler');

vi.mock('@grammyjs/transformer-throttler', () => ({
  apiThrottler: () => throttlerSpy(),
}));

import { executeWebSearch } from '../web-search/executor.js';
import { detectWebSearchIntent, extractSearchQuery } from '../web-search/detect.js';
import { detectDeepResearchIntent } from '../deep-research/index.js';

describe('Telegram Bot - Web Search Integration', () => {
  let bot: any;
  const mockToken = 'test-token';
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(detectDeepResearchIntent).mockReturnValue(false);
    vi.mocked(detectWebSearchIntent).mockReturnValue(false);
    vi.mocked(extractSearchQuery).mockReturnValue('test query');
    vi.mocked(executeWebSearch).mockResolvedValue({
      success: true,
      result: {
        response: 'Test search result',
        session_id: 'test-123',
        stats: { models: {} }
      },
      stdout: '',
      stderr: ''
    });
    
    bot = createTelegramBot({
      token: mockToken,
      runtime: {
        log: console.log,
        error: console.error,
        exit: () => { throw new Error('exit'); }
      }
    });
  });
  
  function createMockMessage(text: string): Message.TextMessage {
    return {
      message_id: 1,
      date: Date.now(),
      chat: {
        id: 123,
        type: 'private',
      },
      from: {
        id: 456,
        is_bot: false,
        first_name: 'Test',
      },
      text: text,
    };
  }
  
  function createMessageUpdate(message: Message) {
    return {
      update_id: 1,
      message: message,
    };
  }
  
  it('triggers web search on detection', async () => {
    vi.mocked(detectWebSearchIntent).mockReturnValue(true);
    
    const message = createMockMessage('погода в Москве');
    await bot.handleUpdate(createMessageUpdate(message));
    
    // Verify detection was called
    expect(detectWebSearchIntent).toHaveBeenCalledWith('погода в Москве');
    expect(extractSearchQuery).toHaveBeenCalled();
    expect(executeWebSearch).toHaveBeenCalledWith('test query');
    
    // Verify acknowledgment was sent
    expect(bot.api.sendMessage).toHaveBeenCalledWith(
      123,
      '🔍 Выполняю веб-поиск...'
    );
    
    // Verify result was delivered
    expect(bot.api.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('🌐 Результат поиска:')
    );
  });
  
  it('does not trigger when deep research is detected', async () => {
    vi.mocked(detectDeepResearchIntent).mockReturnValue(true);
    vi.mocked(detectWebSearchIntent).mockReturnValue(true);
    
    const message = createMockMessage('тема: что такое AI');
    await bot.handleUpdate(createMessageUpdate(message));
    
    // Web search should not be called when deep research is detected
    expect(detectWebSearchIntent).not.toHaveBeenCalled();
    expect(executeWebSearch).not.toHaveBeenCalled();
  });
  
  it('handles search errors gracefully', async () => {
    vi.mocked(detectWebSearchIntent).mockReturnValue(true);
    vi.mocked(executeWebSearch).mockResolvedValue({
      success: false,
      error: 'CLI not found',
      runId: 'error-123',
      stdout: '',
      stderr: ''
    });
    
    const message = createMockMessage('тестовый запрос');
    await bot.handleUpdate(createMessageUpdate(message));
    
    expect(bot.api.sendMessage).toHaveBeenCalledWith(
      123,
      expect.stringContaining('❌ Ошибка поиска:')
    );
  });
  
  it('prevents duplicate searches for same chat', async () => {
    vi.mocked(detectWebSearchIntent).mockReturnValue(true);
    
    // Mock executeWebSearch to be slow
    let resolveSearch: (value: any) => void;
    const searchPromise = new Promise((resolve) => {
      resolveSearch = resolve;
    });
    vi.mocked(executeWebSearch).mockReturnValue(searchPromise);
    
    const message = createMockMessage('медленный запрос');
    const chatId = message.chat.id;
    
    // Start first search (don't await yet)
    const firstSearchPromise = bot.handleUpdate(createMessageUpdate(message));
    
    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Try to start second search before first completes
    await bot.handleUpdate(createMessageUpdate(message));
    
    // Second search should be blocked
    expect(bot.api.sendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('Поиск уже выполняется')
    );
    
    // Complete the first search
    resolveSearch!({
      success: true,
      result: {
        response: 'Result',
        session_id: 'test',
        stats: { models: {} }
      },
      stdout: '',
      stderr: ''
    });
    
    await firstSearchPromise;
  });
  
  it('handles missing query extraction', async () => {
    vi.mocked(detectWebSearchIntent).mockReturnValue(true);
    vi.mocked(extractSearchQuery).mockReturnValue('');
    
    const message = createMockMessage('поиск');
    await bot.handleUpdate(createMessageUpdate(message));
    
    // Should log warning and return early
    expect(executeWebSearch).not.toHaveBeenCalled();
  });
  
  it('works in group chats with mention', async () => {
    vi.mocked(detectWebSearchIntent).mockReturnValue(true);
    
    const groupMessage: Message.TextMessage = {
      message_id: 1,
      date: Date.now(),
      chat: {
        id: 789,
        type: 'group',
        title: 'Test Group',
      },
      from: {
        id: 456,
        is_bot: false,
        first_name: 'Test',
      },
      text: '@testbot погода в Москве',
    };
    
    await bot.handleUpdate(createMessageUpdate(groupMessage));
    
    expect(detectWebSearchIntent).toHaveBeenCalled();
    expect(executeWebSearch).toHaveBeenCalled();
  });
});
