FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . ./
COPY bot.js start.sh ./
RUN chmod +x start.sh
EXPOSE 3001
CMD ["sh", "start.sh"]
