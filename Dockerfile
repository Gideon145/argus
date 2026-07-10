FROM node:20-slim AS builder

WORKDIR /app/agent
COPY agent/package.json agent/package-lock.json agent/tsconfig.json ./
RUN npm install
COPY agent/src/ ./src/
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/agent/package.json /app/agent/package-lock.json ./agent/
WORKDIR /app/agent
RUN npm install --omit=dev
COPY --from=builder /app/agent/dist/ ./dist/
COPY agent/bot.js agent/start.sh ./
RUN chmod +x start.sh

WORKDIR /app
EXPOSE 3001
CMD ["sh", "-c", "cd /app/agent && node dist/index.js"]
