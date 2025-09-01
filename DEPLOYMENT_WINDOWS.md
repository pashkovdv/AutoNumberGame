# Развертывание AutoNumberGame на Windows Server 2022

## 🎯 Обзор процесса

1. **GitHub Actions** собирает Docker образ
2. **Образ сохраняется** как артефакт GitHub
3. **Windows Server 2022** загружает артефакт и развертывает

## 📥 Загрузка образа с GitHub

### Шаг 1: Скачивание артефакта
1. Перейдите в **Actions** → **CI/CD Pipeline**
2. Выберите последний успешный build
3. Скачайте артефакт `docker-image`

### Шаг 2: Загрузка образа на Windows Server
```powershell
# Распаковка артефакта
Expand-Archive -Path "docker-image.zip" -DestinationPath "C:\temp\docker-image"

# Загрузка образа в Docker
docker load < "C:\temp\docker-image\image.tar"

# Проверка загруженного образа
docker images | findstr autonumbergame
```

## 🚀 Развертывание

### Шаг 1: Настройка окружения
```powershell
# Создание рабочей директории
New-Item -ItemType Directory -Path "C:\AutoNumberGame" -Force
Set-Location "C:\AutoNumberGame"

# Копирование docker-compose.yml и .env
# (скопируйте эти файлы с вашего компьютера)
```

### Шаг 2: Создание .env файла
```powershell
# Создание .env файла
@"
TELEGRAM_BOT_TOKEN=ваш_токен_бота
GAME_DATA_FILE=./data/game_data.json
MAX_NUMBERS=999
BOT_USERNAME=AutoNumberGameBot
"@ | Out-File -FilePath ".env" -Encoding UTF8
```

### Шаг 3: Запуск сервиса
```powershell
# Создание директорий для данных
New-Item -ItemType Directory -Path "data" -Force
New-Item -ItemType Directory -Path "logs" -Force

# Запуск сервиса
docker-compose up -d

# Проверка статуса
docker-compose ps
```

## 📊 Мониторинг

### Проверка логов
```powershell
# Просмотр логов в реальном времени
docker-compose logs -f autonumbergame

# Просмотр последних 100 строк
docker-compose logs --tail=100 autonumbergame
```

### Проверка здоровья
```powershell
# Проверка health check
docker inspect autonumbergame | Select-String -Pattern "Health"

# Статистика контейнера
docker stats autonumbergame
```

## 🔄 Обновление

### Автоматическое обновление
```powershell
# Создание скрипта обновления
@"
# update.ps1
Write-Host "🔄 Starting update..." -ForegroundColor Yellow

# Остановка сервиса
docker-compose down

# Удаление старого образа
docker rmi autonumbergame:latest

# Загрузка нового образа (повторите шаги выше)
# docker load < image.tar

# Запуск обновленного сервиса
docker-compose up -d

Write-Host "✅ Update completed!" -ForegroundColor Green
"@ | Out-File -FilePath "update.ps1" -Encoding UTF8
```

### Планировщик задач Windows
```powershell
# Создание задачи для автоматического обновления
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\AutoNumberGame\update.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$Principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "AutoNumberGame Update" -Action $Action -Trigger $Trigger -Principal $Principal
```

## 🛠️ Устранение неполадок

### Проблема: Образ не загружается
```powershell
# Проверка свободного места
Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace

# Очистка Docker
docker system prune -a
```

### Проблема: Сервис не запускается
```powershell
# Проверка логов
docker-compose logs autonumbergame

# Проверка переменных окружения
docker-compose exec autonumbergame env

# Перезапуск сервиса
docker-compose restart autonumbergame
```

### Проблема: Нет доступа к портам
```powershell
# Проверка брандмауэра
Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Docker*"}

# Открытие портов
New-NetFirewallRule -DisplayName "AutoNumberGame" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

## 📋 Чек-лист развертывания

- [ ] Docker установлен и запущен
- [ ] Артефакт скачан с GitHub
- [ ] Образ загружен в Docker
- [ ] .env файл настроен
- [ ] docker-compose.yml скопирован
- [ ] Сервис запущен
- [ ] Health check прошел
- [ ] Логи показывают успешный запуск
- [ ] Бот отвечает в Telegram

## 🔗 Полезные ссылки

- [Docker Desktop для Windows](https://docs.docker.com/desktop/install/windows-install/)
- [Docker Compose документация](https://docs.docker.com/compose/)
- [PowerShell документация](https://docs.microsoft.com/en-us/powershell/)
- [Windows Server 2022 документация](https://docs.microsoft.com/en-us/windows-server/)
