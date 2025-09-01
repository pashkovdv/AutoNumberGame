import TelegramBot from 'node-telegram-bot-api';
import { GameLogic } from '../game/gameLogic.js';
import { GameStorage } from '../storage/gameStorage.js';

export class TelegramGameBot {
  constructor(token, dataFilePath = './data/game_data.json') {
    this.bot = new TelegramBot(token, { 
      polling: true,
      polling_options: {
        timeout: 10,
        limit: 100,
        allowed_updates: ['message', 'callback_query']
      }
    });
    this.storage = new GameStorage(dataFilePath);
    this.gameLogic = new GameLogic(this.storage);
    this.lastUpdateId = 0;
    this.isRunning = false;
    this.botId = null; // ID бота будет установлен в initialize()
    
    this.setupEventHandlers();
  }

  async initialize() {
    try {
      console.log('🔧 Инициализация Telegram бота...');
      console.log('📁 Инициализация хранилища...');
      
      await this.storage.initialize();
      console.log('✅ Хранилище инициализировано');
      
      // Загружаем последний update_id из базы
      this.lastUpdateId = await this.storage.getLastUpdateId();
      console.log('📊 Последний update_id:', this.lastUpdateId);
      
      // Проверяем информацию о боте
      const botInfo = await this.getBotInfo();
      console.log('🤖 Информация о боте:', botInfo);
      
      // Запускаем polling
      this.isRunning = true;
      console.log('✅ Telegram bot initialized successfully');
      console.log('🔄 Polling активен с offset:', this.lastUpdateId);
    } catch (error) {
      console.error('❌ Failed to initialize bot:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    // Обработка команды /start (приоритетная)
    this.bot.onText(/\/start/, async (msg) => {
      console.log('📱 Получена команда /start от пользователя:', msg.from?.id, 'в чате:', msg.chat?.id);
      await this.handleStartCommand(msg);
    });

    // Обработка команды /stats
    this.bot.onText(/\/stats/, async (msg) => {
      console.log('📊 Получена команда /stats от пользователя:', msg.from?.id);
      await this.handleStatsCommand(msg);
    });

    // Обработка команды /help
    this.bot.onText(/\/help/, async (msg) => {
      console.log('❓ Получена команда /help от пользователя:', msg.from?.id);
      await this.handleHelpCommand(msg);
    });

    // Обработка команды /reset (только для администраторов)
    this.bot.onText(/\/reset/, async (msg) => {
      console.log('🔄 Получена команда /reset от пользователя:', msg.from?.id);
      await this.handleResetCommand(msg);
    });

    // Обработка команды /botstats (только для администраторов)
    this.bot.onText(/\/botstats/, async (msg) => {
      console.log('📊 Получена команда /botstats от пользователя:', msg.from?.id);
      await this.handleBotStatsCommand(msg);
    });

    // Обработка ВСЕХ остальных текстовых сообщений (но не команд)
    this.bot.on('message', async (msg) => {
      // Пропускаем команды, которые уже обработаны выше
      if (msg.text && msg.text.startsWith('/')) {
        console.log('⚠️ Команда не распознана:', msg.text);
        return;
      }

      console.log('💬 Получено сообщение:', msg.text, 'от пользователя:', msg.from?.id);
      
      try {
        await this.handleMessage(msg);
      } catch (error) {
        console.error('❌ Ошибка обработки сообщения:', error);
        await this.sendMessage(msg.chat.id, 'Произошла ошибка при обработке сообщения');
      }
    });

    // Обработка ошибок polling
    this.bot.on('polling_error', (error) => {
      this.handlePollingError(error);
    });

    // Обработка успешного подключения
    this.bot.on('polling_start', () => {
      console.log('🔄 Polling started - бот начал получать сообщения');
    });

    // Обработка успешного получения обновлений
    this.bot.on('polling_success', (updates) => {
      if (updates && updates.length > 0) {
        const lastUpdate = updates[updates.length - 1];
        this.lastUpdateId = lastUpdate.update_id;
        console.log('📊 Получено обновлений:', updates.length, 'Последний update_id:', this.lastUpdateId);
      }
    });

    console.log('✅ Event handlers настроены');
  }

  async handleMessage(msg) {
    const { text, chat, from, message_id, date } = msg;
    
    if (!text) return;

    // Проверяем, что это не бот
    if (from.is_bot) {
      console.log('🤖 Игнорируем сообщение от бота:', from.id);
      return;
    }

    // Используем from.id (ID пользователя) для всех типов чатов
    const userId = from.id.toString();
    const username = from.username || 'без username';
    
    console.log(`👤 Сообщение от: ID=${userId}, Username=${username}, Chat ID=${chat.id}, From ID=${from.id}`);
    console.log(`📱 Тип чата: ${chat.type}, is_bot=${from.is_bot}`);

    const response = await this.gameLogic.processMessage(text, userId);
    
    // Обновляем активность бота
    if (msg.update_id) {
      await this.storage.updateBotActivity(msg.update_id, new Date(date * 1000).toISOString());
    }
    
    await this.sendMessage(chat.id, response.text);
  }

  async handleStartCommand(msg) {
    const { from, chat } = msg;
    
    // Проверяем, что команда не от бота
    if (from.is_bot) {
      console.log('🤖 Игнорируем команду /start от бота');
      return;
    }

    // Используем from.id (ID пользователя) для всех типов чатов
    const userId = from.id.toString();
    const username = from.username || 'username';
    
    console.log(`🚀 Команда /start от: ID=${userId}, Username=${username}, Chat ID=${chat.id}, From ID=${from.id}`);
    console.log(`📱 Тип чата: ${chat.type}, is_bot=${from.is_bot}`);

    const welcomeMessage = 
      '🚗 Добро пожаловать в игру AutoNumberGame! 🚗\n\n' +
      'Правила игры:\n' +
      '• Отправляйте номера автомобилей от 001 до 999\n' +
      '• Если номер новый - получите "запомнили"\n' +
      '• Если номер уже есть - получите "уже есть"\n' +
      '• Отправьте "?" чтобы увидеть недостающие номера\n' +
      '• Цель: найти все 999 номеров!\n\n' +
      'Команды:\n' +
      '/stats - статистика игры\n' +
      '/help - справка\n\n' +
      'Начинайте игру! 🎮';

    await this.sendMessage(msg.chat.id, welcomeMessage);
  }

  async handleStatsCommand(msg) {
    const { from, chat } = msg;
    
    // Проверяем, что команда не от бота
    if (from.is_bot) {
      console.log('🤖 Игнорируем команду /stats от бота');
      return;
    }

    try {
      const stats = this.gameLogic.getGameStats();
      const userStats = await this.storage.getUserStatsWithUsernames(this.bot);
      
      let statsMessage = stats.text + '\n\n';
      
      if (userStats.length > 0) {
        statsMessage += '🏆 Топ игроков:\n';
        userStats.forEach((userStat, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎯';
          statsMessage += `${medal} ${userStat.displayName} (@${userStat.username}): ${userStat.count} номеров\n`;
        });
      } else {
        statsMessage += '📝 Пока никто не нашел ни одного номера';
      }
      
      await this.sendMessage(chat.id, statsMessage);
    } catch (error) {
      console.error('❌ Ошибка получения статистики:', error);
      // Fallback к простой статистике
      const stats = this.gameLogic.getGameStats();
      await this.sendMessage(chat.id, stats.text);
    }
  }

  async handleHelpCommand(msg) {
    const { from, chat } = msg;
    
    // Проверяем, что команда не от бота
    if (from.is_bot) {
      console.log('🤖 Игнорируем команду /help от бота');
      return;
    }

    const helpMessage = 
      '📖 Справка по игре AutoNumberGame\n\n' +
      '🎯 Цель: Собрать все номера автомобилей от 001 до 999\n\n' +
      '📝 Как играть:\n' +
      '1. Отправьте любой номер от 1 до 999\n' +
      '2. Получите ответ "запомнили" или "уже есть"\n' +
      '3. Каждые 10 оставшихся номеров бот сообщит прогресс\n' +
      '4. Используйте "?" для просмотра недостающих номеров\n\n' +
      '🏆 Победа: Когда все 999 номеров будут найдены!\n\n' +
      'Команды:\n' +
      '/start - начало игры\n' +
      '/stats - статистика\n' +
      '/help - эта справка';

    await this.sendMessage(chat.id, helpMessage);
  }

  async handleResetCommand(msg) {
    const { from, chat } = msg;
    
    // Простая проверка на администратора (можно улучшить)
    const userId = from.id.toString();
    
    // В реальном приложении здесь должна быть проверка прав администратора
    if (userId === process.env.ADMIN_USER_ID || process.env.NODE_ENV === 'development') {
      const result = await this.gameLogic.resetGame();
      await this.sendMessage(chat.id, result.text);
    } else {
      await this.sendMessage(chat.id, 'У вас нет прав для выполнения этой команды');
    }
  }

  async handleBotStatsCommand(msg) {
    const { from, chat } = msg;
    
    // Простая проверка на администратора
    const userId = from.id.toString();
    
    if (userId === process.env.ADMIN_USER_ID || process.env.NODE_ENV === 'development') {
      const stats = await this.getBotStats();
      if (stats) {
        const statsMessage = 
          '🤖 Статистика бота:\n\n' +
          `📊 Последний update_id: ${stats.bot.lastUpdateId}\n` +
          `🕐 Последняя активность: ${new Date(stats.bot.lastActivity).toLocaleString('ru-RU')}\n` +
          `⏱️ Время работы: ${Math.floor(stats.bot.uptime / 60)} мин\n` +
          `💬 Обработано сообщений: ${stats.bot.totalMessagesProcessed}\n` +
          `🔄 Статус: ${stats.bot.isRunning ? 'Работает' : 'Остановлен'}\n\n` +
          '🎮 Статистика игры:\n' +
          `📈 Найдено номеров: ${stats.game.totalNumbers}\n` +
          `⏳ Осталось: ${stats.game.remaining}\n` +
          `👥 Игроков: ${stats.game.players}`;
        
        await this.sendMessage(chat.id, statsMessage);
      } else {
        await this.sendMessage(chat.id, '❌ Ошибка получения статистики');
      }
    } else {
      await this.sendMessage(chat.id, 'У вас нет прав для выполнения этой команды');
    }
  }

  async sendMessage(chatId, text) {
    try {
      console.log('📤 Отправляем сообщение в чат:', chatId);
      console.log('📝 Текст:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      
      await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
      console.log('✅ Сообщение успешно отправлено в чат:', chatId);
    } catch (error) {
      console.error('❌ Ошибка отправки сообщения в чат', chatId, ':', error);
    }
  }

  async stop() {
    try {
      this.isRunning = false;
      if (this.bot) {
        await this.bot.stopPolling();
        console.log('🛑 Polling остановлен');
      }
      
      // Сохраняем текущее состояние
      await this.storage.saveBotState({
        lastUpdateId: this.lastUpdateId,
        lastMessageTime: new Date().toISOString()
      });
      
      console.log('✅ Состояние бота сохранено');
    } catch (error) {
      console.error('❌ Ошибка при остановке бота:', error);
    }
  }

  getBotInfo() {
    return this.bot.getMe();
  }

  // Обработка ошибок polling
  async handlePollingError(error) {
    if (error.code === 'ETELEGRAM') {
      if (error.response.statusCode === 409) {
        console.log('⚠️ Конфликт: другой экземпляр бота уже запущен');
        await this.stop();
      } else if (error.response.statusCode === 429) {
        console.log('⏳ Rate limit, ждем 60 секунд...');
        setTimeout(() => this.initialize(), 60000);
      } else {
        console.error('❌ Telegram API error:', error.response.statusCode, error.response.body);
      }
    } else {
      console.error('❌ Неизвестная ошибка polling:', error);
    }
  }

  // Получение статистики бота
  async getBotStats() {
    try {
      const botState = await this.storage.getBotState();
      const gameStats = this.storage.getStats();
      
      return {
        bot: {
          lastUpdateId: botState.lastUpdateId,
          lastActivity: botState.lastActivity,
          uptime: botState.uptime,
          totalMessagesProcessed: botState.totalMessagesProcessed,
          isRunning: this.isRunning
        },
        game: gameStats
      };
    } catch (error) {
      console.error('❌ Ошибка получения статистики:', error);
      return null;
    }
  }
}
