import fs from 'fs/promises';
import path from 'path';

export class GameStorage {
  constructor(dataFilePath = './data/game_data.json') {
    this.dataFilePath = dataFilePath;
    this.data = {
      numbers: new Set(),
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
      
      // Восстанавливаем Set из массива
      this.data.numbers = new Set(parsed.numbers || []);
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
      numbers: Array.from(this.data.numbers),
      players: Array.from(this.data.players),
      lastUpdate: new Date().toISOString()
    };
    
    await fs.writeFile(this.dataFilePath, JSON.stringify(dataToSave, null, 2));
  }

  addNumber(number) {
    if (this.isValidNumber(number)) {
      const wasAdded = !this.data.numbers.has(number);
      if (wasAdded) {
        this.data.numbers.add(number);
        this.data.lastUpdate = new Date().toISOString();
      }
      return { wasAdded, remaining: this.getRemainingCount() };
    }
    return { wasAdded: false, error: 'Invalid number format' };
  }

  isValidNumber(number) {
    const numStr = String(number);
    return /^\d{1,3}$/.test(numStr) && parseInt(numStr) >= 1 && parseInt(numStr) <= 999;
  }

  hasNumber(number) {
    return this.data.numbers.has(String(number));
  }

  getRemainingCount() {
    return 999 - this.data.numbers.size;
  }

  getFirstTenMissingNumbers() {
    const missing = [];
    for (let i = 1; i <= 999; i++) {
      if (!this.data.numbers.has(String(i).padStart(3, '0'))) {
        missing.push(String(i).padStart(3, '0'));
        if (missing.length >= 10) break;
      }
    }
    return missing;
  }

  isGameComplete() {
    return this.data.numbers.size >= 999;
  }

  getStats() {
    return {
      totalNumbers: this.data.numbers.size,
      remaining: this.getRemainingCount(),
      players: this.data.players.size,
      lastUpdate: this.data.lastUpdate
    };
  }
}
