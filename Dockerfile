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

# Railway overrides CMD with nixpacks.toml start: "node agent/dist/index.js"
# WORKDIR must be /app so path resolves to /app/agent/dist/index.js
WORKDIR /app
EXPOSE 3001
