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
├── tests/             # Тесты
├── data/              # Данные игры (JSON)
├── docker/            # Docker конфигурация
├── .github/           # GitHub Actions
└── docs/              # Документация
```

## 🔧 Команды бота

- `/start` - Начало игры и правила
- `/stats` - Статистика игры
- `/help` - Справка
- `/reset` - Сброс игры (только для админов)

## 🚀 Развертывание

### GitHub Actions

Проект настроен для автоматической сборки и развертывания через GitHub Actions:

1. **Тестирование** - запускается на каждом PR
2. **Сборка** - Docker образ собирается при мерже в main
3. **Развертывание** - автоматическое развертывание в продакшн

### Переменные окружения

Установите следующие secrets в GitHub:
- `DOCKER_USERNAME` - имя пользователя Docker Hub
- `DOCKER_PASSWORD` - пароль Docker Hub

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
