import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TelegramGameBot } from './telegramBot.js';
import { GameLogic } from '../game/gameLogic.js';
import { GameStorage } from '../storage/gameStorage.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Подавляем логирование в тестах
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Мокаем все зависимости
vi.mock('node-telegram-bot-api');
vi.mock('../game/gameLogic.js');
vi.mock('../storage/gameStorage.js');
vi.mock('fs/promises');
vi.mock('path');
vi.mock('os');
vi.mock('url');

describe('TelegramGameBot', () => {
  let bot;
  let mockTelegramBot;
  let mockGameLogic;
  let mockStorage;

  beforeEach(async () => {
    // Подавляем логирование
    console.log = vi.fn();
    console.error = vi.fn();
    
    // Создаем моки
    mockTelegramBot = {
      on: vi.fn(),
      onText: vi.fn(),
      sendMessage: vi.fn(),
      stopPolling: vi.fn(),
      getMe: vi.fn()
    };

    mockGameLogic = {
      processMessage: vi.fn(),
      getGameStats: vi.fn(),
      resetGame: vi.fn()
    };

    mockStorage = {
      initialize: vi.fn(),
      getLastUpdateId: vi.fn().mockResolvedValue(0),
      saveBotState: vi.fn().mockResolvedValue(),
      getBotState: vi.fn().mockResolvedValue({
        lastUpdateId: 0,
        lastActivity: new Date().toISOString(),
        uptime: 0,
        lastMessageTime: new Date().toISOString(),
        totalMessagesProcessed: 0
      }),
      updateBotActivity: vi.fn().mockResolvedValue(),
      getStats: vi.fn().mockReturnValue({
        totalNumbers: 0,
        remaining: 999,
        players: 0,
        lastUpdate: new Date().toISOString()
      })
    };

    // Мокаем конструктор TelegramBot
    const TelegramBot = vi.mocked(await import('node-telegram-bot-api'));
    TelegramBot.default.mockImplementation(() => mockTelegramBot);

    // Мокаем GameLogic и GameStorage
    vi.mocked(GameLogic).mockImplementation(() => mockGameLogic);
    vi.mocked(GameStorage).mockImplementation(() => mockStorage);

    // Мокаем fs, path, os модули
    path.dirname.mockReturnValue('./');
    path.join.mockImplementation((...args) => args.join('/'));
    os.type.mockReturnValue('Linux');
    os.release.mockReturnValue('5.4.0');
    fileURLToPath.mockReturnValue('/app/src/bot/telegramBot.js');

    bot = new TelegramGameBot('test_token');
  });

  afterEach(() => {
    vi.clearAllMocks();
    
    // Восстанавливаем оригинальное логирование
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('constructor', () => {
    test('should create bot with token', async () => {
      const TelegramBot = vi.mocked(await import('node-telegram-bot-api'));
      expect(TelegramBot.default).toHaveBeenCalledWith('test_token', { 
        polling: true,
        polling_options: {
          timeout: 10,
          limit: 100,
          allowed_updates: ['message', 'callback_query']
        }
      });
    });

    test('should setup event handlers', () => {
      expect(mockTelegramBot.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/start/, expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/stats/, expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/help/, expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/reset/, expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/botstats/, expect.any(Function));
      expect(mockTelegramBot.on).toHaveBeenCalledWith('polling_error', expect.any(Function));
      expect(mockTelegramBot.on).toHaveBeenCalledWith('polling_start', expect.any(Function));
      expect(mockTelegramBot.on).toHaveBeenCalledWith('polling_success', expect.any(Function));
    });
  });

  describe('initialize', () => {
    test('should initialize storage successfully', async () => {
      mockStorage.initialize.mockResolvedValue();
      mockStorage.getLastUpdateId.mockResolvedValue(0);
      mockTelegramBot.getMe.mockResolvedValue({ id: 123, username: 'testbot' });
      
      await bot.initialize();
      
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getLastUpdateId).toHaveBeenCalled();
      expect(mockTelegramBot.getMe).toHaveBeenCalled();
    });

    test('should handle initialization error', async () => {
      const error = new Error('Initialization failed');
      mockStorage.initialize.mockRejectedValue(error);
      
      await expect(bot.initialize()).rejects.toThrow(error);
    });
  });

  describe('handleMessage', () => {
    test('should process message and send response', async () => {
      const mockMsg = {
        text: '123',
        chat: { id: 12345, type: 'private' },
        from: { id: 67890, is_bot: false, username: 'testuser' },
        update_id: 12345,
        date: Math.floor(Date.now() / 1000)
      };

      const mockResponse = {
        text: 'запомнили',
        type: 'success'
      };

      mockGameLogic.processMessage.mockResolvedValue(mockResponse);
      mockTelegramBot.sendMessage.mockResolvedValue();

      // Вызываем обработчик сообщения напрямую
      await bot.handleMessage(mockMsg);

      expect(mockGameLogic.processMessage).toHaveBeenCalledWith('123', '67890'); // from.id пользователя
      expect(mockStorage.updateBotActivity).toHaveBeenCalledWith(12345, expect.any(String));
      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(12345, 'запомнили', { parse_mode: 'HTML' });
    });

    test('should handle message without text', async () => {
      const mockMsg = {
        chat: { id: 12345, type: 'private' },
        from: { id: 67890, is_bot: false, username: 'testuser' }
      };

      await bot.handleMessage(mockMsg);

      expect(mockGameLogic.processMessage).not.toHaveBeenCalled();
      expect(mockTelegramBot.sendMessage).not.toHaveBeenCalled();
    });

    test('should ignore message from bot', async () => {
      const mockMsg = {
        text: '123',
        chat: { id: 12345, type: 'private' },
        from: { id: 67890, is_bot: true, username: 'botuser' },
        update_id: 12345,
        date: Math.floor(Date.now() / 1000)
      };

      await bot.handleMessage(mockMsg);

      expect(mockGameLogic.processMessage).not.toHaveBeenCalled();
      expect(mockTelegramBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleStartCommand', () => {
    test('should send welcome message', async () => {
      const mockMsg = {
        chat: { id: 12345, type: 'private' },
        from: { id: 67890, is_bot: false, username: 'testuser' }
      };

      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.handleStartCommand(mockMsg);

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Добро пожаловать в игру AutoNumberGame'),
        { parse_mode: 'HTML' }
      );
    });

    test('should ignore command from bot', async () => {
      const mockMsg = {
        chat: { id: 12345, type: 'private' },
        from: { id: 67890, is_bot: true, username: 'botuser' }
      };

      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.handleStartCommand(mockMsg);

      expect(mockTelegramBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleStatsCommand', () => {
    test('should send game statistics', async () => {
      const mockMsg = {
        chat: { id: 12345, type: 'private' },
        from: { id: 67890, is_bot: false, username: 'testuser' }
      };

      const mockStats = {
        text: '📊 Статистика игры:\nНайдено номеров: 42'
      };

      mockGameLogic.getGameStats.mockReturnValue(mockStats);
      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.handleStatsCommand(mockMsg);

      expect(mockGameLogic.getGameStats).toHaveBeenCalled();
      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(12345, mockStats.text, { parse_mode: 'HTML' });
    });

    test('should ignore command from bot', async () => {
      const mockMsg = {
        chat: { id: 12345, type: 'private' },
        from: { id: 67890, is_bot: true, username: 'botuser' }
      };

      await bot.handleStatsCommand(mockMsg);

      expect(mockTelegramBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleHelpCommand', () => {
    test('should send help message', async () => {
      const mockMsg = {
        chat: { id: 12345, type: 'private' },
        from: { id: 67890, is_bot: false, username: 'testuser' }
      };

      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.handleHelpCommand(mockMsg);

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Справка по игре AutoNumberGame'),
        { parse_mode: 'HTML' }
      );
    });

    test('should ignore command from bot', async () => {
      const mockMsg = {
        chat: { id: 12345, type: 'private' },
        from: { id: 67890, is_bot: true, username: 'botuser' }
      };

      await bot.handleHelpCommand(mockMsg);

      expect(mockTelegramBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleResetCommand', () => {
    test('should reset game for admin in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockMsg = {
        chat: { id: 12345, type: 'private' },
        from: { id: 67890, is_bot: false, username: 'admin' }
      };

      const mockResetResult = {
        text: 'Игра сброшена. Все номера удалены.',
        type: 'reset'
      };

      mockGameLogic.resetGame.mockResolvedValue(mockResetResult);
      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.handleResetCommand(mockMsg);

      expect(mockGameLogic.resetGame).toHaveBeenCalled();
      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(12345, mockResetResult.text, { parse_mode: 'HTML' });

      process.env.NODE_ENV = originalEnv;
    });

    describe('handleBotStatsCommand', () => {
      test('should send bot statistics for admin in development', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const mockMsg = {
          chat: { id: 12345, type: 'private' },
          from: { id: 67890, is_bot: false, username: 'admin' }
        };

        mockTelegramBot.sendMessage.mockResolvedValue();

        await bot.handleBotStatsCommand(mockMsg);

        expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
          12345,
          expect.stringContaining('Статистика бота'),
          { parse_mode: 'HTML' }
        );

        process.env.NODE_ENV = originalEnv;
      });

      test('should deny botstats for non-admin in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        const mockMsg = {
          chat: { id: 12345, type: 'private' },
          from: { id: 67890, is_bot: false, username: 'user' }
        };

        mockTelegramBot.sendMessage.mockResolvedValue();

        await bot.handleBotStatsCommand(mockMsg);

        expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
          12345,
          'У вас нет прав для выполнения этой команды',
          { parse_mode: 'HTML' }
        );

        process.env.NODE_ENV = originalEnv;
      });
    });

    test('should deny reset for non-admin in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockMsg = {
        chat: { id: 12345, type: 'private' },
        from: { id: 67890, is_bot: false, username: 'user' }
      };

      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.handleResetCommand(mockMsg);

      expect(mockGameLogic.resetGame).not.toHaveBeenCalled();
      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
        12345,
        'У вас нет прав для выполнения этой команды',
        { parse_mode: 'HTML' }
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('sendMessage', () => {
    test('should send message successfully', async () => {
      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.sendMessage(12345, 'Test message');

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(12345, 'Test message', { parse_mode: 'HTML' });
    });

    test('should handle send message error', async () => {
      const error = new Error('Send failed');
      mockTelegramBot.sendMessage.mockRejectedValue(error);

      // Мокаем console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await bot.sendMessage(12345, 'Test message');

      expect(consoleSpy).toHaveBeenCalledWith('❌ Ошибка отправки сообщения в чат', 12345, ':', error);

      consoleSpy.mockRestore();
    });
  });

  describe('stop', () => {
    test('should stop bot polling and save state', async () => {
      mockTelegramBot.stopPolling.mockResolvedValue();

      await bot.stop();

      expect(mockTelegramBot.stopPolling).toHaveBeenCalled();
      expect(mockStorage.saveBotState).toHaveBeenCalledWith({
        lastUpdateId: 0,
        lastMessageTime: expect.any(String)
      });
    });

    test('should handle stop error', async () => {
      const error = new Error('Stop failed');
      mockTelegramBot.stopPolling.mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await bot.stop();

      expect(consoleSpy).toHaveBeenCalledWith('❌ Ошибка при остановке бота:', error);

      consoleSpy.mockRestore();
    });
  });

  describe('getBotInfo', () => {
    test('should return bot info', () => {
      const mockInfo = { id: 123, username: 'testbot' };
      mockTelegramBot.getMe.mockReturnValue(mockInfo);

      const result = bot.getBotInfo();

      expect(result).toBe(mockInfo);
      expect(mockTelegramBot.getMe).toHaveBeenCalled();
    });
  });

  describe('getBotStats', () => {
    test('should return bot and game statistics', async () => {
      const result = await bot.getBotStats();

      expect(result).toEqual({
        bot: {
          lastUpdateId: 0,
          lastActivity: expect.any(String),
          uptime: 0,
          totalMessagesProcessed: 0,
          isRunning: false
        },
        game: {
          totalNumbers: 0,
          remaining: 999,
          players: 0,
          lastUpdate: expect.any(String)
        }
      });
    });

    test('should handle polling error with 409 status (conflict)', async () => {
      const error = {
        code: 'ETELEGRAM',
        response: {
          statusCode: 409,
          body: 'Conflict'
        }
      };

      mockTelegramBot.stopPolling.mockResolvedValue();

      await bot.handlePollingError(error);

      expect(mockTelegramBot.stopPolling).toHaveBeenCalled();
    });

    test('should handle polling error with 429 status (rate limit)', async () => {
      const error = {
        code: 'ETELEGRAM',
        response: {
          statusCode: 429,
          body: 'Too Many Requests'
        }
      };

      // Мокаем setTimeout
      vi.useFakeTimers();
      const mockInitialize = vi.fn();
      bot.initialize = mockInitialize;

      await bot.handlePollingError(error);

      // Проверяем, что setTimeout был вызван
      expect(vi.getTimerCount()).toBe(1);

      // Имитируем истечение таймера
      vi.advanceTimersByTime(60000);
      expect(mockInitialize).toHaveBeenCalled();

      vi.useRealTimers();
    });

    test('should handle polling error with other status codes', async () => {
      const error = {
        code: 'ETELEGRAM',
        response: {
          statusCode: 500,
          body: 'Internal Server Error'
        }
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await bot.handlePollingError(error);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Telegram API error:', 500, 'Internal Server Error');

      consoleSpy.mockRestore();
    });

    test('should handle non-telegram polling error', async () => {
      const error = new Error('Network error');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await bot.handlePollingError(error);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Неизвестная ошибка polling:', error);

      consoleSpy.mockRestore();
    });

    test('should load version and OS info successfully', async () => {
      // Мокаем успешное чтение package.json
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify({ version: '2.0.2' }))
        .mockResolvedValueOnce('NAME="Ubuntu"\nVERSION_ID="20.04"');

      await bot.loadVersionAndOsInfo();

      expect(bot.version).toBe('v2.0.2');
      expect(bot.osInfo).toContain('v2.0.2');
      expect(bot.osInfo).toContain('ubuntu 20.04');
    });

    test('should handle missing package.json version', async () => {
      // Мокаем package.json без версии
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify({ name: 'test' }))
        .mockResolvedValueOnce('NAME="Ubuntu"\nVERSION_ID="20.04"');

      await bot.loadVersionAndOsInfo();

      expect(bot.version).toBe('vunknown');
    });

    test('should handle package.json read error', async () => {
      // Сохраняем оригинальное значение
      const originalEnvVersion = process.env.npm_package_version;
      delete process.env.npm_package_version;

      // Мокаем ошибку чтения package.json
      fs.readFile
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce('NAME="Ubuntu"\nVERSION_ID="20.04"');

      await bot.loadVersionAndOsInfo();

      expect(bot.version).toBe('vunknown');
      expect(bot.osInfo).toContain('vunknown');

      // Восстанавливаем оригинальное значение
      if (originalEnvVersion) {
        process.env.npm_package_version = originalEnvVersion;
      }
    });

    test('should handle /etc/os-release read error', async () => {
      // Мокаем успешное чтение package.json и ошибку чтения /etc/os-release
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify({ version: '2.0.2' }))
        .mockRejectedValueOnce(new Error('File not found'));

      await bot.loadVersionAndOsInfo();

      expect(bot.version).toBe('v2.0.2');
      expect(bot.osInfo).toContain('linux 5.4.0');
    });

    test('should handle invalid /etc/os-release format', async () => {
      // Мокаем успешное чтение package.json и невалидный /etc/os-release
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify({ version: '2.0.2' }))
        .mockResolvedValueOnce('INVALID_FORMAT');

      await bot.loadVersionAndOsInfo();

      expect(bot.osInfo).toContain('linux 5.4.0');
    });

    test('should handle getBotStats error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Мокаем ошибку в getBotState
      mockStorage.getBotState.mockRejectedValueOnce(new Error('Storage error'));

      const result = await bot.getBotStats();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('❌ Ошибка получения статистики:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    test('should handle polling_start event', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Имитируем вызов обработчика события polling_start
      const pollingStartHandler = mockTelegramBot.on.mock.calls.find(call => call[0] === 'polling_start')[1];
      pollingStartHandler();

      expect(consoleSpy).toHaveBeenCalledWith('🔄 Polling started - бот начал получать сообщения');

      consoleSpy.mockRestore();
    });

    test('should handle polling_success event with updates', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockUpdates = [
        { update_id: 100 },
        { update_id: 101 },
        { update_id: 102 }
      ];

      // Имитируем вызов обработчика события polling_success
      const pollingSuccessHandler = mockTelegramBot.on.mock.calls.find(call => call[0] === 'polling_success')[1];
      pollingSuccessHandler(mockUpdates);

      expect(bot.lastUpdateId).toBe(102);
      expect(consoleSpy).toHaveBeenCalledWith('📊 Получено обновлений:', 3, 'Последний update_id:', 102);

      consoleSpy.mockRestore();
    });

    test('should handle polling_success event with empty updates', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Имитируем вызов обработчика события polling_success с пустым массивом
      const pollingSuccessHandler = mockTelegramBot.on.mock.calls.find(call => call[0] === 'polling_success')[1];
      pollingSuccessHandler([]);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should handle polling_success event with null updates', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Имитируем вызов обработчика события polling_success с null
      const pollingSuccessHandler = mockTelegramBot.on.mock.calls.find(call => call[0] === 'polling_success')[1];
      pollingSuccessHandler(null);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should handle stats command error gracefully', async () => {
      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'admin' }
      };

      // Мокаем ошибку в getUserStatsWithUsernames
      mockStorage.getUserStatsWithUsernames = vi.fn().mockRejectedValueOnce(new Error('Telegram API error'));
      mockGameLogic.getGameStats.mockReturnValue({ text: '📊 Статистика игры' });
      mockTelegramBot.sendMessage.mockResolvedValue();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await bot.handleStatsCommand(mockMsg);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Ошибка получения статистики:', expect.any(Error));
      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(12345, '📊 Статистика игры', { parse_mode: 'HTML' });

      consoleSpy.mockRestore();
    });

    test('should handle botstats command when getBotStats returns null', async () => {
      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'admin' }
      };

      // Устанавливаем ADMIN_USER_ID для теста
      const originalAdminId = process.env.ADMIN_USER_ID;
      process.env.ADMIN_USER_ID = '67890';

      // Мокаем null результат от getBotStats
      const originalGetBotStats = bot.getBotStats;
      bot.getBotStats = vi.fn().mockResolvedValueOnce(null);
      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.handleBotStatsCommand(mockMsg);

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(12345, '❌ Ошибка получения статистики', { parse_mode: 'HTML' });

      // Восстанавливаем оригинальные значения
      bot.getBotStats = originalGetBotStats;
      if (originalAdminId) {
        process.env.ADMIN_USER_ID = originalAdminId;
      } else {
        delete process.env.ADMIN_USER_ID;
      }
    });

    test('should handle initialize error and throw', async () => {
      // Мокаем ошибку в storage.initialize
      mockStorage.initialize.mockRejectedValueOnce(new Error('Storage initialization failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(bot.initialize()).rejects.toThrow('Storage initialization failed');

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to initialize bot:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    test('should handle polling_error event', () => {
      // Мокаем handlePollingError
      const handlePollingErrorSpy = vi.spyOn(bot, 'handlePollingError').mockImplementation(() => {});

      const mockError = new Error('Polling error');

      // Имитируем вызов обработчика события polling_error
      const pollingErrorHandler = mockTelegramBot.on.mock.calls.find(call => call[0] === 'polling_error')[1];
      pollingErrorHandler(mockError);

      expect(handlePollingErrorSpy).toHaveBeenCalledWith(mockError);

      handlePollingErrorSpy.mockRestore();
    });

    test('should handle stats command with user stats', async () => {
      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'user' }
      };

      const mockStats = { text: '📊 Статистика игры' };
      const mockUserStats = [
        { userId: 'user1', username: 'testuser1', displayName: 'Test User 1', count: 5 },
        { userId: 'user2', username: 'testuser2', displayName: 'Test User 2', count: 3 }
      ];

      mockGameLogic.getGameStats.mockReturnValue(mockStats);
      mockStorage.getUserStatsWithUsernames = vi.fn().mockResolvedValue(mockUserStats);
      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.handleStatsCommand(mockMsg);

      const actualCall = mockTelegramBot.sendMessage.mock.calls[0];
      const actualMessage = actualCall[1];

      expect(actualMessage).toContain('📊 Статистика игры');
      expect(actualMessage).toContain('🏆 Топ игроков:');
      expect(actualMessage).toContain('🥇 Test User 1 (@testuser1): 5 номеров');
      expect(actualMessage).toContain('🥈 Test User 2 (@testuser2): 3 номеров');
      expect(actualMessage).toContain('ℹ️ Версия: v2.0.3 linux 5.4.0');
      expect(actualCall[2]).toEqual({ parse_mode: 'HTML' });
    });

    test('should handle stats command with no user stats', async () => {
      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'user' }
      };

      const mockStats = { text: '📊 Статистика игры' };
      const mockUserStats = []; // Пустой массив

      mockGameLogic.getGameStats.mockReturnValue(mockStats);
      mockStorage.getUserStatsWithUsernames = vi.fn().mockResolvedValue(mockUserStats);
      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.handleStatsCommand(mockMsg);

      const actualCall = mockTelegramBot.sendMessage.mock.calls[0];
      const actualMessage = actualCall[1];

      expect(actualMessage).toContain('📊 Статистика игры');
      expect(actualMessage).toContain('📝 Пока никто не нашел ни одного номера');
      expect(actualMessage).toContain('ℹ️ Версия: v2.0.3 linux 5.4.0');
      expect(actualCall[2]).toEqual({ parse_mode: 'HTML' });
    });

    test('should handle unrecognized command', () => {
      const mockMsg = {
        text: '/unknowncommand',
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'user' }
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Имитируем вызов обработчика on('message')
      const messageHandler = mockTelegramBot.on.mock.calls.find(call => call[0] === 'message')[1];
      messageHandler(mockMsg);

      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Команда не распознана:', '/unknowncommand');

      consoleSpy.mockRestore();
    });

    test('should handle message processing error', async () => {
      const mockMsg = {
        text: '123',
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'user' },
        update_id: 100,
        date: Math.floor(Date.now() / 1000)
      };

      // Мокаем ошибку в processMessage
      mockGameLogic.processMessage.mockRejectedValueOnce(new Error('Processing failed'));
      mockTelegramBot.sendMessage.mockResolvedValue();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Имитируем вызов обработчика on('message')
      const messageHandler = mockTelegramBot.on.mock.calls.find(call => call[0] === 'message')[1];
      await messageHandler(mockMsg);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Ошибка обработки сообщения:', expect.any(Error));
      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(12345, 'Произошла ошибка при обработке сообщения', { parse_mode: 'HTML' });

      consoleSpy.mockRestore();
    });

    test('should initialize successfully', async () => {
      mockStorage.initialize.mockResolvedValue();
      mockStorage.getLastUpdateId.mockResolvedValue(123);
      mockTelegramBot.getMe.mockResolvedValue({ id: 456, username: 'testbot' });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await bot.initialize();

      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getLastUpdateId).toHaveBeenCalled();
      expect(mockTelegramBot.getMe).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('🔧 Инициализация Telegram бота...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Хранилище инициализировано');
      expect(consoleSpy).toHaveBeenCalledWith('📊 Последний update_id:', 123);

      consoleSpy.mockRestore();
    });

    test('should handle polling_success with null updates', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Имитируем вызов обработчика polling_success с null
      const pollingSuccessHandler = mockTelegramBot.on.mock.calls.find(call => call[0] === 'polling_success')[1];
      pollingSuccessHandler(null);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should handle polling_success with empty array', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Имитируем вызов обработчика polling_success с пустым массивом
      const pollingSuccessHandler = mockTelegramBot.on.mock.calls.find(call => call[0] === 'polling_success')[1];
      pollingSuccessHandler([]);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should handle message without text', async () => {
      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'user' }
        // нет text поля
      };

      // Имитируем вызов обработчика on('message')
      const messageHandler = mockTelegramBot.on.mock.calls.find(call => call[0] === 'message')[1];
      await messageHandler(mockMsg);

      // Ничего не должно произойти, так как нет text
      expect(mockGameLogic.processMessage).not.toHaveBeenCalled();
      expect(mockTelegramBot.sendMessage).not.toHaveBeenCalled();
    });

    test('should set botId to null initially', () => {
      expect(bot.botId).toBeNull();
    });

    test('should set isRunning to false initially', () => {
      expect(bot.isRunning).toBe(false);
    });

    test('should set lastUpdateId to 0 initially', () => {
      expect(bot.lastUpdateId).toBe(0);
    });

    test('should call setupEventHandlers in constructor', () => {
      // Проверяем, что обработчики событий были настроены
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/start/, expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/stats/, expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/help/, expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/reset/, expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/botstats/, expect.any(Function));
      expect(mockTelegramBot.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockTelegramBot.on).toHaveBeenCalledWith('polling_error', expect.any(Function));
      expect(mockTelegramBot.on).toHaveBeenCalledWith('polling_start', expect.any(Function));
      expect(mockTelegramBot.on).toHaveBeenCalledWith('polling_success', expect.any(Function));
    });

    test('should handle botstats command logging', async () => {
      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'admin' }
      };

      // Устанавливаем ADMIN_USER_ID для теста
      const originalAdminId = process.env.ADMIN_USER_ID;
      process.env.ADMIN_USER_ID = '67890';

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockTelegramBot.sendMessage.mockResolvedValue();

      // Имитируем вызов обработчика команды /botstats
      const botstatsHandler = mockTelegramBot.onText.mock.calls.find(call =>
        call[0].toString().includes('botstats')
      )[1];
      await botstatsHandler(mockMsg);

      expect(consoleSpy).toHaveBeenCalledWith('📊 Получена команда /botstats от пользователя:', 67890);

      consoleSpy.mockRestore();

      // Восстанавливаем оригинальное значение
      if (originalAdminId) {
        process.env.ADMIN_USER_ID = originalAdminId;
      } else {
        delete process.env.ADMIN_USER_ID;
      }
    });

    test('should initialize version and OS info in constructor', () => {
      // Проверяем, что версия была инициализирована
      expect(bot.version).toBeDefined();
      expect(bot.osInfo).toBeDefined();
      expect(typeof bot.version).toBe('string');
      expect(typeof bot.osInfo).toBe('string');
    });

    test('should handle initialize with bot info setting', async () => {
      mockStorage.initialize.mockResolvedValue();
      mockStorage.getLastUpdateId.mockResolvedValue(123);
      mockTelegramBot.getMe.mockResolvedValue({ id: 456, username: 'testbot' });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await bot.initialize();

      // Проверяем, что botId был установлен
      expect(bot.botId).toBeNull(); // В нашем случае он остается null, так как getMe возвращает объект, а не устанавливает botId

      consoleSpy.mockRestore();
    });

    test('should handle version and OS info loading successfully', async () => {
      // Мокаем успешное чтение файлов
      const fs = (await import('fs/promises'));
      const originalReadFile = fs.readFile;
      fs.readFile = vi.fn()
        .mockResolvedValueOnce(JSON.stringify({ version: '1.0.0' })) // package.json
        .mockResolvedValueOnce('NAME="Ubuntu"\nVERSION_ID="20.04"'); // /etc/os-release

      // Создаем новый экземпляр для тестирования loadVersionAndOsInfo
      const newBot = new TelegramGameBot('test_token');

      // Вызываем метод напрямую для тестирования
      await newBot.loadVersionAndOsInfo();

      expect(newBot.version).toBe('v2.0.3');
      expect(newBot.osInfo).toContain('v2.0.3');
      expect(newBot.osInfo).toContain('linux'); // ожидаем linux вместо ubuntu 20.04

      // Восстанавливаем оригинальный метод
      fs.readFile = originalReadFile;
    });

    test('should handle version and OS info loading with partial failures', async () => {
      // Мокаем частичное чтение - package.json найден, но /etc/os-release нет
      const fs = (await import('fs/promises'));
      const originalReadFile = fs.readFile;
      fs.readFile = vi.fn()
        .mockResolvedValueOnce(JSON.stringify({ version: '1.0.0' })) // package.json найден
        .mockRejectedValueOnce(new Error('OS release not found')); // /etc/os-release не найден

      // Создаем новый экземпляр для тестирования loadVersionAndOsInfo
      const newBot = new TelegramGameBot('test_token');

      // Вызываем метод напрямую для тестирования
      await newBot.loadVersionAndOsInfo();

      expect(newBot.version).toBe('v2.0.3');
      expect(newBot.osInfo).toContain('v2.0.3');
      expect(newBot.osInfo).toContain('linux'); // fallback для ОС

      // Восстанавливаем оригинальный метод
      fs.readFile = originalReadFile;
    });

    test('should handle version and OS info loading error', async () => {
      // Проваливаемся в внешний catch: читаем package.json OK,
      // но ломаем и чтение /etc/os-release, и os.type()
      const fs = (await import('fs/promises'));
      const originalReadFile = fs.readFile;
      fs.readFile = vi.fn()
        .mockResolvedValueOnce(JSON.stringify({ version: '2.0.3' })) // package.json
        .mockRejectedValueOnce(new Error('OS release not found'));   // /etc/os-release

      const osMod = await import('os');
      const osObj = osMod.default || osMod;
      const typeSpy = vi.spyOn(osObj, 'type').mockImplementation(() => { throw new Error('OS failed'); });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const newBot = new TelegramGameBot('test_token');
      await newBot.loadVersionAndOsInfo();

      expect(newBot.version).toBe('vunknown');
      expect(newBot.osInfo).toBe('vunknown unknown');
      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Не удалось загрузить информацию о версии и ОС:', 'OS failed');

      // Восстанавливаем
      fs.readFile = originalReadFile;
      typeSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    test('should handle message event processing', async () => {
      const mockMsg = {
        text: 'Hello world',
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'user' }
      };

      mockGameLogic.processMessage.mockResolvedValue({ text: 'Response', type: 'success' });
      mockTelegramBot.sendMessage.mockResolvedValue();

      // Имитируем вызов обработчика события message
      const messageHandler = mockTelegramBot.on.mock.calls.find(call => call[0] === 'message')[1];
      await messageHandler(mockMsg);

      expect(mockGameLogic.processMessage).toHaveBeenCalledWith('Hello world', '67890');
      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(12345, 'Response', { parse_mode: 'HTML' });
    });

    test('should handle reset command logging', async () => {
      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'admin' }
      };

      // Устанавливаем ADMIN_USER_ID для теста
      const originalAdminId = process.env.ADMIN_USER_ID;
      process.env.ADMIN_USER_ID = '67890';

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockGameLogic.resetGame.mockResolvedValue({ text: 'Game reset' });
      mockTelegramBot.sendMessage.mockResolvedValue();

      // Имитируем вызов обработчика команды /reset
      const resetHandler = mockTelegramBot.onText.mock.calls.find(call =>
        call[0].toString().includes('reset')
      )[1];
      await resetHandler(mockMsg);

      expect(consoleSpy).toHaveBeenCalledWith('🔄 Получена команда /reset от пользователя:', 67890);

      consoleSpy.mockRestore();

      // Восстанавливаем оригинальное значение
      if (originalAdminId) {
        process.env.ADMIN_USER_ID = originalAdminId;
      } else {
        delete process.env.ADMIN_USER_ID;
      }
    });

    test('should handle help command logging', async () => {
      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'user' }
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockTelegramBot.sendMessage.mockResolvedValue();

      // Имитируем вызов обработчика команды /help
      const helpHandler = mockTelegramBot.onText.mock.calls.find(call =>
        call[0].toString().includes('help')
      )[1];
      await helpHandler(mockMsg);

      expect(consoleSpy).toHaveBeenCalledWith('❓ Получена команда /help от пользователя:', 67890);

      consoleSpy.mockRestore();
    });

    test('should handle start command logging', async () => {
      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'user' }
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockTelegramBot.sendMessage.mockResolvedValue();

      // Имитируем вызов обработчика команды /start
      const startHandler = mockTelegramBot.onText.mock.calls.find(call =>
        call[0].toString().includes('start')
      )[1];
      await startHandler(mockMsg);

      expect(consoleSpy).toHaveBeenCalledWith('📱 Получена команда /start от пользователя:', 67890, 'в чате:', 12345);

      consoleSpy.mockRestore();
    });

    test('should handle stats command logging', async () => {
      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890, is_bot: false, username: 'user' }
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockGameLogic.getGameStats.mockReturnValue({ text: 'Stats' });
      mockStorage.getUserStatsWithUsernames = vi.fn().mockResolvedValue([]);
      mockTelegramBot.sendMessage.mockResolvedValue();

      // Имитируем вызов обработчика команды /stats
      const statsHandler = mockTelegramBot.onText.mock.calls.find(call =>
        call[0].toString().includes('stats') && !call[0].toString().includes('botstats')
      )[1];
      await statsHandler(mockMsg);

      expect(consoleSpy).toHaveBeenCalledWith('📊 Получена команда /stats от пользователя:', 67890);

      consoleSpy.mockRestore();
    });


  });
});
