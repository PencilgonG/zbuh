# syntax=docker/dockerfile:1

########################
#  Build stage
########################
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Dépendances utiles (Prisma/OpenSSL) + certifs
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ⚠️ Le contexte Docker = racine du repo.
# On COPIE donc les fichiers du dossier myg-bot/ explicitement.
COPY myg-bot/package.json myg-bot/package-lock.json* myg-bot/pnpm-lock.yaml* myg-bot/yarn.lock* myg-bot/.npmrc* ./ 2>/dev/null || true

# Installer deps prod+dev (tsc etc.)
RUN npm ci

# Code source du bot
COPY myg-bot/ ./

# Prisma (si présent)
RUN if [ -f prisma/schema.prisma ]; then \
      npx prisma generate --schema prisma/schema.prisma; \
    else \
      echo "No Prisma schema found (ok if not using Prisma)."; \
    fi

# Build TypeScript -> dist/
RUN npm run build

########################
#  Runtime stage
########################
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Node_modules (prod) + build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Prisma client (si généré)
COPY --from=build /app/prisma ./prisma 2>/dev/null || true
# Garder package.json (utile pour quelques libs)
COPY myg-bot/package.json ./package.json

# Koyeb veut un port exposé même si le bot n'écoute pas HTTP
EXPOSE 8000

CMD ["node", "dist/index.js"]
