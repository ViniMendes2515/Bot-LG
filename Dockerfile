# Use Node.js LTS com base Ubuntu para melhor compatibilidade com Playwright
FROM node:18-slim

# Instalar dependências do sistema necessárias para o Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar todas as dependências (incluindo devDependencies para o build)
RUN npm ci

# Instalar browsers do Playwright
RUN npx playwright install chromium

# Copiar código fonte
COPY . .

# Compilar TypeScript
RUN npm run build

# Remover devDependencies após o build
RUN npm prune --production

# Criar diretórios necessários
RUN mkdir -p logs screenshots

# Configurar usuário não-root para segurança
RUN groupadd -r botuser && useradd -r -g botuser -s /bin/false botuser
RUN chown -R botuser:botuser /app
USER botuser

# Variáveis de ambiente
ENV NODE_ENV=production
ENV HEADLESS=true

# Porta (se necessária para monitoramento)
EXPOSE 3000

# Comando padrão
CMD ["node", "dist/index.js"]

# Labels para metadados
LABEL maintainer="LG Ponto Bot"
LABEL description="Automação para marcação de ponto no sistema LG"
LABEL version="1.0.0"