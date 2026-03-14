FROM node:20-alpine AS base

WORKDIR /app

FROM base AS deps
RUN corepack enable
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
RUN pnpm install --filter @briefforge/web... --prefer-offline

FROM base AS build
ENV NODE_ENV=production
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build --filter @briefforge/web

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000
CMD ["pnpm", "--filter", "@briefforge/web", "start"]

