# Multi-stage build for the statically rendered Next.js frontend-v2.
FROM node:24.15.0-alpine AS base

# Dependencies stage
FROM base AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY frontend-v2/package.json ./frontend-v2/
RUN pnpm install --frozen-lockfile

# Development stage used by deploy/compose.dev.yaml. It deliberately keeps the
# source tree writable for Next's dev cache; production runtime does not.
FROM dependencies AS development
WORKDIR /app
COPY . .
ENV PORT=4321
ENV HOSTNAME=0.0.0.0
EXPOSE 4321
CMD ["pnpm", "--filter", "frontend-v2", "dev", "--hostname", "0.0.0.0", "--port", "4321"]

# Build stage. Directus is a build-only source: its token is mounted as a
# BuildKit secret and never becomes an ARG, ENV, or later image layer.
FROM dependencies AS build
WORKDIR /app
ARG CONTENT_SOURCE=fixture
ARG DIRECTUS_URL
COPY . .
RUN --mount=type=secret,id=directus_build_token,required=false \
    set -eu; \
    case "$CONTENT_SOURCE" in \
      fixture) \
        CONTENT_SOURCE=fixture pnpm --filter frontend-v2 build ;; \
      directus) \
        test -n "$DIRECTUS_URL"; \
        test -r /run/secrets/directus_build_token; \
        DIRECTUS_BUILD_TOKEN="$(cat /run/secrets/directus_build_token)"; \
        test -n "$DIRECTUS_BUILD_TOKEN"; \
        CONTENT_SOURCE=directus DIRECTUS_URL="$DIRECTUS_URL" DIRECTUS_BUILD_TOKEN="$DIRECTUS_BUILD_TOKEN" pnpm --filter frontend-v2 build ;; \
      *) \
        echo "Unsupported CONTENT_SOURCE for image build" >&2; exit 2 ;; \
    esac

# Immutable runtime stage. It receives only the generated public snapshot.
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4321
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/frontend-v2/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend-v2/.next/static ./frontend-v2/.next/static
COPY --from=build --chown=node:node /app/frontend-v2/public ./frontend-v2/public

USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4321/healthz').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"
CMD ["node", "frontend-v2/server.js"]
