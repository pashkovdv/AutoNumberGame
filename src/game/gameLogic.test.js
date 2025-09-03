import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameLogic } from './gameLogic.js';

// Подавляем логирование в тестах
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Мокаем GameStorage
vi.mock('../storage/gameStorage.js');

describe('GameLogic', () => {
  let gameLogic;
  let mockStorage;

  beforeEach(() => {
    // Подавляем логирование
    console.log = vi.fn();
    console.error = vi.fn();
    
    mockStorage = {
      data: {
        numbers: new Set(),
        players: new Set(),
        lastUpdate: new Date().toISOString()
      },
      hasNumber: vi.fn(),
      addNumber: vi.fn(),
      getFirstTenMissingNumbers: vi.fn(),
      getStats: vi.fn(),
      isGameComplete: vi.fn(),
      saveData: vi.fn()
    };

    gameLogic = new GameLogic(mockStorage);
  });

  afterEach(() => {
    // Восстанавливаем оригинальное логирование
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('isValidNumberFormat', () => {
    test('should validate correct number formats', () => {
      expect(gameLogic.isValidNumberFormat('1')).toBe(true);
      expect(gameLogic.isValidNumberFormat('42')).toBe(true);
      expect(gameLogic.isValidNumberFormat('123')).toBe(true);
      expect(gameLogic.isValidNumberFormat('999')).toBe(true);
    });

    test('should reject invalid number formats', () => {
      expect(gameLogic.isValidNumberFormat('000')).toBe(false);
      expect(gameLogic.isValidNumberFormat('1000')).toBe(false);
      expect(gameLogic.isValidNumberFormat('abc')).toBe(false);
      expect(gameLogic.isValidNumberFormat('12a')).toBe(false);
      expect(gameLogic.isValidNumberFormat('')).toBe(false);
    });
  });

  describe('processMessage', () => {
    test('should handle help command', async () => {
      mockStorage.getFirstTenMissingNumbers.mockReturnValue(['001', '002', '003']);
      
      const result = await gameLogic.processMessage('?', 'user123');
      
      expect(result.type).toBe('missing_numbers');
      expect(result.text).toContain('Первые 10 недостающих номеров');
      expect(mockStorage.getFirstTenMissingNumbers).toHaveBeenCalled();
    });

    test('should handle valid number submission', async () => {
      mockStorage.hasNumber.mockReturnValue(false);
      mockStorage.addNumber.mockReturnValue({ wasAdded: true, remaining: 998 });
      mockStorage.isGameComplete.mockReturnValue(false);
      mockStorage.saveData.mockResolvedValue();
      
      const result = await gameLogic.processMessage('123', 'user123');
      
      expect(result.type).toBe('success');
      expect(result.text).toContain('запомнили');
      expect(mockStorage.addNumber).toHaveBeenCalledWith('123', 'user123');
      expect(mockStorage.saveData).toHaveBeenCalled();
    });

    test('should handle duplicate number', async () => {
      mockStorage.hasNumber.mockReturnValue(true);
      
      const result = await gameLogic.processMessage('123', 'user123');
      
      expect(result.type).toBe('duplicate');
      expect(result.text).toBe('уже есть');
    });

    test('should handle invalid input', async () => {
      const result = await gameLogic.processMessage('invalid', 'user123');
      
      expect(result.type).toBe('info');
      expect(result.text).toContain('Отправьте номер от 001 до 999');
    });

    test('should trim whitespace from message', async () => {
      mockStorage.getFirstTenMissingNumbers.mockReturnValue(['001']);
      
      const result = await gameLogic.processMessage(' ? ', 'user123');
      
      expect(result.type).toBe('missing_numbers');
    });

    test('should handle duplicate number via processMessage path', async () => {
      mockStorage.hasNumber.mockReturnValue(true);

      const result = await gameLogic.processMessage('123', 'user123');

      expect(result.type).toBe('duplicate');
      expect(result.text).toBe('уже есть');
    });

    test('should delete own number with -xxx', async () => {
      mockStorage.removeNumber = vi.fn().mockReturnValue({ wasRemoved: true, remaining: 990 });
      mockStorage.saveData.mockResolvedValue();

      const result = await gameLogic.processMessage('-123', 'user123');

      expect(mockStorage.removeNumber).toHaveBeenCalledWith('123', 'user123');
      expect(mockStorage.saveData).toHaveBeenCalled();
      expect(result.type).toBe('delete_success');
      expect(result.text).toContain('удалено');
      expect(result.text).toContain('Осталось 990 номеров');
    });

    test('should say not found on delete when number missing', async () => {
      mockStorage.removeNumber = vi.fn().mockReturnValue({ wasRemoved: false, error: 'Number not found' });

      const result = await gameLogic.processMessage('-7', 'user123');

      expect(result.type).toBe('not_found');
      expect(result.text).toBe('номер не найден');
    });

    test('should forbid delete when not owner', async () => {
      mockStorage.removeNumber = vi.fn().mockReturnValue({ wasRemoved: false, error: 'Forbidden: not owner' });

      const result = await gameLogic.processMessage('-42', 'user123');

      expect(result.type).toBe('forbidden');
      expect(result.text).toBe('это не ваш номер');
    });

    test('should handle invalid delete format out of range', async () => {
      const result = await gameLogic.processMessage('-1000', 'user123');
      expect(result.type).toBe('error');
      expect(result.text).toBe('Неверный формат номера для удаления');
    });

    test('should handle delete with other error from removeNumber', async () => {
      mockStorage.removeNumber = vi.fn().mockReturnValue({ wasRemoved: false, error: 'Some other error' });
      mockStorage.saveData.mockResolvedValue();

      const result = await gameLogic.processMessage('-123', 'user123');

      expect(result.type).toBe('error');
      expect(result.text).toBe('Ошибка при удалении номера');
    });
  });

  describe('processNumberSubmission', () => {
    test('should add new number successfully', async () => {
      mockStorage.hasNumber.mockReturnValue(false);
      mockStorage.addNumber.mockReturnValue({ wasAdded: true, remaining: 998 });
      mockStorage.isGameComplete.mockReturnValue(false);
      mockStorage.saveData.mockResolvedValue();
      
      const result = await gameLogic.processNumberSubmission('123', 'user123');
      
      expect(result.type).toBe('success');
      expect(result.text).toContain('запомнили');
      expect(mockStorage.addNumber).toHaveBeenCalledWith('123', 'user123');
      expect(mockStorage.data.players.has('user123')).toBe(true);
    });

    test('should handle duplicate number', async () => {
      mockStorage.hasNumber.mockReturnValue(true);
      
      const result = await gameLogic.processNumberSubmission('123', 'user123');
      
      expect(result.type).toBe('duplicate');
      expect(result.text).toBe('уже есть');
    });

    test('should show remaining count when multiple of 10', async () => {
      mockStorage.hasNumber.mockReturnValue(false);
      mockStorage.addNumber.mockReturnValue({ wasAdded: true, remaining: 990 });
      mockStorage.isGameComplete.mockReturnValue(false);
      mockStorage.saveData.mockResolvedValue();
      
      const result = await gameLogic.processNumberSubmission('123', 'user123');
      
      expect(result.text).toContain('Осталось 990 номеров');
    });

    test('should show victory message when game complete', async () => {
      mockStorage.hasNumber.mockReturnValue(false);
      mockStorage.addNumber.mockReturnValue({ wasAdded: true, remaining: 0 });
      mockStorage.isGameComplete.mockReturnValue(true);
      mockStorage.saveData.mockResolvedValue();
      
      const result = await gameLogic.processNumberSubmission('999', 'user123');
      
      expect(result.text).toContain('🎉 ПОБЕДА! 🎉');
      expect(result.text).toContain('Все 999 номеров найдены!');
    });

    test('should handle addNumber failure', async () => {
      mockStorage.hasNumber.mockReturnValue(false);
      mockStorage.addNumber.mockReturnValue({ wasAdded: false, error: 'Invalid number' });
      
      const result = await gameLogic.processNumberSubmission('123', 'user123');
      
      expect(result.type).toBe('error');
      expect(result.text).toBe('Ошибка при добавлении номера');
    });

    test('should not add player when called as bot (isBot=true)', async () => {
      mockStorage.hasNumber.mockReturnValue(false);
      mockStorage.addNumber.mockReturnValue({ wasAdded: true, remaining: 998 });
      mockStorage.isGameComplete.mockReturnValue(false);
      mockStorage.saveData.mockResolvedValue();

      const result = await gameLogic.processNumberSubmission('123', 'bot123', true);

      expect(result.type).toBe('success');
      // user не должен быть добавлен в players, так как isBot=true
      expect(mockStorage.data.players.has('bot123')).toBe(false);
    });
  });

  describe('getMissingNumbersResponse', () => {
    test('should return missing numbers list', () => {
      const missingNumbers = ['001', '002', '003', '004', '005'];
      mockStorage.getFirstTenMissingNumbers.mockReturnValue(missingNumbers);
      
      const result = gameLogic.getMissingNumbersResponse();
      
      expect(result.type).toBe('missing_numbers');
      expect(result.text).toContain('001, 002, 003, 004, 005');
    });

    test('should handle empty missing numbers', () => {
      mockStorage.getFirstTenMissingNumbers.mockReturnValue([]);
      
      const result = gameLogic.getMissingNumbersResponse();
      
      expect(result.type).toBe('complete');
      expect(result.text).toContain('Все номера найдены! 🎉');
    });
  });

  describe('getGameStats', () => {
    test('should return formatted statistics', () => {
      const mockStats = {
        totalNumbers: 42,
        remaining: 957,
        players: 5,
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };
      mockStorage.getStats.mockReturnValue(mockStats);
      
      const result = gameLogic.getGameStats();
      
      expect(result.type).toBe('stats');
      expect(result.text).toContain('Найдено номеров: 42');
      expect(result.text).toContain('Осталось: 957');
      expect(result.text).toContain('Игроков: 5');
    });
  });

  describe('resetGame', () => {
    test('should clear all game data', async () => {
      mockStorage.saveData.mockResolvedValue();
      
      const result = await gameLogic.resetGame();
      
      expect(mockStorage.data.numbers.size).toBe(0);
      expect(mockStorage.data.players.size).toBe(0);
      expect(result.type).toBe('reset');
      expect(result.text).toContain('Игра сброшена');
      expect(mockStorage.saveData).toHaveBeenCalled();
    });
  });
});
