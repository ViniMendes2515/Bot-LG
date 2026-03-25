# LG Ponto Bot

Aplicação Node.js + TypeScript para automatização da marcação de ponto no sistema LG Autoatendimento, com controle via bot do Telegram.

## Objetivo

Automatizar a marcação de ponto na função "Sobreaviso - Solicitar aprovação", clicando no botão "MARCAR PONTO" em horários pré-definidos ou sob demanda via Telegram.

## Arquitetura

- **Node.js + TypeScript**: Base da aplicação
- **Playwright**: Automação web (login, navegação, cliques)
- **node-cron**: Agendamento de tarefas
- **Telegraf**: Bot do Telegram para controle remoto
- **Persistência de sessão**: Cookies salvos em `state.json`
- **Docker**: Containerização para produção

## Estrutura do Projeto

```
lg-ponto-bot/
├── src/
│   ├── index.ts           # Ponto de entrada — inicia scheduler + bot Telegram
│   ├── run-once.ts        # Lógica principal de automação (login, navegação, marcação)
│   ├── scheduler.ts       # Sistema de agendamento com node-cron
│   └── telegram-bot.ts    # Bot do Telegram (comandos de controle)
├── logs/                  # Logs de execução e HTML dumps
├── screenshots/           # Screenshots das execuções
├── .env.example           # Modelo de variáveis de ambiente
├── schedule.json          # Configuração de horários
├── Dockerfile             # Imagem baseada em mcr.microsoft.com/playwright
└── docker-compose.yml     # Orquestração Docker
```

## Instalação e Configuração

### Pré-requisitos

- Node.js 18+
- npm
- Docker (para produção)

### 1. Clone e Instale

```bash
git clone <repo-url>
cd lg-ponto-bot

npm install
npx playwright install chromium
```

### 2. Variáveis de Ambiente

```bash
cp .env.example .env
```

Conteúdo do `.env`:

```env
LG_USER=seu_usuario_lg
LG_PASS=sua_senha_lg

TELEGRAM_BOT_TOKEN=token_do_bot
TELEGRAM_CHAT_ID=seu_chat_id

# Opcional: mostrar browser (padrão é headless)
HEADLESS=false

NODE_ENV=development
```

> Para obter o `TELEGRAM_BOT_TOKEN`, crie um bot via [@BotFather](https://t.me/BotFather).
> Para obter o `TELEGRAM_CHAT_ID`, envie uma mensagem para o bot e consulte `https://api.telegram.org/bot<TOKEN>/getUpdates`.

### 3. Agendamento (opcional)

Edite o `schedule.json` com os horários desejados:

```json
[
  {"at": "2025-09-23 08:00", "action": "start"},
  {"at": "2025-09-23 17:00", "action": "stop"}
]
```

**Formato**: `YYYY-MM-DD HH:MM` — timezone America/Sao_Paulo.

O arquivo é monitorado em tempo real; alterações são recarregadas automaticamente sem reiniciar o processo.

## Execução Local

```bash
# Desenvolvimento (scheduler + bot Telegram)
npm run dev

# Marcação única para teste
npm run run-once start
npm run run-once stop

# Apenas o scheduler (sem Telegram)
npm run scheduler
```

## Bot do Telegram

O bot aceita comandos apenas do `TELEGRAM_CHAT_ID` configurado.

| Comando | Descrição |
|---|---|
| `/start` | Exibe ajuda com todos os comandos |
| `/agendar 08:00-12:00 13:00-18:00` | Agenda pares de entrada/saída |
| `/unico start` | Bate ponto de entrada imediatamente |
| `/unico stop` | Bate ponto de saída imediatamente |
| `/status` | Lista os jobs ativos |
| `/cancelar` | Cancela todos os jobs agendados |

O bot também envia notificações automáticas após cada marcação (sucesso ou erro).

## Produção com Docker

### Build e execução

```bash
# Build
docker build -t lg-ponto-bot .

# Com Docker Compose
docker-compose up -d
```

O `docker-compose.yml` monta `schedule.json`, `logs/`, `screenshots/` e `state.json` como volumes, permitindo atualizar o agendamento sem rebuildar a imagem.

### Variáveis no docker-compose

Adicione ao `.env` (lido automaticamente pelo Compose):

```env
LG_USER=seu_usuario
LG_PASS=sua_senha
TELEGRAM_BOT_TOKEN=token_do_bot
TELEGRAM_CHAT_ID=seu_chat_id
```

### Comandos úteis

```bash
docker-compose logs -f
docker-compose restart
docker-compose down && docker-compose build --no-cache && docker-compose up -d
```

## Logs e Evidências

Cada execução gera:

- `logs/execution.log` — log JSON por linha
- `screenshots/ponto-<timestamp>.png` — screenshot da página
- `logs/page-<timestamp>.html` — dump HTML para debug

Estrutura de cada entrada no log:

```json
{
  "scheduledTime": "2025-09-24T08:00:00.000Z",
  "actualTime": "2025-09-24T08:00:02.123Z",
  "action": "start",
  "status": "success",
  "screenshotPath": "screenshots/ponto-2025-09-24T08-00-02-123Z.png",
  "htmlDumpPath": "logs/page-2025-09-24T08-00-02-123Z.html"
}
```

## Troubleshooting

**Erro de login**
- Verifique `LG_USER` e `LG_PASS`
- Delete `state.json` para forçar novo login

**Botão "MARCAR PONTO" não encontrado**
- Veja o screenshot e o HTML dump gerados para inspecionar o estado da página

**Jobs não executam**
- Confirme que as datas no `schedule.json` estão no futuro
- Verifique o timezone (America/Sao_Paulo)

**Bot Telegram não responde**
- Confirme `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no `.env`
- O bot usa long-polling; certifique-se de que o processo está rodando

**Chromium não inicia no Docker**
- A imagem base `mcr.microsoft.com/playwright` já inclui o Chromium; não é necessário instalar separadamente

## Scripts Disponíveis

```
build        — Compila TypeScript para dist/
dev          — Executa src/index.ts com ts-node (scheduler + Telegram)
start        — Executa dist/index.js compilado (produção)
run-once     — Executa marcação única: npm run run-once <start|stop>
scheduler    — Executa apenas o scheduler sem o bot Telegram
```

## Segurança

- Credenciais apenas em variáveis de ambiente
- Bot rejeita mensagens de chat IDs não autorizados
- Container roda como usuário não-root (imagem oficial Playwright)
- Logs não contêm informações sensíveis

---

**Nota**: Este bot automatiza interações com sistema interno. Use de acordo com as políticas da empresa.
