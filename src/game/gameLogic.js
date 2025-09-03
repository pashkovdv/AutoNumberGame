export class GameLogic {
  constructor(storage) {
    this.storage = storage;
  }

  async processMessage(message, userId) {
    const text = message.trim();
    
    // Обработка команды помощи
    if (text === '?') {
      return this.getMissingNumbersResponse();
    }

    // Обработка удаления: -<число> (любой длины), далее проверяем диапазон
    if (/^-\d+$/.test(text)) {
      const numberToRemove = text.slice(1);
      const maxNumbers = parseInt(process.env.MAX_NUMBERS) || 999;
      const numVal = parseInt(numberToRemove);
      if (!(numVal >= 1 && numVal <= maxNumbers)) {
        return { text: 'Неверный формат номера для удаления', type: 'error' };
      }
      const result = this.storage.removeNumber(numberToRemove, userId);
      if (result.wasRemoved) {
        // сохраняем изменения
        await this.storage.saveData();
        let response = 'удалено';
        if (result.remaining % 10 === 0) {
          response += `\nОсталось ${result.remaining} номеров`;
        }
        return { text: response, type: 'delete_success' };
      }
      if (result.error === 'Number not found') {
        return { text: 'номер не найден', type: 'not_found' };
      }
      if (result.error === 'Forbidden: not owner') {
        return { text: 'это не ваш номер', type: 'forbidden' };
      }
      return { text: 'Ошибка при удалении номера', type: 'error' };
    }

    // Обработка номера
    if (this.isValidNumberFormat(text)) {
      return await this.processNumberSubmission(text, userId, false);
    }

    // Неизвестная команда
    const maxNumbers = parseInt(process.env.MAX_NUMBERS) || 999;
    return {
      text: `Отправьте номер от 001 до ${String(maxNumbers).padStart(3, '0')} или "?" для просмотра недостающих номеров`,
      type: 'info'
    };
  }

  isValidNumberFormat(text) {
    const maxNumbers = parseInt(process.env.MAX_NUMBERS) || 999;
    return /^\d{1,3}$/.test(text) && parseInt(text) >= 1 && parseInt(text) <= maxNumbers;
  }

  async processNumberSubmission(number, userId, isBot = false) {
    // Добавляем игрока в список
    if (!isBot) {
      this.storage.data.players.add(userId);
    }

    // Проверяем, есть ли уже такой номер
    if (this.storage.hasNumber(number)) {
      return {
        text: 'уже есть',
        type: 'duplicate'
      };
    }

    // Добавляем новый номер
    const result = this.storage.addNumber(number, userId);
    
    if (result.wasAdded) {
      let response = 'запомнили';
      
      // Проверяем, кратно ли 10 оставшееся количество
      if (result.remaining % 10 === 0) {
        response += `\nОсталось ${result.remaining} номеров`;
      }
      
      // Проверяем победу
      if (this.storage.isGameComplete()) {
        const maxNumbers = parseInt(process.env.MAX_NUMBERS) || 999;
        response += `\n🎉 ПОБЕДА! 🎉\nВсе ${maxNumbers} номеров найдены!`;
      }
      
      // Сохраняем данные
      await this.storage.saveData();
      
      return {
        text: response,
        type: 'success'
      };
    }

    return {
      text: 'Ошибка при добавлении номера',
      type: 'error'
    };
  }

  getMissingNumbersResponse() {
    const missingNumbers = this.storage.getFirstTenMissingNumbers();
    
    if (missingNumbers.length === 0) {
      return {
        text: 'Все номера найдены! 🎉',
        type: 'complete'
      };
    }

    const numbersList = missingNumbers.join(', ');
    return {
      text: `Первые 10 недостающих номеров:\n${numbersList}`,
      type: 'missing_numbers'
    };
  }

  getGameStats() {
    const stats = this.storage.getStats();
    const lastUpdateMoscow = new Date(stats.lastUpdate).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    return {
      text: `📊 Статистика игры:\n` +
            `Найдено номеров: ${stats.totalNumbers}\n` +
            `Осталось: ${stats.remaining}\n` +
            `Игроков: ${stats.players}\n` +
            `Последнее обновление (Мск): ${lastUpdateMoscow}`,
      type: 'stats'
    };
  }

  async resetGame() {
    this.storage.data.numbers.clear();
    this.storage.data.players.clear();
    this.storage.data.lastUpdate = new Date().toISOString();
    await this.storage.saveData();
    
    return {
      text: 'Игра сброшена. Все номера удалены.',
      type: 'reset'
    };
  }
}
