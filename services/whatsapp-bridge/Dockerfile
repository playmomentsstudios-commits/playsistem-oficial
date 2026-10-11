# Sagamente WhatsApp bridge: persistent Node runtime, isolated from Cloudflare Workers.
# Does not deploy itself or authorize any WhatsApp message.
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY index.mjs receipt-tracker.mjs phone-utils.mjs ./
RUN mkdir -p /app/.local/session && chown -R node:node /app
USER node
CMD ["node", "index.mjs"]
