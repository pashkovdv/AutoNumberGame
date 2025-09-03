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

    test('should handle loading data with null/undefined numbers array', async () => {
      const mockData = {
        numbers: null, // или undefined
        players: ['user1'],
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

      await storage.loadData();

      expect(storage.data.numbers).toBeInstanceOf(Map);
      expect(storage.data.numbers.size).toBe(0);
      expect(storage.data.players.has('user1')).toBe(true);
    });

    test('should handle loading data with empty numbers array', async () => {
      const mockData = {
        numbers: [],
        players: ['user1'],
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

      await storage.loadData();

      expect(storage.data.numbers).toBeInstanceOf(Map);
      expect(storage.data.numbers.size).toBe(0);
      expect(storage.data.players.has('user1')).toBe(true);
    });

    test('should get user stats with usernames successfully', async () => {
      // Создаем тестовые данные
      storage.addNumber('001', 'user1');
      storage.addNumber('002', 'user1');
      storage.addNumber('003', 'user2');

      const mockBot = {
        getChat: vi.fn()
          .mockResolvedValueOnce({ username: 'testuser1', first_name: 'Test User 1' })
          .mockResolvedValueOnce({ username: 'testuser2', first_name: 'Test User 2' })
      };

      const result = await storage.getUserStatsWithUsernames(mockBot);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user1');
      expect(result[0].count).toBe(2);
      expect(result[0].username).toBe('testuser1');
      expect(result[0].displayName).toBe('Test User 1');

      expect(result[1].userId).toBe('user2');
      expect(result[1].count).toBe(1);
      expect(result[1].username).toBe('testuser2');
      expect(result[1].displayName).toBe('Test User 2');
    });

    test('should handle getChat errors gracefully in getUserStatsWithUsernames', async () => {
      // Создаем тестовые данные
      storage.addNumber('001', 'user1');
      storage.addNumber('002', 'user2');

      const mockBot = {
        getChat: vi.fn()
          .mockRejectedValueOnce(new Error('User not found')) // Ошибка для user1
          .mockResolvedValueOnce({ username: 'testuser2', first_name: 'Test User 2' }) // Успех для user2
      };

      const result = await storage.getUserStatsWithUsernames(mockBot);

      expect(result).toHaveLength(2);

      // Для user1 должна быть fallback информация
      expect(result[0].userId).toBe('user1');
      expect(result[0].username).toBe('User user1');
      expect(result[0].displayName).toBe('User user1');

      // Для user2 должна быть реальная информация
      expect(result[1].userId).toBe('user2');
      expect(result[1].username).toBe('testuser2');
      expect(result[1].displayName).toBe('Test User 2');
    });

    test('should handle getChat returning user without username', async () => {
      storage.addNumber('001', 'user1');

      const mockBot = {
        getChat: vi.fn().mockResolvedValueOnce({
          first_name: 'Test User',
          id: 12345
          // username отсутствует
        })
      };

      const result = await storage.getUserStatsWithUsernames(mockBot);

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('Test User');
      expect(result[0].displayName).toBe('Test User');
    });

    test('should update bot activity correctly', async () => {
      const initialState = {
        lastUpdateId: 100,
        lastMessageTime: '2023-01-01T10:00:00.000Z',
        totalMessagesProcessed: 5
      };

      // Мокаем начальное состояние
      fs.readFile.mockResolvedValueOnce(JSON.stringify(initialState));

      const updateId = 150;
      const messageTime = '2023-01-01T11:00:00.000Z';

      await storage.updateBotActivity(updateId, messageTime);

      // Проверяем, что saveBotState был вызван с правильными данными
      expect(fs.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);

      expect(savedData.lastUpdateId).toBe(updateId);
      expect(savedData.lastMessageTime).toBe(messageTime);
      expect(savedData.totalMessagesProcessed).toBe(6); // 5 + 1
      expect(savedData.lastActivity).toBeDefined();
    });

    test('should handle getBotState file read error', async () => {
      // Мокаем ошибку чтения файла (не ENOENT)
      fs.readFile.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(storage.getBotState()).rejects.toThrow('Permission denied');
    });

    test('should use GAME_DATA_FILE environment variable in constructor', () => {
      // Сохраняем оригинальное значение
      const originalEnv = process.env.GAME_DATA_FILE;

      // Устанавливаем переменную окружения
      process.env.GAME_DATA_FILE = '/custom/path/data.json';

      // Создаем новый экземпляр
      const customStorage = new GameStorage();

      // Проверяем, что путь был установлен из переменной окружения
      expect(customStorage.dataFilePath).toBe('/custom/path/data.json');

      // Восстанавливаем оригинальное значение
      if (originalEnv) {
        process.env.GAME_DATA_FILE = originalEnv;
      } else {
        delete process.env.GAME_DATA_FILE;
      }
    });

    test('should use default path when GAME_DATA_FILE is not set', () => {
      // Сохраняем оригинальное значение
      const originalEnv = process.env.GAME_DATA_FILE;

      // Удаляем переменную окружения
      delete process.env.GAME_DATA_FILE;

      // Создаем новый экземпляр
      const defaultStorage = new GameStorage();

      // Проверяем, что используется путь по умолчанию
      expect(defaultStorage.dataFilePath).toBe('./data/game_data.json');

      // Восстанавливаем оригинальное значение
      if (originalEnv) {
        process.env.GAME_DATA_FILE = originalEnv;
      }
    });

    test('should accept custom dataFilePath parameter', () => {
      // Сохраняем оригинальное значение
      const originalEnv = process.env.GAME_DATA_FILE;

      // Устанавливаем переменную окружения
      process.env.GAME_DATA_FILE = '/env/path/data.json';

      // Создаем новый экземпляр с явным путем (должен игнорировать переменную окружения)
      const customStorage = new GameStorage('/custom/path/data.json');

      // Проверяем, что используется переданный параметр, а не переменная окружения
      expect(customStorage.dataFilePath).toBe('/custom/path/data.json');

      // Восстанавливаем оригинальное значение
      if (originalEnv) {
        process.env.GAME_DATA_FILE = originalEnv;
      } else {
        delete process.env.GAME_DATA_FILE;
      }
    });

    test('should load data with valid players array', async () => {
      const mockData = {
        numbers: [
          { number: '001', userId: 'user1', timestamp: '2023-01-01T00:00:00.000Z' },
          { number: '002', userId: 'user2', timestamp: '2023-01-01T00:00:00.000Z' }
        ],
        players: ['user1', 'user2', 'user3'],
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

      await storage.loadData();

      expect(storage.data.players.has('user1')).toBe(true);
      expect(storage.data.players.has('user2')).toBe(true);
      expect(storage.data.players.has('user3')).toBe(true);
      expect(storage.data.players.size).toBe(3);
    });

    test('should return null for non-existent number in getNumberInfo', () => {
      storage.addNumber('001', 'user1');
      storage.addNumber('002', 'user2');

      const result = storage.getNumberInfo('999'); // несуществующий номер

      expect(result).toBeNull();
    });

    test('should return valid number info for existing number', () => {
      storage.addNumber('123', 'user123');

      const result = storage.getNumberInfo('123');

      expect(result).toMatchObject({
        number: '123',
        userId: 'user123',
        timestamp: expect.any(String)
      });
    });

    test('should handle successful user info retrieval in getUserStatsWithUsernames', async () => {
      storage.addNumber('001', 'user1');
      storage.addNumber('002', 'user1');

      const mockBot = {
        getChat: vi.fn().mockResolvedValueOnce({
          username: 'testuser',
          first_name: 'Test User',
          id: 12345
        })
      };

      const result = await storage.getUserStatsWithUsernames(mockBot);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user1');
      expect(result[0].username).toBe('testuser');
      expect(result[0].displayName).toBe('Test User');
    });

    test('should save bot state with all required fields', async () => {
      const stateData = {
        lastUpdateId: 123,
        lastMessageTime: '2023-01-01T10:00:00.000Z',
        totalMessagesProcessed: 42
      };

      await storage.saveBotState(stateData);

      expect(fs.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);

      expect(savedData).toMatchObject({
        lastUpdateId: 123,
        lastMessageTime: '2023-01-01T10:00:00.000Z',
        totalMessagesProcessed: 42,
        lastActivity: expect.any(String),
        uptime: expect.any(Number)
      });
    });

    test('should save bot state with default values', async () => {
      await storage.saveBotState({});

      expect(fs.writeFile).toHaveBeenCalled();
      const savedData = JSON.parse(fs.writeFile.mock.calls[0][1]);

      expect(savedData.lastUpdateId).toBe(0);
      expect(savedData.totalMessagesProcessed).toBe(0);
      expect(savedData.lastMessageTime).toBeDefined();
      expect(savedData.lastActivity).toBeDefined();
      expect(savedData.uptime).toBeDefined();
    });

    test('should handle loadData with players set', async () => {
      const mockData = {
        numbers: [
          { number: '001', userId: 'user1', timestamp: '2023-01-01T00:00:00.000Z' }
        ],
        players: ['user1', 'user2'],
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

      await storage.loadData();

      expect(storage.data.players.has('user1')).toBe(true);
      expect(storage.data.players.has('user2')).toBe(true);
      expect(storage.data.players.size).toBe(2);
      expect(storage.data.lastUpdate).toBe('2023-01-01T00:00:00.000Z');
    });

    test('should handle loadData with null players array', async () => {
      const mockData = {
        numbers: [],
        players: null, // явное null значение
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

      await storage.loadData();

      expect(storage.data.players).toBeInstanceOf(Set);
      expect(storage.data.players.size).toBe(0);
      expect(storage.data.lastUpdate).toBe('2023-01-01T00:00:00.000Z');
    });

    test('should handle loadData with undefined players array', async () => {
      const mockData = {
        numbers: [],
        // players отсутствует (undefined)
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

      await storage.loadData();

      expect(storage.data.players).toBeInstanceOf(Set);
      expect(storage.data.players.size).toBe(0);
      expect(storage.data.lastUpdate).toBe('2023-01-01T00:00:00.000Z');
    });

    test('should handle loadData with empty players array', async () => {
      const mockData = {
        numbers: [],
        players: [],
        lastUpdate: '2023-01-01T00:00:00.000Z'
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

      await storage.loadData();

      expect(storage.data.players).toBeInstanceOf(Set);
      expect(storage.data.players.size).toBe(0);
      expect(storage.data.lastUpdate).toBe('2023-01-01T00:00:00.000Z');
    });

    test('should handle loadData without lastUpdate field', async () => {
      const mockData = {
        numbers: [],
        players: ['user1']
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockData));

      // Сохраняем время до выполнения
      const beforeTime = new Date();

      await storage.loadData();

      // Сохраняем время после выполнения
      const afterTime = new Date();

      expect(storage.data.players.has('user1')).toBe(true);
      expect(storage.data.lastUpdate).toBeDefined();

      // Проверяем, что lastUpdate находится в разумном диапазоне времени
      const updateTime = new Date(storage.data.lastUpdate);
      expect(updateTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime() - 1000);
      expect(updateTime.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
    });

    test('should handle user info with username in getUserStatsWithUsernames', async () => {
      storage.addNumber('001', 'user1');

      const mockBot = {
        getChat: vi.fn().mockResolvedValueOnce({
          username: 'testuser',
          first_name: 'Test',
          last_name: 'User',
          id: 12345
        })
      };

      const result = await storage.getUserStatsWithUsernames(mockBot);

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('testuser');
      expect(result[0].displayName).toBe('Test');
    });

    test('should handle user info with only first_name in getUserStatsWithUsernames', async () => {
      storage.addNumber('001', 'user1');

      const mockBot = {
        getChat: vi.fn().mockResolvedValueOnce({
          first_name: 'TestUser',
          id: 12345
          // нет username
        })
      };

      const result = await storage.getUserStatsWithUsernames(mockBot);

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('TestUser');
      expect(result[0].displayName).toBe('TestUser');
    });

    test('should handle user info with no username or first_name in getUserStatsWithUsernames', async () => {
      storage.addNumber('001', 'user1');

      const mockBot = {
        getChat: vi.fn().mockResolvedValueOnce({
          id: 12345
          // нет username и first_name
        })
      };

      const result = await storage.getUserStatsWithUsernames(mockBot);

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('User user1');
      expect(result[0].displayName).toBe('User user1');
    });
  });
});
