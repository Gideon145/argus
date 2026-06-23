FROM node:20-slim AS builder

WORKDIR /app/agent
COPY agent/package.json agent/package-lock.json agent/tsconfig.json ./
RUN npm install
COPY agent/src/ ./src/
RUN npm run build

FROM node:20-slim
WORKDIR /app/agent
COPY --from=builder /app/agent/package.json /app/agent/package-lock.json ./
RUN npm install --omit=dev
COPY --from=builder /app/agent/dist/ ./dist/

EXPOSE 3001
CMD ["node", "dist/index.js"]
