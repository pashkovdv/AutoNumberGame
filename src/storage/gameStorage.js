import fs from 'fs/promises';
import path from 'path';

export class GameStorage {
  constructor(dataFilePath = null) {
    // Используем переменную окружения GAME_DATA_FILE или значение по умолчанию
    if (!dataFilePath) {
      dataFilePath = process.env.GAME_DATA_FILE || './data/game_data.json';
    }
    this.dataFilePath = dataFilePath;
    this.data = {
      numbers: new Map(), // Map для хранения номер -> {number, userId, timestamp}
      players: new Set(),
      lastUpdate: new Date().toISOString()
    };
  }

  async initialize() {
    try {
      await this.ensureDataDirectory();
      await this.loadData();
    } catch (error) {
      console.warn('Could not load existing data, starting fresh:', error.message);
      await this.saveData();
    }
  }

  async ensureDataDirectory() {
    const dir = path.dirname(this.dataFilePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async loadData() {
    try {
      const data = await fs.readFile(this.dataFilePath, 'utf8');
      const parsed = JSON.parse(data);
      
      // Восстанавливаем Map из массива объектов
      if (parsed.numbers && Array.isArray(parsed.numbers)) {
        this.data.numbers = new Map();
        parsed.numbers.forEach(item => {
          if (typeof item === 'string') {
            // Совместимость со старой версией - простые строки
            this.data.numbers.set(item, {
              number: item,
              userId: 'unknown',
              timestamp: new Date().toISOString()
            });
          } else if (item && typeof item === 'object') {
            // Новая версия - объекты с метаданными
            this.data.numbers.set(item.number, item);
          }
        });
      } else {
        this.data.numbers = new Map();
      }
      
      this.data.players = new Set(parsed.players || []);
      this.data.lastUpdate = parsed.lastUpdate || new Date().toISOString();
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async saveData() {
    const dataToSave = {
      numbers: Array.from(this.data.numbers.values()), // Сохраняем значения Map
      players: Array.from(this.data.players),
      lastUpdate: new Date().toISOString()
    };
    
    await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
  }

  addNumber(number, userId) {
    if (this.isValidNumber(number)) {
      // Нормализуем номер - всегда сохраняем как 3-значное число с ведущими нулями
      const normalizedNumber = String(parseInt(number)).padStart(3, '0');
      const wasAdded = !this.data.numbers.has(normalizedNumber);
      if (wasAdded) {
        this.data.numbers.set(normalizedNumber, {
          number: normalizedNumber,
          userId: userId,
          timestamp: new Date().toISOString()
        });
        this.data.lastUpdate = new Date().toISOString();
      }
      return { wasAdded, remaining: this.getRemainingCount() };
    }
    return { wasAdded: false, error: 'Invalid number format' };
  }

  // Удаление номера. Разрешено только если номер принадлежит этому userId
  removeNumber(number, userId) {
    const num = parseInt(number);
    if (Number.isNaN(num)) {
      return { wasRemoved: false, error: 'Invalid number format' };
    }
    const normalizedNumber = String(num).padStart(3, '0');
    const entry = this.data.numbers.get(normalizedNumber);
    if (!entry) {
      return { wasRemoved: false, error: 'Number not found' };
    }
    if (entry.userId !== userId) {
      return { wasRemoved: false, error: 'Forbidden: not owner' };
    }
    this.data.numbers.delete(normalizedNumber);
    this.data.lastUpdate = new Date().toISOString();
    return { wasRemoved: true, remaining: this.getRemainingCount() };
  }

  isValidNumber(number) {
    const numStr = String(number);
    const maxNumbers = parseInt(process.env.MAX_NUMBERS) || 999;
    return /^\d{1,3}$/.test(numStr) && parseInt(numStr) >= 1 && parseInt(numStr) <= maxNumbers;
  }

  hasNumber(number) {
    // Нормализуем номер для проверки
    const normalizedNumber = String(parseInt(number)).padStart(3, '0');
    return this.data.numbers.has(normalizedNumber);
  }

  getRemainingCount() {
    const maxNumbers = parseInt(process.env.MAX_NUMBERS) || 999;
    return maxNumbers - this.data.numbers.size;
  }

  getFirstTenMissingNumbers() {
    const missing = [];
    const maxNumbers = parseInt(process.env.MAX_NUMBERS) || 999;
    for (let i = 1; i <= maxNumbers; i++) {
      if (!this.data.numbers.has(String(i).padStart(3, '0'))) {
        missing.push(String(i).padStart(3, '0'));
        if (missing.length >= 10) break;
      }
    }
    return missing;
  }

  isGameComplete() {
    const maxNumbers = parseInt(process.env.MAX_NUMBERS) || 999;
    return this.data.numbers.size >= maxNumbers;
  }

  getStats() {
    return {
      totalNumbers: this.data.numbers.size,
      remaining: this.getRemainingCount(),
      players: this.data.players.size,
      lastUpdate: this.data.lastUpdate
    };
  }

  // Получить информацию о номере (кто нашел и когда)
  getNumberInfo(number) {
    const normalizedNumber = String(parseInt(number)).padStart(3, '0');
    return this.data.numbers.get(normalizedNumber) || null;
  }

  // Получить все номера с информацией о том, кто их нашел
  getAllNumbersWithInfo() {
    return Array.from(this.data.numbers.values());
  }

  // Получить статистику по пользователям (сколько номеров нашел каждый)
  getUserStats() {
    const userStats = new Map();
    
    this.data.numbers.forEach((numberInfo, number) => {
      const userId = numberInfo.userId;
      if (!userStats.has(userId)) {
        userStats.set(userId, { userId, count: 0, numbers: [] });
      }
      const stats = userStats.get(userId);
      stats.count++;
      stats.numbers.push(number);
    });
    
    return Array.from(userStats.values());
  }

  // Получить детальную статистику с username (если доступен)
  async getUserStatsWithUsernames(bot) {
    const userStats = this.getUserStats();
    const detailedStats = [];
    
    for (const stat of userStats) {
      try {
        // Пытаемся получить информацию о пользователе из Telegram
        const userInfo = await bot.getChat(stat.userId);
        const username = userInfo.username || userInfo.first_name || `User ${stat.userId}`;
        
        detailedStats.push({
          ...stat,
          username: username,
          displayName: userInfo.first_name || username
        });
      } catch (error) {
        // Если не удалось получить информацию, используем userId
        detailedStats.push({
          ...stat,
          username: `User ${stat.userId}`,
          displayName: `User ${stat.userId}`
        });
      }
    }
    
    // Сортируем по количеству найденных номеров (по убыванию)
    return detailedStats.sort((a, b) => b.count - a.count);
  }

  // Новые методы для работы с состоянием бота
  async saveBotState(state) {
    const botStatePath = path.join(path.dirname(this.dataFilePath), 'bot_state.json');
    const botState = {
      lastUpdateId: state.lastUpdateId || 0,
      lastActivity: new Date().toISOString(),
      uptime: process.uptime(),
      lastMessageTime: state.lastMessageTime || new Date().toISOString(),
      totalMessagesProcessed: state.totalMessagesProcessed || 0
    };
    
    await fs.writeFile(botStatePath, JSON.stringify(botState, null, 2));
  }

  async getBotState() {
    try {
      const botStatePath = path.join(path.dirname(this.dataFilePath), 'bot_state.json');
      const data = await fs.readFile(botStatePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Если файл не существует, возвращаем начальное состояние
        return {
          lastUpdateId: 0,
          lastActivity: new Date().toISOString(),
          uptime: 0,
          lastMessageTime: new Date().toISOString(),
          totalMessagesProcessed: 0
        };
      }
      throw error;
    }
  }

  async updateBotActivity(updateId, messageTime) {
    const currentState = await this.getBotState();
    const newState = {
      ...currentState,
      lastUpdateId: updateId,
      lastMessageTime: messageTime,
      lastActivity: new Date().toISOString(),
      totalMessagesProcessed: currentState.totalMessagesProcessed + 1
    };
    
    await this.saveBotState(newState);
  }

  async getLastActivity() {
    const state = await this.getBotState();
    return state.lastMessageTime;
  }

  async getLastUpdateId() {
    const state = await this.getBotState();
    return state.lastUpdateId;
  }
}
