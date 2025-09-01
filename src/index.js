console.log('🚀 Начинаем загрузку модулей...');

import dotenv from 'dotenv';
console.log('✅ dotenv загружен');

import { TelegramGameBot } from './bot/telegramBot.js';
console.log('✅ TelegramGameBot загружен');

// Загружаем переменные окружения
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

console.log('🔧 Настройка путей...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('📁 __filename:', __filename);
console.log('📁 __dirname:', __dirname);

// Загружаем .env файл из корня проекта
const envPath = join(__dirname, '..', '.env');
console.log('📁 Путь к .env файлу:', envPath);

try {
  dotenv.config({ path: envPath });
  console.log('✅ .env файл загружен');
} catch (error) {
  console.error('❌ Ошибка загрузки .env:', error);
}

async function main() {
  console.log('🚀 Функция main() запущена');
  
  try {
    // Отладочная информация о переменных окружения
    console.log('🔍 Проверка переменных окружения...');
    
    // Проверяем наличие токена бота
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN не установлен в переменных окружения');
    }

    console.log('🚀 Запуск AutoNumberGame Telegram Bot...');
    console.log('🔑 Токен бота:', token.substring(0, 10) + '...');
    
    // Создаем и инициализируем бота
    const bot = new TelegramGameBot(token);
    console.log('🔧 Создание экземпляра бота...');
    
    await bot.initialize();
    
    console.log('✅ Бот успешно запущен и готов к работе!');
    console.log('📱 Используйте команду /start в Telegram для начала игры');
    console.log('💡 Отправьте любой номер от 001 до 999 для тестирования');
    
    // Обработка сигналов завершения
    process.on('SIGINT', async () => {
      console.log('\n🛑 Получен сигнал SIGINT, завершаем работу...');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Получен сигнал SIGTERM, завершаем работу...');
      await bot.stop();
      process.exit(0);
    });

    // Обработка необработанных ошибок
    process.on('uncaughtException', (error) => {
      console.error('❌ Необработанная ошибка:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('❌ Необработанное отклонение промиса:', reason);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Ошибка запуска приложения:', error.message);
    process.exit(1);
  }
}

// Запускаем приложение
console.log('🔍 Проверяем условие запуска...');
console.log('🔍 import.meta.url:', import.meta.url);
console.log('🔍 process.argv[1]:', process.argv[1]);

// Нормализуем пути для корректного сравнения
const normalizedMetaUrl = fileURLToPath(import.meta.url).replace(/\\/g, '/');
const normalizedArgv = process.argv[1].replace(/\\/g, '/');
console.log('🔍 Нормализованный import.meta.url:', normalizedMetaUrl);
console.log('🔍 Нормализованный process.argv[1]:', normalizedArgv);
console.log('🔍 Условие выполняется:', normalizedMetaUrl === normalizedArgv);

if (normalizedMetaUrl === normalizedArgv) {
  console.log('🚀 Запускаем main()...');
  main().catch(error => {
    console.error('❌ Критическая ошибка в main():', error);
    process.exit(1);
  });
} else {
  console.log('⚠️ Условие не выполнилось, main() не запускается');
}
