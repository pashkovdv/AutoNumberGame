import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameStorage } from './gameStorage.js';
import fs from 'fs/promises';
import path from 'path';

// Мокаем fs модуль
vi.mock('fs/promises');
vi.mock('path');

// Подавляем логирование в тестах
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('GameStorage', () => {
  let storage;
  let mockDataPath;

  beforeEach(() => {
    // Подавляем логирование
    console.log = vi.fn();
    console.error = vi.fn();
    
    mockDataPath = './test_data.json';
    storage = new GameStorage(mockDataPath);
    
    // Сбрасываем моки
    vi.clearAllMocks();
    
    // Мокаем path.dirname
    path.dirname.mockReturnValue('./');
  });

  afterEach(() => {
    // Восстанавливаем оригинальное логирование
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('constructor', () => {
    test('should initialize with default data structure', () => {
      expect(storage.data.numbers).toBeInstanceOf(Map);
      expect(storage.data.players).toBeInstanceOf(Set);
      expect(storage.data.lastUpdate).toBeDefined();
    });

    test('should accept custom data file path', () => {
      const customPath = './custom/path/data.json';
      const customStorage = new GameStorage(customPath);
      expect(customStorage.dataFilePath).toBe(customPath);
    });
  });

  describe('initialize', () => {
    test('should initialize storage successfully', async () => {
      // Мокаем успешную инициализацию
      fs.access.mockResolvedValue();
      fs.readFile.mockResolvedValue('{"numbers":["001","002"],"players":["user1"],"lastUpdate":"2023-01-01T00:00:00.000Z"}');
      
      await storage.initialize();
      
      expect(fs.access).toHaveBeenCalledWith('./');
      expect(fs.readFile).toHaveBeenCalledWith('./test_data.json', 'utf8');
      expect(storage.data.numbers.has('001')).toBe(true);
      expect(storage.data.players.has('user1')).toBe(true);
    });

    test('should create directory if it does not exist', async () => {
      // Мокаем ошибку доступа к директории
      fs.access.mockRejectedValue(new Error('Directory not found'));
      fs.mkdir.mockResolvedValue();
      fs.readFile.mockResolvedValue('{"numbers":[],"players":[],"lastUpdate":"2023-01-01T00:00:00.000Z"}');
      
      await storage.initialize();
      
      expect(fs.mkdir).toHaveBeenCalledWith('./', { recursive: true });
      expect(fs.readFile).toHaveBeenCalled();
    });

    test('should handle loadData error and start fresh', async () => {
      // Мокаем ошибку при загрузке данных (не ENOENT)
      fs.access.mockResolvedValue();
      fs.readFile.mockRejectedValue(new Error('File corrupted'));
      fs.writeFile.mockResolvedValue();
      
      await storage.initialize();
      
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('isValidNumber', () => {
    test('should validate correct 3-digit numbers', () => {
      expect(storage.isValidNumber('001')).toBe(true);
      expect(storage.isValidNumber('123')).toBe(true);
      expect(storage.isValidNumber('999')).toBe(true);
    });

    test('should validate 1-2 digit numbers', () => {
      expect(storage.isValidNumber('1')).toBe(true);
      expect(storage.isValidNumber('42')).toBe(true);
    });

    test('should reject invalid numbers', () => {
      expect(storage.isValidNumber('000')).toBe(false);
      expect(storage.isValidNumber('1000')).toBe(false);
      expect(storage.isValidNumber('abc')).toBe(false);
      expect(storage.isValidNumber('12a')).toBe(false);
      expect(storage.isValidNumber('')).toBe(false);
    });
  });

  describe('addNumber', () => {
    test('should add new valid number', () => {
      const result = storage.addNumber('123', 'user123');
      expect(result.wasAdded).toBe(true);
      expect(result.remaining).toBe(998);
      expect(storage.data.numbers.has('123')).toBe(true);
    });

    test('should not add duplicate number', () => {
      storage.addNumber('123', 'user123');
      const result = storage.addNumber('123', 'user456');
      expect(result.wasAdded).toBe(false);
      expect(result.remaining).toBe(998);
    });

    test('should reject invalid number', () => {
      const result = storage.addNumber('invalid', 'user123');
      expect(result.wasAdded).toBe(false);
      expect(result.error).toBe('Invalid number format');
    });
  });

  describe('hasNumber', () => {
    test('should return true for existing number', () => {
      storage.addNumber('123', 'user123');
      expect(storage.hasNumber('123')).toBe(true);
    });

    test('should return false for non-existing number', () => {
      expect(storage.hasNumber('123')).toBe(false);
    });

    test('should handle string conversion', () => {
      storage.addNumber('123', 'user123');
      expect(storage.hasNumber(123)).toBe(true);
    });
  });

  describe('getRemainingCount', () => {
    test('should return 999 for empty storage', () => {
      expect(storage.getRemainingCount()).toBe(999);
    });

    test('should return correct count after adding numbers', () => {
      storage.addNumber('001', 'user1');
      storage.addNumber('002', 'user2');
      expect(storage.getRemainingCount()).toBe(997);
    });
  });

  describe('getFirstTenMissingNumbers', () => {
    test('should return first 10 missing numbers', () => {
      const missing = storage.getFirstTenMissingNumbers();
      expect(missing).toHaveLength(10);
      expect(missing[0]).toBe('001');
      expect(missing[9]).toBe('010');
    });

    test('should return correct missing numbers after adding some', () => {
      storage.addNumber('001', 'user1');
      storage.addNumber('003', 'user2');
      storage.addNumber('005', 'user3');
      
      const missing = storage.getFirstTenMissingNumbers();
      expect(missing).toContain('002');
      expect(missing).toContain('004');
      expect(missing).toContain('006');
    });
  });

  describe('isGameComplete', () => {
    test('should return false for incomplete game', () => {
      expect(storage.isGameComplete()).toBe(false);
    });

    test('should return true when all numbers are collected', () => {
      // Добавляем все числа от 1 до 999
      for (let i = 1; i <= 999; i++) {
        storage.addNumber(String(i), `user${i}`);
      }
      expect(storage.isGameComplete()).toBe(true);
    });
  });

  describe('getStats', () => {
    test('should return correct statistics', () => {
      storage.addNumber('123', 'user1');
      storage.addNumber('456', 'user2');
      
      const stats = storage.getStats();
      expect(stats.totalNumbers).toBe(2);
      expect(stats.remaining).toBe(997);
      expect(stats.players).toBe(0);
      expect(stats.lastUpdate).toBeDefined();
    });
  });

  describe('file operations', () => {
    test('should create directory if not exists', async () => {
      fs.access.mockRejectedValueOnce({ code: 'ENOENT' });
      
      await storage.ensureDataDirectory();
      
      expect(fs.mkdir).toHaveBeenCalledWith('./', { recursive: true });
    });

    test('should load existing data', async () => {
      const mockData = {
        numbers: ['001', '002'],
        players: ['player1'],
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };
      
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));
      
      await storage.loadData();
      
      expect(storage.data.numbers.has('001')).toBe(true);
      expect(storage.data.numbers.has('002')).toBe(true);
      expect(storage.data.players.has('player1')).toBe(true);
    });

    test('should load new format data', async () => {
      const mockData = {
        numbers: [
          { number: '001', userId: 'user1', timestamp: '2023-01-01T00:00:00.000Z' },
          { number: '002', userId: 'user2', timestamp: '2023-01-01T00:00:00.000Z' }
        ],
        players: ['player1'],
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };
      
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));
      
      await storage.loadData();
      
      expect(storage.data.numbers.has('001')).toBe(true);
      expect(storage.data.numbers.has('002')).toBe(true);
      expect(storage.data.numbers.get('001').userId).toBe('user1');
      expect(storage.data.numbers.get('002').userId).toBe('user2');
      expect(storage.data.players.has('player1')).toBe(true);
    });

    test('should save data correctly', async () => {
      storage.addNumber('123', 'user123');
      
      await storage.saveData();
      
      // Проверяем, что writeFile был вызван
      expect(fs.writeFile).toHaveBeenCalled();
      
      // Проверяем, что первый аргумент - это путь к файлу
      const writeFileCall = fs.writeFile.mock.calls[0];
      expect(writeFileCall[0]).toBe(mockDataPath);
      
      // Проверяем, что второй аргумент содержит данные
      const savedData = JSON.parse(writeFileCall[1]);
      expect(savedData.numbers).toHaveLength(1);
      expect(savedData.numbers[0]).toMatchObject({
        number: '123',
        userId: 'user123',
        timestamp: expect.any(String)
      });
    });
  });

  describe('new methods', () => {
    test('should get number info', () => {
      storage.addNumber('123', 'user123');
      const info = storage.getNumberInfo('123');
      expect(info).toMatchObject({
        number: '123',
        userId: 'user123',
        timestamp: expect.any(String)
      });
    });

    test('should get all numbers with info', () => {
      storage.addNumber('123', 'user123');
      storage.addNumber('456', 'user456');
      const allNumbers = storage.getAllNumbersWithInfo();
      expect(allNumbers).toHaveLength(2);
      expect(allNumbers[0]).toMatchObject({
        number: '123',
        userId: 'user123',
        timestamp: expect.any(String)
      });
    });

    test('should get user stats', () => {
      storage.addNumber('123', 'user123');
      storage.addNumber('456', 'user123');
      storage.addNumber('789', 'user456');
      const userStats = storage.getUserStats();
      expect(userStats).toHaveLength(2);
      expect(userStats.find(s => s.userId === 'user123').count).toBe(2);
      expect(userStats.find(s => s.userId === 'user456').count).toBe(1);
    });

    test('should normalize numbers correctly', () => {
      storage.addNumber('1', 'user1');
      storage.addNumber('02', 'user2');
      storage.addNumber('003', 'user3');
      
      expect(storage.hasNumber('1')).toBe(true);
      expect(storage.hasNumber('01')).toBe(true);
      expect(storage.hasNumber('001')).toBe(true);
      expect(storage.hasNumber('2')).toBe(true);
      expect(storage.hasNumber('02')).toBe(true);
      expect(storage.hasNumber('002')).toBe(true);
      expect(storage.hasNumber('3')).toBe(true);
      expect(storage.hasNumber('03')).toBe(true);
      expect(storage.hasNumber('003')).toBe(true);
    });

    test('should get last activity time', async () => {
      const mockState = {
        lastMessageTime: '2023-01-01T10:00:00.000Z',
        lastUpdateId: 123,
        lastActivity: '2023-01-01T10:05:00.000Z',
        uptime: 300,
        version: '1.0.0',
        totalMessagesProcessed: 5
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockState));

      const lastActivity = await storage.getLastActivity();
      expect(lastActivity).toBe('2023-01-01T10:00:00.000Z');
      expect(fs.readFile).toHaveBeenCalled();
    });

    test('should get last update id', async () => {
      const mockState = {
        lastMessageTime: '2023-01-01T10:00:00.000Z',
        lastUpdateId: 456,
        lastActivity: '2023-01-01T10:05:00.000Z',
        uptime: 300,
        version: '1.0.0',
        totalMessagesProcessed: 5
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockState));

      const lastUpdateId = await storage.getLastUpdateId();
      expect(lastUpdateId).toBe(456);
      expect(fs.readFile).toHaveBeenCalled();
    });

    test('should handle bot state methods when file does not exist', async () => {
      // Мокаем ENOENT ошибку для getBotState
      fs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });

      const defaultState = await storage.getBotState();
      expect(defaultState).toEqual({
        lastUpdateId: 0,
        lastActivity: expect.any(String),
        uptime: 0,
        lastMessageTime: expect.any(String),
        totalMessagesProcessed: 0
      });

      // Для getLastActivity и getLastUpdateId тоже должны работать
      fs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });
      const lastActivity = await storage.getLastActivity();
      expect(lastActivity).toBeDefined();

      fs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });
      const lastUpdateId = await storage.getLastUpdateId();
      expect(lastUpdateId).toBe(0);
    });

    test('should save and get bot state correctly', async () => {
      const testState = {
        lastUpdateId: 789,
        lastMessageTime: '2023-01-01T12:00:00.000Z',
        totalMessagesProcessed: 10
      };

      await storage.saveBotState(testState);
      expect(fs.writeFile).toHaveBeenCalled();

      // Проверяем, что можем прочитать сохраненное состояние
      fs.readFile.mockResolvedValueOnce(JSON.stringify({
        lastUpdateId: 789,
        lastActivity: expect.any(String),
        uptime: expect.any(Number),
        lastMessageTime: '2023-01-01T12:00:00.000Z',
        totalMessagesProcessed: 10
      }));

      const retrievedState = await storage.getBotState();
      expect(retrievedState.lastUpdateId).toBe(789);
      expect(retrievedState.lastMessageTime).toBe('2023-01-01T12:00:00.000Z');
      expect(retrievedState.totalMessagesProcessed).toBe(10);
    });
  });
});
