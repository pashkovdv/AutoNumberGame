import TelegramBot from 'node-telegram-bot-api';
import { GameLogic } from '../game/gameLogic.js';
import { GameStorage } from '../storage/gameStorage.js';

export class TelegramGameBot {
  constructor(token, dataFilePath = './data/game_data.json') {
    this.bot = new TelegramBot(token, { polling: true });
    this.storage = new GameStorage(dataFilePath);
    this.gameLogic = new GameLogic(this.storage);
    
    this.setupEventHandlers();
  }

  async initialize() {
    try {
      console.log('🔧 Инициализация Telegram бота...');
      console.log('📁 Инициализация хранилища...');
      
      await this.storage.initialize();
      console.log('✅ Хранилище инициализировано');
      
      // Проверяем информацию о боте
      const botInfo = await this.getBotInfo();
      console.log('🤖 Информация о боте:', botInfo);
      
      console.log('✅ Telegram bot initialized successfully');
      console.log('🔄 Ожидаем сообщения...');
    } catch (error) {
      console.error('❌ Failed to initialize bot:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    // Обработка команды /start (приоритетная)
    this.bot.onText(/\/start/, async (msg) => {
      console.log('📱 Получена команда /start от пользователя:', msg.from?.id);
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
      console.error('❌ Polling error:', error);
    });

    // Обработка успешного подключения
    this.bot.on('polling_start', () => {
      console.log('🔄 Polling started - бот начал получать сообщения');
    });

    console.log('✅ Event handlers настроены');
  }

  async handleMessage(msg) {
    const { text, chat, from } = msg;
    
    if (!text) return;

    const userId = from.id.toString();
    const response = await this.gameLogic.processMessage(text, userId);
    
    await this.sendMessage(chat.id, response.text);
  }

  async handleStartCommand(msg) {
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
    const stats = this.gameLogic.getGameStats();
    await this.sendMessage(msg.chat.id, stats.text);
  }

  async handleHelpCommand(msg) {
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

    await this.sendMessage(msg.chat.id, helpMessage);
  }

  async handleResetCommand(msg) {
    // Простая проверка на администратора (можно улучшить)
    const userId = msg.from.id.toString();
    
    // В реальном приложении здесь должна быть проверка прав администратора
    if (userId === process.env.ADMIN_USER_ID || process.env.NODE_ENV === 'development') {
      const result = await this.gameLogic.resetGame();
      await this.sendMessage(msg.chat.id, result.text);
    } else {
      await this.sendMessage(msg.chat.id, 'У вас нет прав для выполнения этой команды');
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
      await this.bot.stopPolling();
      console.log('Bot stopped');
    } catch (error) {
      console.error('Error stopping bot:', error);
    }
  }

  getBotInfo() {
    return this.bot.getMe();
  }
}
