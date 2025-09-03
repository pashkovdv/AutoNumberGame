# AutoNumberGame Deployment Script for Existing WSL2 with Docker
# Развертывание Telegram бота AutoNumberGame в существующем WSL дистрибутиве

# ===== НАСТРОЙКИ ПРОЕКТА =====
# Загружаем переменные из deploy.env
$envFilePath = Join-Path $PSScriptRoot "deploy.env"
if (Test-Path $envFilePath) {
    $envContent = Get-Content $envFilePath
    foreach ($line in $envContent) {
        if ($line -match '^([^=]+)=(.*)$' -and -not $line.StartsWith("#")) {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            if ($value.StartsWith('"') -and $value.EndsWith('"')) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            New-Variable -Name $key -Value $value -Scope Script -Force
        }
    }
    Write-Host "✓ Конфигурация загружена из deploy.env" -ForegroundColor Green
} else {
    Write-Warning "Файл deploy.env не найден. Используются значения по умолчанию."
}

# GitHub параметры для AutoNumberGame
$github_username = if ($GITHUB_USERNAME) { $GITHUB_USERNAME } else { "YOUR_GITHUB_USERNAME" }
$github_token = if ($GITHUB_TOKEN) { $GITHUB_TOKEN } else { "YOUR_GITHUB_TOKEN_HERE" }

# Telegram Bot настройки
$telegram_bot_token = if ($TELEGRAM_BOT_TOKEN) { $TELEGRAM_BOT_TOKEN } else { "YOUR_TELEGRAM_BOT_TOKEN_HERE" }
$bot_username = if ($BOT_USERNAME) { $BOT_USERNAME } else { "YOUR_BOT_USERNAME" }

# Имя существующего WSL дистрибутива с Docker
$wslDistroName = if ($EXISTING_WSL_DISTRO_NAME) { $EXISTING_WSL_DISTRO_NAME } else { "YOUR_EXISTING_WSL_DISTRO_NAME" }

# Имена контейнеров
$containerName = "autonumbergame"
$watchtowerName = "watchtower-autonumber"

# ===== КОНЕЦ НАСТРОЕК =====

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  AutoNumberGame Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка прав администратора
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "Этот скрипт требует прав администратора. Запустите PowerShell от имени администратора."
    exit 1
}

# Функция для проверки существования WSL дистрибутива
function Test-WslDistro {
    param([string]$distroName)
    
    $wslList = wsl -l -q 2>$null
    if ($wslList -contains $distroName) {
        return $true
    }
    return $false
}

# Функция для выполнения команд в WSL
function Invoke-WslCommand {
    param(
        [string]$distro,
        [string]$command
    )
    
    $result = wsl -d $distro -e bash -c $command 2>&1
    return $result
}

Write-Host "🔍 Проверка существующего WSL дистрибутива..." -ForegroundColor Yellow

# Проверяем наличие WSL дистрибутива
if (-not (Test-WslDistro $wslDistroName)) {
    Write-Error "WSL дистрибутив '$wslDistroName' не найден!"
    Write-Host ""
    Write-Host "Доступные дистрибутивы:" -ForegroundColor Yellow
    wsl -l -v
    Write-Host ""
    Write-Host "Укажите правильное имя дистрибутива в переменной `$wslDistroName" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ WSL дистрибутив '$wslDistroName' найден" -ForegroundColor Green

# Проверяем Docker в WSL
Write-Host "🔍 Проверка Docker в WSL..." -ForegroundColor Yellow
$dockerVersion = Invoke-WslCommand $wslDistroName "docker --version"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker не установлен в WSL дистрибутиве '$wslDistroName'"
    exit 1
}
Write-Host "✓ Docker найден: $dockerVersion" -ForegroundColor Green

Write-Host "`n🚀 Развертывание AutoNumberGame Telegram Bot в WSL..." -ForegroundColor Yellow

# Создаем bash скрипт для развертывания
$deployScript = @'
#!/bin/bash
set -euo pipefail

echo "🔧 Настройка AutoNumberGame..."

# Переменные
GITHUB_USERNAME="__GITHUB_USERNAME__"
GITHUB_TOKEN="__GITHUB_TOKEN__"
TELEGRAM_BOT_TOKEN="__TELEGRAM_BOT_TOKEN__"
BOT_USERNAME="__BOT_USERNAME__"
CONTAINER_NAME="__CONTAINER_NAME__"
WATCHTOWER_NAME="__WATCHTOWER_NAME__"

# Проверяем запущен ли Docker
if ! docker info >/dev/null 2>&1; then
    echo "Запускаем Docker..."
    sudo service docker start
    sleep 5
fi

# Проверяем доступность образа без входа в GHCR
echo "📦 Проверка доступа к GitHub Container Registry (ghcr.io)..."
IMAGE_REPO="ghcr.io/$GITHUB_USERNAME/autonumbergame:latest"
echo "Image: $IMAGE_REPO"
if docker pull "$IMAGE_REPO"; then
  echo "✅ Pull succeeded without additional login"
else
  echo "ℹ️ Pull failed, attempting login to GHCR..."
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin || {
      echo "❌ Login to ghcr.io failed. Check token scope read:packages and SSO if using org packages.";
      exit 1;
    }
    docker pull "$IMAGE_REPO" || {
      echo "❌ Pull failed after login. Verify image path and permissions: $IMAGE_REPO";
      exit 1;
    }
  else
    echo "❌ GITHUB_TOKEN is not provided and pull failed. Provide token or make image public: $IMAGE_REPO";
    exit 1;
  fi
fi

# Подготовка конфигурации для Watchtower (опционально)
echo "📝 Подготовка конфигурации Watchtower..."
if [ -n "${GITHUB_TOKEN:-}" ]; then
  mkdir -p ~/.docker
  if [ ! -f ~/.docker/watchtower-autonumber.json ]; then
    cat > ~/.docker/watchtower-autonumber.json << EOF
{
  "auths": {
    "ghcr.io": {
      "auth": "$(echo -n "$GITHUB_USERNAME:$GITHUB_TOKEN" | base64)"
    }
  }
}
EOF
    chmod 600 ~/.docker/watchtower-autonumber.json
    echo "✅ Watchtower auth config created"
  else
    echo "ℹ️ Watchtower config already exists, leaving as is"
  fi
else
  echo "ℹ️ GITHUB_TOKEN not provided — skipping Watchtower auth config creation"
fi

# Создаем директорию для данных
echo "📁 Создание директории для данных..."
mkdir -p ~/autonumbergame/data
chmod 755 ~/autonumbergame/data

# Останавливаем и удаляем старые контейнеры если есть
echo "🛑 Остановка старых контейнеров (если есть)..."
docker stop $CONTAINER_NAME $WATCHTOWER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME $WATCHTOWER_NAME 2>/dev/null || true

# Образ проверен/загружен на предыдущем шаге
echo "⬇️ Образ AutoNumberGame доступен: $IMAGE_REPO"

# Запускаем контейнер AutoNumberGame (без портов - бот работает через Telegram API)
echo "▶️ Запуск AutoNumberGame Telegram Bot..."
docker run -d \
  --name $CONTAINER_NAME \
  --restart always \
  -e TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
  -e BOT_USERNAME="$BOT_USERNAME" \
  -e NODE_ENV=production \
  -e GAME_DATA_FILE=/app/data/game_data.json \
  -e MAX_NUMBERS=999 \
  -v ~/autonumbergame/data:/app/data \
  "$IMAGE_REPO"

# Запускаем Watchtower для автообновления
echo "🔄 Запуск Watchtower для автообновления..."
if [ -f ~/.docker/watchtower-autonumber.json ]; then
  docker run -d \
    --name $WATCHTOWER_NAME \
    --restart always \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v ~/.docker/watchtower-autonumber.json:/config.json \
    -e DOCKER_CONFIG=/ \
    -e WATCHTOWER_POLL_INTERVAL=300 \
    containrrr/watchtower \
    --cleanup \
    --remove-volumes \
    $CONTAINER_NAME
else
  docker run -d \
    --name $WATCHTOWER_NAME \
    --restart always \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e WATCHTOWER_POLL_INTERVAL=300 \
    containrrr/watchtower \
    --cleanup \
    --remove-volumes \
    $CONTAINER_NAME
fi

echo ""
echo "✅ Развертывание завершено!"
echo ""

# Проверяем статус контейнеров
echo "📊 Статус контейнеров:"
docker ps --filter "name=$CONTAINER_NAME" --filter "name=$WATCHTOWER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "📍 AutoNumberGame Telegram Bot запущен!"
echo "🤖 Бот работает через Telegram API (не требует открытых портов)"
echo "🔄 Watchtower проверяет обновления каждые 5 минут"
'@

# Сохраняем скрипт во временный файл с Unix переносами строк
$tempScriptPath = [System.IO.Path]::GetTempFileName()
# Конвертируем в Unix формат (LF вместо CRLF)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Подставляем значения переменных в плейсхолдеры
$deployScriptPrepared = $deployScript
$deployScriptPrepared = $deployScriptPrepared.Replace('__GITHUB_USERNAME__', $github_username)
$deployScriptPrepared = $deployScriptPrepared.Replace('__GITHUB_TOKEN__', $github_token)
$deployScriptPrepared = $deployScriptPrepared.Replace('__TELEGRAM_BOT_TOKEN__', $telegram_bot_token)
$deployScriptPrepared = $deployScriptPrepared.Replace('__BOT_USERNAME__', $bot_username)
$deployScriptPrepared = $deployScriptPrepared.Replace('__CONTAINER_NAME__', $containerName)
$deployScriptPrepared = $deployScriptPrepared.Replace('__WATCHTOWER_NAME__', $watchtowerName)

[System.IO.File]::WriteAllText($tempScriptPath, $deployScriptPrepared.Replace("`r`n", "`n"), $utf8NoBom)

# Копируем скрипт в WSL
$wslScriptPath = "/tmp/deploy_autonumber.sh"
$windowsPath = $tempScriptPath.Replace('\', '/')
$windowsPath = "/mnt/" + $windowsPath.Substring(0,1).ToLower() + $windowsPath.Substring(2)

Write-Host "📝 Копирование скрипта развертывания в WSL..." -ForegroundColor Yellow
Invoke-WslCommand $wslDistroName "cp '$windowsPath' $wslScriptPath && chmod +x $wslScriptPath"

# Дополнительно конвертируем через dos2unix если доступен
Invoke-WslCommand $wslDistroName "which dos2unix > /dev/null 2>&1 && dos2unix $wslScriptPath || true"

# Выполняем скрипт развертывания
Write-Host "🚀 Выполнение развертывания..." -ForegroundColor Yellow
Write-Host ""
$deployResult = wsl -d $wslDistroName bash $wslScriptPath

# Проверяем результат
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО УСПЕШНО!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📦 Проект: AutoNumberGame Telegram Bot" -ForegroundColor Cyan
    Write-Host "🤖 Бот активен и работает через Telegram API" -ForegroundColor Cyan
    Write-Host "💬 Найдите бота в Telegram: @$bot_username" -ForegroundColor Cyan
    Write-Host "🔄 Автообновление через Watchtower включено (каждые 5 минут)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Полезные команды:" -ForegroundColor Yellow
    Write-Host "  Войти в WSL: wsl -d $wslDistroName" -ForegroundColor White
    Write-Host "  Логи бота: wsl -d $wslDistroName docker logs $containerName" -ForegroundColor White
    Write-Host "  Логи Watchtower: wsl -d $wslDistroName docker logs $watchtowerName" -ForegroundColor White
    Write-Host "  Статус: wsl -d $wslDistroName docker ps" -ForegroundColor White
    Write-Host "  Перезапуск: wsl -d $wslDistroName docker restart $containerName" -ForegroundColor White
    Write-Host "  Остановка: wsl -d $wslDistroName docker stop $containerName $watchtowerName" -ForegroundColor White
    Write-Host ""
} else {
    Write-Error "Развертывание завершилось с ошибкой. Проверьте вывод выше."
    exit 1
}

# Очищаем временный файл
Remove-Item -Path $tempScriptPath -Force -ErrorAction SilentlyContinue

Write-Host "Нажмите Enter для завершения..." -ForegroundColor Yellow
Read-Host
