# Multi-stage build for Next.js frontend-v2
FROM node:24.15.0-alpine AS base

# Dependencies stage
FROM base AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY frontend-v2/package.json ./frontend-v2/
RUN pnpm install --frozen-lockfile

# Build stage
FROM dependencies AS build
COPY . .
RUN pnpm --filter frontend-v2 build

# Runtime stage
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=build /app/frontend-v2/.next/standalone ./
COPY --from=build /app/frontend-v2/.next/static ./frontend-v2/.next/static
COPY --from=build /app/frontend-v2/public ./frontend-v2/public

EXPOSE 3000
CMD ["node", "frontend-v2/server.js"]
