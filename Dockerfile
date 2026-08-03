# syntax=docker/dockerfile:1.7

FROM node:24.15.0-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS development
COPY . .
EXPOSE 4321
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

FROM dependencies AS build
COPY . .
ARG CONTENT_SOURCE=fixture
ARG DIRECTUS_URL
ARG SITE_URL=http://localhost:4321
ENV CONTENT_SOURCE=$CONTENT_SOURCE
ENV DIRECTUS_URL=$DIRECTUS_URL
ENV SITE_URL=$SITE_URL
RUN --mount=type=secret,id=directus_build_token,required=false \
    if [ -f /run/secrets/directus_build_token ]; then \
      export DIRECTUS_BUILD_TOKEN="$(cat /run/secrets/directus_build_token)"; \
    fi; \
    pnpm build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --prod --frozen-lockfile

FROM node:24.15.0-alpine AS runtime
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV PORT=4321
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/scripts/env.mjs ./scripts/env.mjs
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4321/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node scripts/env.mjs runtime && exec node dist/server/entry.mjs"]
