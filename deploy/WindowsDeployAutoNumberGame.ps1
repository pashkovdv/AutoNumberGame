# AutoNumberGame Deployment Script for Windows Server with WSL2
# Автоматическое развертывание Telegram бота через Docker в WSL2

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

# Параметры пользователя Windows
$Username = if ($WINDOWS_USERNAME) { $WINDOWS_USERNAME } else { "YOUR_WINDOWS_USERNAME" }
$Password = if ($WINDOWS_PASSWORD) { $WINDOWS_PASSWORD } else { "YOUR_WINDOWS_PASSWORD" }

# Параметры пользователя Ubuntu
$usernameUbuntu = if ($UBUNTU_USERNAME) { $UBUNTU_USERNAME } else { "YOUR_UBUNTU_USERNAME" }
$passwordUbuntu = if ($UBUNTU_PASSWORD) { $UBUNTU_PASSWORD } else { "YOUR_UBUNTU_PASSWORD" }

# Параметры GitHub для AutoNumberGame
$github_username = if ($GITHUB_USERNAME) { $GITHUB_USERNAME } else { "YOUR_GITHUB_USERNAME" }
$github_token = if ($GITHUB_TOKEN) { $GITHUB_TOKEN } else { "YOUR_GITHUB_TOKEN_HERE" }

# Telegram Bot Token
$telegram_bot_token = if ($TELEGRAM_BOT_TOKEN) { $TELEGRAM_BOT_TOKEN } else { "YOUR_TELEGRAM_BOT_TOKEN_HERE" }
$bot_username = if ($BOT_USERNAME) { $BOT_USERNAME } else { "YOUR_BOT_USERNAME" }

# Имя дистрибутива WSL
$wslDistroName = if ($WSL_DISTRO_NAME) { $WSL_DISTRO_NAME } else { "YOUR_WSL_DISTRO_NAME" }

# Сетевые настройки
$appPort = if ($APP_PORT) { $APP_PORT } else { "YOUR_APP_PORT" }
$externalIP = if ($EXTERNAL_IP) { $EXTERNAL_IP } else { "YOUR_EXTERNAL_IP" }

# Проверка прав администратора
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "Этот скрипт требует прав администратора. Запустите PowerShell от имени администратора."
    exit 1
}

# Проверка обновлений WSL
Write-Host "Проверка обновлений WSL..."
try {
    $updateInfo = wsl --update --status
    if ($updateInfo -match "Последняя установленная версия: (.+)") {
        $currentVersion = $matches[1]
        Write-Host "Текущая версия WSL: $currentVersion"
        
        # Проверяем наличие обновлений
        $updateCheck = wsl --update --web-download
        if ($LASTEXITCODE -eq 0) {
            Write-Host "WSL успешно обновлен"
            # Перезапускаем WSL после обновления
            wsl --shutdown
            Start-Sleep -Seconds 5
        }
    } else {
        Write-Host "Не удалось определить версию WSL, выполняем обновление..."
        wsl --update --web-download
        if ($LASTEXITCODE -eq 0) {
            Write-Host "WSL успешно обновлен"
            wsl --shutdown
            Start-Sleep -Seconds 5
        }
    }
} catch {
    Write-Host "Ошибка при проверке обновлений WSL: $_"
    # Продолжаем выполнение, так как это не критическая ошибка
}

# Проверка и настройка WSL 2
Write-Host "Проверка и настройка WSL 2..."
try {
    # Проверяем статус WSL
    $wslStatus = wsl --status 2>&1
    
    # Проверяем наличие ядра WSL 2
    if ($wslStatus -match "Файл ядра WSL 2 не найден" -or $wslStatus -match "0x800701bc") {
        Write-Host "Скачивание и установка ядра WSL 2..."
        
        # Создаем временную директорию
        $tempDir = Join-Path $env:TEMP "WSLKernel"
        New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
        
        # Скачиваем пакет ядра
        $kernelUrl = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
        $kernelFile = Join-Path $tempDir "wsl_update_x64.msi"
        
        Write-Host "Скачивание пакета ядра WSL 2..."
        Invoke-WebRequest -Uri $kernelUrl -OutFile $kernelFile
        
        # Устанавливаем пакет
        Write-Host "Установка пакета ядра WSL 2..."
        Start-Process msiexec.exe -ArgumentList "/i `"$kernelFile`" /quiet" -Wait
        
        # Очищаем временные файлы
        Remove-Item -Path $tempDir -Recurse -Force
        
        # Обновляем WSL
        Write-Host "Обновление WSL..."
        wsl --update
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Не удалось обновить WSL"
            exit 1
        }
        
        # Перезапускаем WSL
        Write-Host "Перезапуск WSL..."
        wsl --shutdown
        Start-Sleep -Seconds 5
    }

    # Проверяем версию WSL по умолчанию
    $defaultVersion = wsl --status | Select-String "Версия по умолчанию: (\d+)"
    if (-not $defaultVersion -or $defaultVersion.Matches.Groups[1].Value -ne "2") {
        Write-Host "Установка WSL 2 как версии по умолчанию..."
        wsl --set-default-version 2
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Не удалось установить WSL 2 как версию по умолчанию"
            exit 1
        }
        Write-Host "WSL 2 успешно установлен как версия по умолчанию"
    }

    # Проверяем статус еще раз после всех изменений
    $finalStatus = wsl --status
    if ($finalStatus -match "Файл ядра WSL 2 не найден") {
        Write-Error "Не удалось корректно настроить WSL 2. Пожалуйста, проверьте, что включено 'Получение обновлений для других продуктов Майкрософт при обновлении Windows' в настройках Windows Update"
        exit 1
    }

} catch {
    Write-Error "Ошибка при настройке WSL: $_"
    exit 1
}

# Создаем XML конфигурацию задачи
$taskXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>VP\$Username</Author>
    <URI>\AutoNumberGame WSL Start</URI>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
      <Delay>PT30S</Delay>
    </BootTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$Username</UserId>
      <LogonType>Password</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>true</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <DisallowStartOnRemoteAppSession>false</DisallowStartOnRemoteAppSession>
    <UseUnifiedSchedulingEngine>true</UseUnifiedSchedulingEngine>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>C:\Program Files\WSL\wsl.exe</Command>
      <Arguments>-d $wslDistroName</Arguments>
    </Exec>
  </Actions>
</Task>
"@

# Удаляем существующую задачу, если она есть
$existingTask = Get-ScheduledTask -TaskName "AutoNumberGame WSL Start" -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Удаление существующей задачи..."
    Unregister-ScheduledTask -TaskName "AutoNumberGame WSL Start" -Confirm:$false
    Start-Sleep -Seconds 2  # Даем время на очистку задачи
}

# Регистрируем задачу в системе
try {
    # Проверяем, что старая задача точно удалена
    $checkTask = Get-ScheduledTask -TaskName "AutoNumberGame WSL Start" -ErrorAction SilentlyContinue
    if ($checkTask) {
        Write-Host "Ожидание полного удаления старой задачи..."
        Start-Sleep -Seconds 5
    }

    # Регистрируем задачу напрямую из XML
    Register-ScheduledTask `
        -TaskName "AutoNumberGame WSL Start" `
        -Xml $taskXml `
        -User $Username `
        -Password $Password `
        -Force

    Write-Host "Задача 'AutoNumberGame WSL Start' успешно создана с использованием XML конфигурации"

    # Проверяем создание задачи
    Start-Sleep -Seconds 2  # Даем время на применение настроек
    $createdTask = Get-ScheduledTask -TaskName "AutoNumberGame WSL Start" -ErrorAction SilentlyContinue
    if (-not $createdTask) {
        Write-Error "Задача не была создана"
        exit 1
    }

    Write-Host "Задача 'AutoNumberGame WSL Start' успешно проверена и настроена"
} catch {
    Write-Error "Не удалось создать задачу: $_"
    exit 1
}

# Настройка брандмауэра и проксирование портов
Write-Host "Проверка правил брандмауэра для порта $appPort..."
$existingRule = Get-NetFirewallRule | Where-Object { $_.DisplayName -like "*$appPort*" }

if (-not $existingRule) {
    Write-Host "Создание нового правила брандмауэра для порта $appPort..."
    try {
        New-NetFirewallRule -DisplayName "AutoNumberGame Port $appPort" -Direction Inbound -Protocol TCP -LocalPort $appPort -Action Allow
        Write-Host "Правило брандмауэра успешно создано"
    }
    catch {
        Write-Error "Не удалось создать правило брандмауэра: $_"
        exit 1
    }
} else {
    Write-Host "Правило брандмауэра для порта $appPort уже существует"
}

# Функция для тихой проверки порта
function Test-PortQuiet {
    param(
        [string]$ComputerName,
        [int]$Port,
        [int]$Timeout = 1000
    )
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpClient.BeginConnect($ComputerName, $Port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne($Timeout, $false)
        
        if (!$wait) {
            $tcpClient.Close()
            return $false
        }
        
        $tcpClient.EndConnect($connect)
        $tcpClient.Close()
        return $true
    }
    catch {
        return $false
    }
}

Write-Host "Проверка доступности порта $appPort..."
$portAvailable = Test-PortQuiet -ComputerName $externalIP -Port $appPort

if (-not $portAvailable) {
    Write-Host "Порт $appPort недоступен. Настройка проксирования портов..."
    try {
        netsh interface portproxy add v4tov4 listenport=$appPort listenaddress=$externalIP connectport=$appPort connectaddress=127.0.0.1
        Write-Host "Проксирование портов успешно настроено"
    }
    catch {
        Write-Error "Не удалось настроить проксирование портов: $_"
        exit 1
    }
} else {
    Write-Host "Порт $appPort уже доступен"
}

Write-Host "Настройка сети успешно завершена"

# Устанавливаем кодировку для корректного отображения русского языка
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[System.Console]::InputEncoding = [System.Text.Encoding]::UTF8

# Функция для получения вывода в Unicode
function Get-UnicodeOutput {
    param(
        [Parameter(Mandatory=$true)]
        [string]$fileName,
        [Parameter(ValueFromRemainingArguments=$true)]
        [string[]]$arguments
    )
    
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new($fileName, ($arguments -join ' '))
    $startInfo.RedirectStandardOutput = $true
    $startInfo.UseShellExecute = $false
    $startInfo.StandardOutputEncoding = [System.Text.Encoding]::Unicode
    
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    
    try {
        $process.Start() | Out-Null
        $output = $process.StandardOutput.ReadToEnd()
        $process.WaitForExit()
        return @{
            Output = $output
            ExitCode = $process.ExitCode
        }
    }
    catch {
        Write-Warning "Ошибка при выполнении команды: $_"
        return $null
    }
    finally {
        $process.Dispose()
    }
}

# Функция для поиска rootfs
function Find-UbuntuRootfs {
    param(
        [string]$distroName = $wslDistroName
    )
    
    # Ищем только Ubuntu rootfs
    $rootfs = Get-ChildItem -Recurse 'C:\Program Files\WindowsApps\' -ErrorAction SilentlyContinue | 
              Where-Object {
                  $_.Name -eq 'install.tar.gz' -and 
                  $_.DirectoryName -like '*CanonicalGroupLimited.Ubuntu*'
              } |
              Sort-Object LastWriteTime -Descending |
              Select-Object -First 1
    
    if (-not $rootfs) {
        Write-Host "`e[91mНе удалось найти rootfs Ubuntu в директории WindowsApps`e[0m"
        Write-Host "`e[91mУбедитесь, что Ubuntu установлен через Microsoft Store`e[0m"
        return $null
    }
    
    Write-Host "Найден Ubuntu rootfs: $($rootfs.FullName)"
    return $rootfs.FullName
}

# Функция для удаления дистрибутива WSL
function Remove-WslDistro {
    param(
        [string]$name
    )
    
    Write-Host "Удаляем дистрибутив $name..."
    $unregisterResult = Get-UnicodeOutput "wsl.exe" "--unregister" $name
    
    # Игнорируем ошибку, если дистрибутив не найден
    if ($unregisterResult.ExitCode -ne 0 -and $unregisterResult.Output -notmatch "WSL_E_DISTRO_NOT_FOUND") {
        Write-Host "Ошибка при удалении $name. Код ошибки: $($unregisterResult.ExitCode)"
        Write-Host "Подробности:"
        Write-Host $unregisterResult.Output
        return $false
    }
    
    return $true
}

# Функция для проверки URL
function Test-ServiceUrl {
    param(
        [string]$url,
        [int]$maxAttempts = 10,
        [int]$delaySeconds = 3
    )
    
    Write-Host "Проверяем доступность $url..."
    
    for ($i = 1; $i -le $maxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Host "✓ Сервис доступен по адресу $url"
                Write-Host "  Статус: $($response.StatusCode)"
                return $true
            }
        }
        catch {
            if ($i -lt $maxAttempts) {
                Write-Host "  Попытка $i из $maxAttempts - сервис пока не доступен, ждём $delaySeconds секунд..."
                Start-Sleep -Seconds $delaySeconds
            }
        }
    }
    
    Write-Host "✗ Сервис недоступен по адресу $url после $maxAttempts попыток"
    return $false
}

# Функция для установки Ubuntu
function Install-Ubuntu {
    param(
        [string]$usernameUbuntu,
        [string]$passwordUbuntu,
        [string]$github_username,
        [string]$github_token,
        [string]$telegram_token,
        [string]$bot_username
    )
    
    # Определяем путь к временной директории
    $tempDir = "C:\AutoNumber_temp"
    
    # Очищаем временную директорию, если она осталась от предыдущей установки
    if (Test-Path $tempDir) {
        Write-Host "Останавливаем WSL..."
        $shutdownResult = Get-UnicodeOutput "wsl.exe" "--shutdown"
        Write-Host "Ждём 10 секунд, пока WSL полностью остановится..."
        Start-Sleep -Seconds 10
        
        Write-Host "Удаляем старую временную директорию..."
        try {
            # Сначала пробуем удалить файл vhdx, если он существует
            $vhdxPath = Join-Path $tempDir "ext4.vhdx"
            if (Test-Path $vhdxPath) {
                Write-Host "Удаляем файл ext4.vhdx..."
                Remove-Item -Path $vhdxPath -Force
                Start-Sleep -Seconds 2
            }
            
            # Теперь пробуем удалить всю директорию
            Remove-Item -Path $tempDir -Recurse -Force
            Start-Sleep -Seconds 2
            
            if (Test-Path $tempDir) {
                Write-Host "Первая попытка удаления не удалась, пробуем ещё раз..."
                Start-Sleep -Seconds 5
                Remove-Item -Path $tempDir -Recurse -Force -ErrorAction Stop
                
                if (Test-Path $tempDir) {
                    Write-Host "`e[91mВНИМАНИЕ! Временная директория $tempDir всё ещё существует`e[0m"
                    Write-Host "`e[91mПожалуйста, выполните следующие команды вручную:`e[0m"
                    Write-Host "`e[91m1. wsl --shutdown`e[0m"
                    Write-Host "`e[91m2. Remove-Item -Path $tempDir -Recurse -Force`e[0m"
                } else {
                    Write-Host "✓ Временная директория успешно удалена со второй попытки"
                }
            } else {
                Write-Host "✓ Временная директория успешно удалена"
            }
        }
        catch {
            Write-Host "`e[91mВНИМАНИЕ! Не удалось удалить временную директорию: $tempDir`e[0m"
            Write-Host "`e[91mПожалуйста, выполните следующие команды вручную:`e[0m"
            Write-Host "`e[91m1. wsl --shutdown`e[0m"
            Write-Host "`e[91m2. Remove-Item -Path $tempDir -Recurse -Force`e[0m"
        }
    }
    
    Write-Host "Устанавливаем пакет ${wslDistroName} (этап 1)..."
    # Сначала устанавливаем стандартный Ubuntu
    $installResult = Get-UnicodeOutput "wsl.exe" "--install" "-d" "Ubuntu" "--no-launch"
    
    if ($installResult.ExitCode -ne 0 -and -not ($installResult.Output -match "уже установлен")) {
        Write-Host "Ошибка при установке пакета Ubuntu. Код ошибки: $($installResult.ExitCode)"
        Write-Host "Подробности:"
        Write-Host $installResult.Output
        return $false
    }
    
    # Даём время на инициализацию
    Start-Sleep -Seconds 5
    
    # Удаляем Ubuntu, если он уже был установлен (чтобы избежать конфликтов)
    Write-Host "Подготавливаем систему для установки ${wslDistroName}..."
    Remove-WslDistro "Ubuntu" | Out-Null
    
    # Находим rootfs
    $rootfsPath = Find-UbuntuRootfs -distroName $wslDistroName
    if (-not $rootfsPath) {
        Write-Host "Не удалось найти rootfs для ${wslDistroName}"
        return $false
    }
    
    Write-Host "Найден rootfs для ${wslDistroName}: ${rootfsPath}"
    
    # Создаём временную директорию для установки
    if (-not (Test-Path $tempDir)) {
        New-Item -ItemType Directory -Path $tempDir | Out-Null
    }

    # Копируем rootfs во временную директорию
    Write-Host "Копируем rootfs во временную директорию..."
    $tempRootfs = Join-Path $tempDir "rootfs.tar.gz"
    try {
        Copy-Item -Path $rootfsPath -Destination $tempRootfs -Force
    }
    catch {
        Write-Host "Ошибка при копировании rootfs: $_"
        return $false
    }
    
    Write-Host "Импортируем ${wslDistroName} в WSL..."
    $importResult = Get-UnicodeOutput "wsl.exe" "--import" $wslDistroName $tempDir $tempRootfs
    
    if ($importResult.ExitCode -ne 0) {
        Write-Host "Ошибка при импорте ${wslDistroName}. Код ошибки: ${$importResult.ExitCode}"
        Write-Host "Подробности:"
        Write-Host $importResult.Output
        return $false
    }
    
    # Создаём пользователя и настраиваем его
    Write-Host "Настраиваем пользователя..."
    
    # Формируем команды для bash
    $bashCommands = @(
        '#!/bin/bash',
        'set -e',  # Останавливаем выполнение при ошибках
        '',
        '# Создаем нового пользователя',
        'useradd -m -G sudo -s /bin/bash "$1"',
        '',
        '# Устанавливаем пароль',
        'echo "$1:$2" | chpasswd',
        '',
        '# Настраиваем sudo без пароля',
        'echo "$1 ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$1"',
        'chmod 440 "/etc/sudoers.d/$1"',
        '',
        '# Настраиваем WSL',
        'echo "[user]" > /etc/wsl.conf',
        'echo "default=$1" >> /etc/wsl.conf',
        '',
        "# Обновляем пакеты",
        "apt-get update",
        "apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release",
        "",
        "# Добавляем Docker репозиторий",
        "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg",
        'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list',
        "",
        "# Устанавливаем Docker",
        "apt-get update",
        "apt-get install -y docker-ce docker-ce-cli containerd.io",
        "",
        "# Добавляем пользователя в группу docker",
        'usermod -aG docker "$1"',
        "",
        "# Настраиваем автозапуск Docker",
        'echo "[boot]" >> /etc/wsl.conf',
        'echo "command=service docker start" >> /etc/wsl.conf',
        "",
        "# Запускаем Docker",
        "service docker start",
        "",
        "# Создаём директорию для Docker конфигурации",
        'mkdir -p "/home/$1/.docker"',
        'touch "/home/$1/.docker/watchtower.json"',
        'cat > "/home/$1/.docker/watchtower.json" << EOFF',
        '{',
        '  "auths": {',
        '    "ghcr.io": {',
        '      "auth": "$(echo -n "$3:$4" | base64)"',
        '    }',
        '  }',
        '}',
        'EOFF',
        "",
        "# Устанавливаем права на конфигурацию",
        'chown -R "$1:$1" "/home/$1/.docker"',
        'chmod 600 "/home/$1/.docker/watchtower.json"',
        "",
        "# Логинимся в GitHub Container Registry",
        'docker login ghcr.io -u "$3" -p "$4"',
        "",
        "# Создаём директорию для данных игры",
        'mkdir -p "/home/$1/autonumbergame/data"',
        'chown -R "$1:$1" "/home/$1/autonumbergame"',
        "",
        "# Останавливаем и удаляем старые контейнеры если есть",
        "docker rm -f autonumbergame watchtower-autonumber || true",
        "",
        "# Запускаем контейнеры",
        'docker run -d -p 0.0.0.0:' + $appPort + ':3000 --name autonumbergame --restart always -e TELEGRAM_BOT_TOKEN="$5" -e BOT_USERNAME="$6" -e NODE_ENV=production -e GAME_DATA_FILE=/app/data/game_data.json -e MAX_NUMBERS=999 -v "/home/$1/autonumbergame/data:/app/data" ghcr.io/$3/autonumbergame:latest',
        'docker run -d --name watchtower-autonumber --restart always -v "/var/run/docker.sock:/var/run/docker.sock" -v "/home/$1/.docker/watchtower.json:/config.json" -e DOCKER_CONFIG=/ containrrr/watchtower --interval 100 --cleanup --remove-volumes autonumbergame',
        "",
        "# Проверяем статус Docker",
        "docker ps",
        "docker port autonumbergame",
        "" # Пустая строка в конце файла
    )
    
    # Записываем скрипт с переносами строк Unix
    $scriptPath = Join-Path $tempDir "setup.sh"
    $unixContent = $bashCommands -join "`n"
    [System.IO.File]::WriteAllText($scriptPath, $unixContent, [System.Text.UTF8Encoding]::new($false))
    
    # Делаем скрипт исполняемым
    wsl -d $wslDistroName chmod +x /mnt/c/AutoNumber_temp/setup.sh
    
    # Запускаем скрипт настройки с параметрами
    Write-Host "Путь к скрипту в WSL: /mnt/c/AutoNumber_temp/setup.sh"
    $setupResult = Get-UnicodeOutput "wsl.exe" "-d" $wslDistroName "/mnt/c/AutoNumber_temp/setup.sh" $usernameUbuntu $passwordUbuntu $github_username $github_token $telegram_token $bot_username
    
    if ($setupResult.ExitCode -ne 0) {
        Write-Host "Ошибка при настройке пользователя. Код ошибки: $($setupResult.ExitCode)"
        Write-Host "Подробности:"
        Write-Host $setupResult.Output
        return $false
    }
    
    # После успешной установки проверяем доступность сервиса
    Write-Host "Проверяем доступность сервиса..."
    
    # Для Telegram бота проверяем только что бот запущен
    Write-Host "Проверяем статус контейнера..."
    $containerStatus = wsl -d $wslDistroName docker ps --filter "name=autonumbergame" --format "table {{.Names}}\t{{.Status}}"
    Write-Host $containerStatus
    
    # Очищаем временные файлы
    Write-Host "Очищаем временные файлы..."
    try {
        # Удаляем только rootfs.tar.gz
        $tempRootfs = Join-Path $tempDir "rootfs.tar.gz"
        if (Test-Path $tempRootfs) {
            Write-Host "Удаляем временный rootfs архив..."
            Remove-Item -Path $tempRootfs -Force
            Write-Host "✓ Временный rootfs архив успешно удалён"
        }
    }
    catch {
        Write-Host "`e[93mПредупреждение: Не удалось удалить временный rootfs архив`e[0m"
        Write-Host "`e[93mЭто не критично для работы системы`e[0m"
    }
    
    Write-Host "`e[92m${wslDistroName} успешно установлена и настроена!`e[0m" # Зелёный цвет
    Write-Host "`e[92m✓ Docker установлен и настроен`e[0m"
    Write-Host "`e[92m✓ Контейнеры запущены`e[0m"
    Write-Host "`e[92m✓ AutoNumberGame Telegram Bot активен`e[0m"
    
    Write-Host "`n`e[93mДля обеспечения стабильной работы WSL рекомендуется перезагрузить компьютер.`e[0m"
    $rebootConfirmation = Read-Host "Хотите перезагрузить компьютер сейчас? (да/нет)"
    
    if ($rebootConfirmation.ToLower() -in @('y', 'yes', 'д', 'да')) {
        Write-Host "`e[93mКомпьютер будет перезагружен через 10 секунд...`e[0m"
        Write-Host "`e[93mСохраните все открытые документы!`e[0m"
        Start-Sleep -Seconds 10
        Restart-Computer -Force
    } else {
        Write-Host "`e[93mНе забудьте перезагрузить компьютер позже для стабильной работы WSL`e[0m"
    }
    
    return $true
}

# Проверяем текущие дистрибутивы WSL
Write-Host "Проверяем наличие $wslDistroName..."

# Получаем список дистрибутивов WSL
$wslResult = Get-UnicodeOutput "wsl.exe" "-l" "-v"

if ($null -eq $wslResult) {
    Write-Host "Ошибка при получении списка дистрибутивов WSL"
    exit 1
}

$wslOutput = $wslResult.Output

# Проверяем, есть ли сообщение об отсутствии дистрибутивов
if ($wslOutput -match "не содержит установленных дистрибутивов") {
    Write-Host "WSL не содержит установленных дистрибутивов. Устанавливаем $wslDistroName..."
    
    if (Install-Ubuntu -username $usernameUbuntu -password $passwordUbuntu -github_username $github_username -github_token $github_token -telegram_token $telegram_bot_token -bot_username $bot_username) {
        exit 0
    } else {
        Write-Host "`e[91mПроизошла ошибка при установке $wslDistroName.`e[0m"
        exit 1
    }
}

# Проверяем наличие дистрибутива
$hasUbuntu = $wslOutput -match $wslDistroName

if ($hasUbuntu) {
    Write-Host "Обнаружена существующая установка $wslDistroName."
    $confirmation = Read-Host "Вы уверены, что хотите удалить существующую установку $wslDistroName? (да/нет)"
    
    if ($confirmation.ToLower() -in @('y', 'yes', 'д', 'да')) {
        # Удаляем дистрибутив
        if (-not (Remove-WslDistro $wslDistroName)) {
            Write-Host "`e[91mПроизошла ошибка при удалении $wslDistroName.`e[0m"
            exit 1
        }
        
        Write-Host "Начинаем новую установку..."
        
        if (Install-Ubuntu -username $usernameUbuntu -password $passwordUbuntu -github_username $github_username -github_token $github_token -telegram_token $telegram_bot_token -bot_username $bot_username) {
            exit 0
        } else {
            Write-Host "`e[91mПроизошла ошибка при установке $wslDistroName.`e[0m"
            exit 1
        }
    } else {
        Write-Host "Операция отменена пользователем."
        exit 0
    }
} else {
    # Если дистрибутив не найден, устанавливаем его
    if (Install-Ubuntu -username $usernameUbuntu -password $passwordUbuntu -github_username $github_username -github_token $github_token -telegram_token $telegram_bot_token -bot_username $bot_username) {
        exit 0
    } else {
        Write-Host "`e[91mПроизошла ошибка при установке $wslDistroName.`e[0m"
        exit 1
    }
}
