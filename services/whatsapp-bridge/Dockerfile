# Build dependencies separately: Baileys pulls one dependency via Git.
# Final image has no Git, compiler, or production secrets.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package.json index.mjs receipt-tracker.mjs phone-utils.mjs ./
RUN mkdir -p /app/.local/session && chown -R node:node /app
USER node
CMD ["node", "index.mjs"]
