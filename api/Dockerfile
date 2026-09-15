FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY api/package*.json ./
RUN npm ci

COPY api/tsconfig.json api/drizzle.config.ts ./
COPY api/src ./src
COPY api/drizzle ./drizzle

RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY api/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
