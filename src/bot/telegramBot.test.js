import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TelegramGameBot } from './telegramBot.js';
import { GameLogic } from '../game/gameLogic.js';
import { GameStorage } from '../storage/gameStorage.js';

// Подавляем логирование в тестах
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Мокаем все зависимости
vi.mock('node-telegram-bot-api');
vi.mock('../game/gameLogic.js');
vi.mock('../storage/gameStorage.js');

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
      initialize: vi.fn()
    };

    // Мокаем конструктор TelegramBot
    const TelegramBot = vi.mocked(await import('node-telegram-bot-api'));
    TelegramBot.default.mockImplementation(() => mockTelegramBot);

    // Мокаем GameLogic и GameStorage
    vi.mocked(GameLogic).mockImplementation(() => mockGameLogic);
    vi.mocked(GameStorage).mockImplementation(() => mockStorage);

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
      expect(TelegramBot.default).toHaveBeenCalledWith('test_token', { polling: true });
    });

    test('should setup event handlers', () => {
      expect(mockTelegramBot.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/start/, expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/stats/, expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/help/, expect.any(Function));
      expect(mockTelegramBot.onText).toHaveBeenCalledWith(/\/reset/, expect.any(Function));
    });
  });

  describe('initialize', () => {
    test('should initialize storage successfully', async () => {
      mockStorage.initialize.mockResolvedValue();
      
      await bot.initialize();
      
      expect(mockStorage.initialize).toHaveBeenCalled();
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
        chat: { id: 12345 },
        from: { id: 67890 }
      };

      const mockResponse = {
        text: 'запомнили',
        type: 'success'
      };

      mockGameLogic.processMessage.mockResolvedValue(mockResponse);
      mockTelegramBot.sendMessage.mockResolvedValue();

      // Вызываем обработчик сообщения напрямую
      await bot.handleMessage(mockMsg);

      expect(mockGameLogic.processMessage).toHaveBeenCalledWith('123', '67890');
      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(12345, 'запомнили', { parse_mode: 'HTML' });
    });

    test('should handle message without text', async () => {
      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890 }
      };

      await bot.handleMessage(mockMsg);

      expect(mockGameLogic.processMessage).not.toHaveBeenCalled();
      expect(mockTelegramBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('handleStartCommand', () => {
    test('should send welcome message', async () => {
      const mockMsg = {
        chat: { id: 12345 }
      };

      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.handleStartCommand(mockMsg);

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Добро пожаловать в игру AutoNumberGame'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('handleStatsCommand', () => {
    test('should send game statistics', async () => {
      const mockMsg = {
        chat: { id: 12345 }
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
  });

  describe('handleHelpCommand', () => {
    test('should send help message', async () => {
      const mockMsg = {
        chat: { id: 12345 }
      };

      mockTelegramBot.sendMessage.mockResolvedValue();

      await bot.handleHelpCommand(mockMsg);

      expect(mockTelegramBot.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining('Справка по игре AutoNumberGame'),
        { parse_mode: 'HTML' }
      );
    });
  });

  describe('handleResetCommand', () => {
    test('should reset game for admin in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890 }
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

    test('should deny reset for non-admin in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockMsg = {
        chat: { id: 12345 },
        from: { id: 67890 }
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
    test('should stop bot polling', async () => {
      mockTelegramBot.stopPolling.mockResolvedValue();

      await bot.stop();

      expect(mockTelegramBot.stopPolling).toHaveBeenCalled();
    });

    test('should handle stop error', async () => {
      const error = new Error('Stop failed');
      mockTelegramBot.stopPolling.mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await bot.stop();

      expect(consoleSpy).toHaveBeenCalledWith('❌ Error stopping bot:', error);

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
});
