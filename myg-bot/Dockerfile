# ---- Build stage ----
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Installer utilitaires requis par Prisma
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copie des manifests en premier pour tirer parti du cache
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* .npmrc* ./
# Installe les dépendances (utilise npm; adapte si tu es sur pnpm/yarn)
RUN npm ci

# Copie du code
COPY . .

# Prisma (si présent)
RUN npx prisma generate || echo "No Prisma schema found or generate failed (ignore if not using Prisma)."

# Build TypeScript -> dist/
RUN npm run build

# ---- Runtime stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# librairies utiles à Prisma + certifs
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copie uniquement le nécessaire pour exécuter
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

# Variables d'env par défaut raisonnables (éventuellement surchargées par Koyeb)
ENV NODE_ENV=production \
    TZ=Europe/Paris

EXPOSE 8000
# Lancer le bot
CMD ["node", "dist/index.js"]
