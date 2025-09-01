# 🚗 AutoNumberGame - Telegram Bot Game

Игра в номера автомобилей для Telegram бота. Игроки совместно собирают номера от 001 до 999.

## 🎯 Описание игры

- **Цель**: Собрать все 999 номеров автомобилей
- **Правила**: Игроки отправляют номера от 001 до 999
- **Ответы**: 
  - Новый номер → "запомнили"
  - Повторный номер → "уже есть"
  - Каждые 10 номеров → "Осталось ХХ0 номеров"
  - Запрос "?" → показ 10 недостающих номеров
  - Все найдено → "🎉 ПОБЕДА! 🎉"

## 🚀 Быстрый старт

### Предварительные требования

- Node.js >= 22
- Docker (опционально)
- Telegram Bot Token

### 1. Клонирование репозитория

```bash
git clone https://github.com/yourusername/AutoNumberGame.git
cd AutoNumberGame
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка окружения

Скопируйте файл конфигурации:
```bash
cp env.example .env
```

Отредактируйте `.env` файл:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
GAME_DATA_FILE=./data/game_data.json
MAX_NUMBERS=999
BOT_USERNAME=your_bot_username
```

### 4. Запуск

#### Локально
```bash
npm start
```

#### В режиме разработки
```bash
npm run dev
```

#### В Docker
```bash
docker-compose up -d
```

## 📚 Документация

Подробная документация проекта доступна в папке [`.cursor/rules/`](.cursor/rules/):

- **[🏗️ Архитектура](.cursor/rules/architecture.mdc)** - Обзор системы и компонентов
- **[🔌 API и интерфейсы](.cursor/rules/api.mdc)** - Telegram Bot API и внутренние интерфейсы
- **[🚀 Развертывание](.cursor/rules/deployment.mdc)** - Docker, CI/CD и DevOps
- **[🧪 Тестирование](.cursor/rules/testing.mdc)** - Стратегия тестирования и покрытие
- **[📋 Главная документация](.cursor/rules/project.mdc)** - Полное описание проекта

## 🧪 Тестирование

```bash
# Запуск всех тестов
npm test

# Тесты в режиме наблюдения
npm run test:watch

# Покрытие тестами
npm run test:coverage

# Проверка линтера
npm run lint
```

## 🐳 Docker

### Сборка образа
```bash
docker build -t autonumbergame .
```

### Запуск контейнера
```bash
docker run -d \
  --name autonumbergame \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -v $(pwd)/data:/app/data \
  autonumbergame
```

### Docker Compose
```bash
# Продакшн
docker-compose up -d

# Разработка
docker-compose --profile dev up -d
```

## 📁 Структура проекта

```
AutoNumberGame/
├── src/
│   ├── bot/           # Telegram бот
│   ├── game/          # Игровая логика
│   ├── storage/       # Хранение данных
│   └── index.js       # Главный файл
├── .cursor/rules/     # 📚 Подробная документация MDC
│   ├── project.mdc    # Главная документация
│   ├── architecture.mdc # Архитектура системы
│   ├── api.mdc        # API и интерфейсы
│   ├── deployment.mdc # Развертывание и DevOps
│   └── testing.mdc    # Стратегия тестирования
├── data/              # Данные игры (JSON)
├── .github/           # GitHub Actions
└── coverage/          # Отчеты о покрытии тестами
```

## 🔧 Команды бота

- `/start` - Начало игры и правила
- `/stats` - Статистика игры
- `/help` - Справка
- `/reset` - Сброс игры (только для админов)

## 🚀 Развертывание

### GitHub Actions

Проект настроен для автоматической сборки через GitHub Actions:

1. **Тестирование** - запускается на каждом PR
2. **Сборка** - Docker образ собирается при мерже в main
3. **Артефакт** - образ сохраняется как GitHub артефакт

### Windows Server 2022

**Архитектура развертывания:**
- GitHub → Docker образ → Windows Server 2022
- Образ загружается как артефакт (без Docker Hub)
- Развертывание через PowerShell скрипты

📖 **Подробная инструкция**: [DEPLOYMENT_WINDOWS.md](DEPLOYMENT_WINDOWS.md)

## 📊 Мониторинг

- **Health Check**: Проверка состояния сервиса каждые 30 секунд
- **Логи**: Все действия логируются в консоль
- **Метрики**: Статистика игры доступна через команду `/stats`

## 🤝 Разработка

### Добавление новых функций

1. Создайте feature branch
2. Напишите код с тестами
3. Убедитесь, что все тесты проходят
4. Создайте Pull Request

### Стандарты кода

- ESLint для проверки стиля
- Jest для тестирования
- Покрытие тестами >= 80%
- ES модули (ESM)

## 📝 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🆘 Поддержка

Если у вас есть вопросы или проблемы:

1. Проверьте [Issues](https://github.com/yourusername/AutoNumberGame/issues)
2. Создайте новый Issue
3. Опишите проблему подробно

## 🎉 Благодарности

Спасибо всем участникам проекта AutoNumberGame!

---

**Удачной игры! 🚗🎮**
