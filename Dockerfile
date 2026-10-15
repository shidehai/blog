FROM node:24.22.0-alpine3.23 AS base

# Runtime applications use node directly; package managers belong to build stages.
FROM base AS runtime-base
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg

FROM base AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY frontend-v2/package.json ./frontend-v2/
COPY author-cms/package.json ./author-cms/
COPY packages/content-contracts/package.json ./packages/content-contracts/
COPY packages/markdown/package.json ./packages/markdown/
RUN pnpm install --frozen-lockfile

FROM dependencies AS source
COPY . .
RUN node scripts/assert-build-context.mjs

FROM source AS development
ENV HOSTNAME=0.0.0.0
EXPOSE 4321 4322
CMD ["pnpm", "--filter", "frontend-v2", "dev", "--hostname", "0.0.0.0"]

# Both applications build without a database, content service or secret.
FROM source AS build
RUN pnpm --filter frontend-v2 build && node scripts/collect-license-notices.mjs frontend-v2/.next/THIRD_PARTY_NOTICES.txt

FROM runtime-base AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=4321 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/frontend-v2/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend-v2/.next/static ./frontend-v2/.next/static
COPY --from=build --chown=node:node /app/frontend-v2/public ./frontend-v2/public
COPY --from=build --chown=node:node /app/frontend-v2/.next/THIRD_PARTY_NOTICES.txt ./THIRD_PARTY_NOTICES.txt
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:4321/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "frontend-v2/server.js"]

FROM source AS cms-build
RUN pnpm --filter author-cms build && pnpm --filter author-cms build:tools && node scripts/collect-license-notices.mjs author-cms/.next/THIRD_PARTY_NOTICES.txt

FROM runtime-base AS cms-runtime
WORKDIR /app
ENV NODE_ENV=production PORT=4322 HOSTNAME=0.0.0.0
ENV FONTCONFIG_PATH=/etc/fonts FONTCONFIG_FILE=/etc/fonts/fonts.conf
RUN apk add --no-cache fontconfig=2.17.1-r0 font-noto-cjk=0_git20220127-r1 && fc-cache --force
ENV XDG_CACHE_HOME=/tmp/cms-font-cache
COPY --from=cms-build --chown=node:node /app/author-cms/.next/standalone ./
COPY --from=cms-build --chown=node:node /app/author-cms/.next/static ./author-cms/.next/static
COPY --from=cms-build --chown=node:node /app/author-cms/public ./author-cms/public
COPY --from=cms-build --chown=node:node /app/author-cms/.tools ./author-cms/scripts
COPY --from=cms-build --chown=node:node /app/author-cms/migrations ./author-cms/migrations
COPY --from=cms-build --chown=node:node /app/author-cms/.next/THIRD_PARTY_NOTICES.txt ./THIRD_PARTY_NOTICES.txt
COPY scripts/collect-runtime-font-notices.mjs /tmp/collect-runtime-font-notices.mjs
RUN node /tmp/collect-runtime-font-notices.mjs /usr/share/fonts/noto /app/THIRD_PARTY_NOTICES.txt && rm /tmp/collect-runtime-font-notices.mjs
USER node
EXPOSE 4322
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:4322/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node author-cms/scripts/manage.mjs migrate && node author-cms/server.js"]
