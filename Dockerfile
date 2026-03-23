# Imagem oficial do Playwright — já vem com Chromium e todas as deps do sistema
FROM mcr.microsoft.com/playwright:v1.55.1-jammy

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build && npm prune --production

RUN mkdir -p logs screenshots

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

CMD ["node", "dist/index.js"]