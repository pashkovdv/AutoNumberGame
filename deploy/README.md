# 🚀 AutoNumberGame Deployment

## 🚨 ВАЖНО: Безопасность

**Все секреты полностью убраны из кода!** Даже значения по умолчанию в скриптах заменены на плейсхолдеры. Репозиторий теперь полностью безопасен для публичного использования.

## Безопасность и Конфигурация

Все секреты и конфиденциальные данные хранятся в файле `deploy.env`, который:
- ❌ **НЕ** отслеживается Git (добавлен в .gitignore)
- ✅ Автоматически читается скриптами
- 🔒 Содержит только плейсхолдеры по умолчанию

## 👋 Требования

- Windows Server 2022 (или Windows 10/11)
- WSL2 с установленным Ubuntu и Docker
- GitHub Personal Access Token с правами `read:packages`
- Telegram Bot Token

**Важно:** Telegram бот работает через long polling и не требует открытых портов или настройки брандмауэра!

## 🎯 Быстрый старт

### 1. Настройка deploy.env

1. **Создайте файл `deploy.env`** в папке `deploy/`:
   ```bash
   # Скопируйте содержимое из примера выше или создайте новый файл
   cp deploy.env.example deploy.env
   ```

2. **Заполните реальные значения**:
   ```bash
   # GitHub параметры
   GITHUB_USERNAME=ваш_github_username
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxx

   # Telegram Bot параметры
   TELEGRAM_BOT_TOKEN=ваш_telegram_bot_token
   BOT_USERNAME=ваш_bot_username

   # И другие параметры...
   ```

### 2. Подготовка GitHub

1. Создайте Personal Access Token:
   - Перейдите в GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Нажмите "Generate new token (classic)"
   - Выберите права: `read:packages` (для чтения образов из GitHub Container Registry)
   - Сохраните токен

2. Убедитесь, что CI/CD настроен:
   - Проверьте файл `.github/workflows/ci.yml`
   - При push в main ветку образ автоматически публикуется в `ghcr.io/yourusername/autonumbergame`

### 3. Запуск развертывания

```powershell
# Откройте PowerShell от имени администратора
cd C:\dev\AutoNumberGame\deploy

# Запустите нужный скрипт
.\DeployToExistingWSL.ps1      # Для существующего WSL с Docker
# или
.\WindowsDeployAutoNumberGame.ps1  # Для полной установки
```

## 🔒 Как работает безопасность

### Автоматическая загрузка конфигурации

Скрипты автоматически:
1. **Ищут файл `deploy.env`** в той же папке
2. **Читают переменные окружения** из файла
3. **Используют реальные значения** если файл найден
4. **Показывают предупреждение** и используют плейсхолдеры если файл не найден

### Пример deploy.env
```bash
# GitHub параметры
GITHUB_USERNAME=мой_github_аккаунт
GITHUB_TOKEN=ghp_abcd1234efgh5678

# Telegram Bot параметры
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
BOT_USERNAME=MyAwesomeBot

# Windows пользователь параметры
WINDOWS_USERNAME=Administrator
WINDOWS_PASSWORD=StrongPassword123!

# Ubuntu пользователь параметры
UBUNTU_USERNAME=ubuntuuser
UBUNTU_PASSWORD=SecurePass456@

# Сетевые настройки
EXTERNAL_IP=192.168.1.100
APP_PORT=3333

# WSL настройки
WSL_DISTRO_NAME=UbuntuAutoNumber
EXISTING_WSL_DISTRO_NAME=UbuntuDocker
```

## 📦 Что делает скрипт

1. **Проверяет окружение:**
   - Наличие WSL дистрибутива
   - Установку Docker в WSL

2. **Развертывает в Docker:**
   - Логинится в GitHub Container Registry
   - Скачивает последний образ `ghcr.io/yourusername/autonumbergame:latest`
   - Запускает контейнер AutoNumberGame Telegram Bot
   - Запускает Watchtower для автообновления (проверка каждые 5 минут)

## 🔄 Автообновление

Watchtower автоматически:
- Проверяет обновления образа каждые 5 минут
- Скачивает новую версию при появлении
- Перезапускает контейнер с сохранением данных
- Удаляет старые образы

## 🛠️ Полезные команды

### Управление контейнерами

```bash
# Войти в WSL
wsl -d UbuntuDocker

# Посмотреть логи бота
wsl -d UbuntuDocker docker logs autonumbergame

# Посмотреть логи Watchtower
wsl -d UbuntuDocker docker logs watchtower-autonumber

# Статус контейнеров
wsl -d UbuntuDocker docker ps

# Перезапустить бота
wsl -d UbuntuDocker docker restart autonumbergame

# Остановить все
wsl -d UbuntuDocker docker stop autonumbergame watchtower-autonumber
```

### Обновление вручную

```bash
# Войти в WSL
wsl -d UbuntuDocker

# Скачать последний образ
docker pull ghcr.io/yourusername/autonumbergame:latest

# Перезапустить контейнер
docker restart autonumbergame
```

## 📁 Структура данных

```
WSL (Ubuntu):
~/autonumbergame/
├── data/
│   └── game_data.json  # Данные игры (сохраняются между обновлениями)
└── .docker/
    └── watchtower-autonumber.json  # Конфигурация для доступа к GHCR
```

## 🔒 Безопасность

- GitHub токен хранится только в WSL (в файле конфигурации Watchtower)
- Telegram токен передается как переменная окружения контейнера
- Данные игры сохраняются в volume и не теряются при обновлениях
- Контейнер запускается от непривилегированного пользователя

## ❓ Устранение неполадок

### Бот не отвечает
1. Проверьте логи: `wsl -d UbuntuDocker docker logs autonumbergame`
2. Убедитесь, что токен бота правильный
3. Проверьте, что контейнер запущен: `wsl -d UbuntuDocker docker ps`
4. Проверьте, что у бота есть доступ к интернету для Telegram API

### Watchtower не обновляет
1. Проверьте логи: `wsl -d UbuntuDocker docker logs watchtower-autonumber`
2. Убедитесь, что GitHub токен имеет права `read:packages`
3. Проверьте, что образ публикуется в GHCR при push в main

## 📊 Мониторинг

### Проверка статуса
```bash
# Статус всех контейнеров проекта
wsl -d UbuntuDocker docker ps --filter "name=autonumber"

# Использование ресурсов
wsl -d UbuntuDocker docker stats autonumbergame --no-stream

# Последние события Watchtower
wsl -d UbuntuDocker docker logs watchtower-autonumber --tail 20
```

## 🆘 Поддержка

При возникновении проблем:
1. Проверьте логи контейнеров
2. Убедитесь, что все токены и настройки правильные
3. Проверьте [Issues](https://github.com/yourusername/AutoNumberGame/issues) проекта
