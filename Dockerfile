# Используем официальный образ Node.js 22
FROM node:22-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Создаем директорию для данных
RUN mkdir -p /app/data

# Устанавливаем права на директорию данных
RUN chown -R node:node /app/data

# Переключаемся на непривилегированного пользователя
USER node

# Команда запуска
CMD ["npm", "start"]
