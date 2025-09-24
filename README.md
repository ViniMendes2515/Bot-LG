# LG Ponto Bot

Aplicação Node.js + TypeScript para automatização da marcação de ponto no sistema LG Autoatendimento.

## 🎯 Objetivo

Automatizar a marcação de ponto na função "Sobreaviso - Solicitar aprovação", clicando no botão "MARCAR PONTO" em horários pré-definidos.

## 🏗️ Arquitetura

- **Node.js + TypeScript**: Base da aplicação
- **Playwright**: Automação web (login, navegação, cliques)
- **node-cron**: Agendamento de tarefas
- **Persistência de sessão**: Cookies salvos em `state.json`
- **Docker**: Containerização para produção

## 📁 Estrutura do Projeto

```
lg-ponto-bot/
├── src/
│   ├── index.ts           # Ponto de entrada principal
│   ├── run-once.ts        # Execução única de marcação
│   └── scheduler.ts       # Sistema de agendamento
├── logs/                  # Logs de execução e HTML dumps
├── screenshots/           # Screenshots das execuções
├── .env.example          # Modelo de variáveis de ambiente
├── schedule.json         # Configuração de horários
├── Dockerfile            # Configuração Docker
├── docker-compose.yml    # Orquestração Docker
└── playwright.config.ts  # Configuração Playwright
```

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Docker (para produção)

### 1. Clone e Instale

```bash
# Clone do repositório (se aplicável)
git clone <repo-url>
cd lg-ponto-bot

# Instalar dependências
npm install

# Instalar browsers do Playwright
npx playwright install chromium
```

### 2. Configuração

#### Variáveis de Ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite com suas credenciais
nano .env
```

Conteúdo do `.env`:
```env
LG_USER=seu_usuario_lg
LG_PASS=sua_senha_lg
NODE_ENV=development
```

#### Agendamento

Edite o arquivo `schedule.json` com seus horários:

```json
[
  {"at": "2025-09-23 22:15", "action": "start"},
  {"at": "2025-09-23 22:40", "action": "stop"},
]
```

**Formato das datas**: `YYYY-MM-DD HH:MM`

## 🖥️ Execução Local

### Desenvolvimento

```bash
# Compilar TypeScript
npm run build

# Executar scheduler completo
npm run dev
# ou
npm run scheduler

# Executar marcação única (teste)
npm run run-once start
npm run run-once stop
```

### Teste de Execução Única

```bash
# Marcar início do ponto
npx ts-node src/run-once.ts start

# Marcar fim do ponto  
npx ts-node src/run-once.ts stop
```

## 🐳 Produção com Docker

### Build da Imagem

```bash
docker build -t lg-ponto-bot .
```

### Execução com Docker Compose

1. Configure as variáveis no `.env`:

```env
LG_USER=seu_usuario
LG_PASS=sua_senha
```

2. Execute:

```bash
docker-compose up -d
```

### Comandos Docker Úteis

```bash
# Ver logs
docker-compose logs -f

# Parar o serviço
docker-compose stop

# Reiniciar
docker-compose restart

# Limpar e rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 🌥️ Deploy em Produção

### AWS EC2

1. **Configurar instância**:
   - Ubuntu 20.04+ 
   - Docker instalado
   - Portas de segurança configuradas

2. **Upload do projeto**:
```bash
scp -r lg-ponto-bot/ ubuntu@seu-ip:/home/ubuntu/
```

3. **Configurar no servidor**:
```bash
ssh ubuntu@seu-ip
cd lg-ponto-bot/
sudo docker-compose up -d
```

### DigitalOcean Droplet

1. **Criar Droplet** com Docker pré-instalado
2. **Configurar aplicação**:
```bash
git clone <seu-repo>
cd lg-ponto-bot/
cp .env.example .env
nano .env  # Configure credenciais
docker-compose up -d
```

### Monitoramento

```bash
# Status dos containers
docker ps

# Logs em tempo real
docker-compose logs -f lg-ponto-bot

# Verificar arquivos gerados
ls -la logs/ screenshots/
```

## 📝 Funcionamento

### Fluxo de Execução

1. **Login**: Acessa `https://login.lg.com.br/login/bravolog`
2. **Navegação**: Vai para função Sobreaviso
3. **Marcação**: Clica em "MARCAR PONTO"
4. **Evidências**: Gera screenshot e dump HTML
5. **Log**: Registra execução com timestamps

### Agendamento

- Usa `node-cron` para programar execuções
- Suporta múltiplos horários por dia
- Recarrega automaticamente se `schedule.json` for alterado
- Remove jobs automaticamente após execução

### Persistência de Sessão

- Salva cookies em `state.json`
- Evita re-login desnecessário
- Persiste entre reinicializações

## 📊 Logs e Monitoramento

### Estrutura dos Logs

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

### Arquivos Gerados

- `logs/execution.log`: Log detalhado (JSON por linha)
- `screenshots/`: Capturas de tela de cada execução
- `logs/*.html`: Dump do HTML da página
- `state.json`: Estado da sessão Playwright

## 🛠️ Troubleshooting

### Problemas Comuns

**1. Erro de Login**
```
Verificar LG_USER e LG_PASS no .env
Verificar se não há captcha ativado
```

**2. Botão não encontrado**
```
Verificar seletores no código se a página mudou
Ver screenshot gerado para debug visual
```

**3. Jobs não executam**
```
Verificar formato de data no schedule.json
Verificar timezone (America/Sao_Paulo)
Verificar se as datas não são passadas
```

**4. Erro Docker**
```
Verificar dependências do sistema
Rebuild da imagem: docker-compose build --no-cache
```

### Debug

```bash
# Executar em modo desenvolvimento (com browser visível)
NODE_ENV=development npm run dev

# Ver logs detalhados
tail -f logs/execution.log

# Verificar screenshots
ls -la screenshots/
```

## 🔒 Segurança

- Credenciais apenas em variáveis de ambiente
- Container roda como usuário não-root
- Estado de sessão em arquivo local protegido
- Logs não contêm informações sensíveis

## 📋 Scripts Disponíveis

```json
{
  "build": "tsc",                    // Compilar TypeScript
  "dev": "ts-node src/index.ts",     // Modo desenvolvimento  
  "start": "node dist/index.js",     // Produção (compilado)
  "run-once": "ts-node src/run-once.ts", // Execução única
  "scheduler": "ts-node src/scheduler.ts" // Apenas scheduler
}
```

## 🤝 Contribuição

1. Configure ambiente local
2. Teste suas mudanças
3. Mantenha compatibilidade Docker
4. Atualize documentação se necessário

## 📄 Licença

MIT License - veja arquivo LICENSE para detalhes.

---

**⚠️ Nota Importante**: Este bot automatiza interações com sistema interno. Use com responsabilidade e de acordo com as políticas da empresa.
