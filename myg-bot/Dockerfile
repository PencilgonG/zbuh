# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Minimal certificates (useful if you ever fetch over HTTPS during build)
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy manifests (no shell tricks here)
COPY myg-bot/package.json ./package.json
# If you use package-lock.json, keep the next line; otherwise it’s harmless.
COPY myg-bot/package-lock.json ./package-lock.json

# Install deps (use npm ci when lockfile is present)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Bring the whole app
COPY myg-bot/ ./

# Prisma generation is optional
RUN npx prisma generate || echo "No Prisma schema found (ok if not using Prisma)."

# Build TS -> dist/
RUN npm run build

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Only what we need at runtime
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Discord bot: no HTTP port to expose, just run the bot.
CMD ["node", "dist/index.js"]
