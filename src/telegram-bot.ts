import { Telegraf } from 'telegraf';
import { PontoScheduler } from './scheduler';

interface TimeRange {
  start: string;
  stop: string;
}

export class TelegramBot {
  private bot: Telegraf;
  private scheduler: PontoScheduler;
  private allowedChatId: number;

  constructor(scheduler: PontoScheduler) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN nao definido');
    if (!chatId) throw new Error('TELEGRAM_CHAT_ID nao definido');
    this.bot = new Telegraf(token);
    this.scheduler = scheduler;
    this.allowedChatId = parseInt(chatId, 10);
    this.registerCommands();
  }

  private isAllowed(chatId: number): boolean {
    return chatId === this.allowedChatId;
  }

  private parseTimeRanges(text: string): TimeRange[] {
    const pairRegex = /(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/g;
    const pairs: TimeRange[] = [];
    let match;
    while ((match = pairRegex.exec(text)) !== null) {
      pairs.push({ start: match[1], stop: match[2] });
    }
    return pairs;
  }

  private resolveDateTime(timeStr: string): string {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const candidate = new Date();
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate <= now) {
      candidate.setDate(candidate.getDate() + 1);
    }
    const yyyy = candidate.getFullYear();
    const mm = String(candidate.getMonth() + 1).padStart(2, '0');
    const dd = String(candidate.getDate()).padStart(2, '0');
    const hh = String(hours).padStart(2, '0');
    const min = String(minutes).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  private registerCommands(): void {
    this.bot.command('agendar', async (ctx) => {
      if (!this.isAllowed(ctx.chat.id)) return;
      const pairs = this.parseTimeRanges(ctx.message.text);
      if (pairs.length === 0) {
        await ctx.reply('Formato invalido. Exemplo: /agendar 08:00-12:00 13:00-18:00');
        return;
      }
      const lines: string[] = [];
      for (const pair of pairs) {
        const startDateTime = this.resolveDateTime(pair.start);
        const stopDateTime = this.resolveDateTime(pair.stop);
        await this.scheduler.scheduleJob({ at: startDateTime, action: 'start' });
        await this.scheduler.scheduleJob({ at: stopDateTime, action: 'stop' });
        lines.push(`Entrada: ${startDateTime}\nSaida:   ${stopDateTime}`);
      }
      await ctx.reply(`Agendado:\n\n${lines.join('\n\n')}`);
    });

    this.bot.command('status', async (ctx) => {
      if (!this.isAllowed(ctx.chat.id)) return;
      const jobs = this.scheduler.getActiveJobs();
      if (jobs.length === 0) {
        await ctx.reply('Nenhum job agendado.');
        return;
      }
      await ctx.reply(`Jobs ativos:\n${jobs.map(j => `- ${j}`).join('\n')}`);
    });

    this.bot.command('cancelar', async (ctx) => {
      if (!this.isAllowed(ctx.chat.id)) return;
      this.scheduler.stopAll();
      await ctx.reply('Todos os jobs cancelados.');
    });

    this.bot.command('start', async (ctx) => {
      if (!this.isAllowed(ctx.chat.id)) return;
      await ctx.reply(
        'LG Ponto Bot\n\n' +
        '/agendar 08:00-12:00 13:00-18:00 — agenda pares entrada/saida\n' +
        '/status — lista jobs ativos\n' +
        '/cancelar — cancela todos os jobs'
      );
    });
  }

  async launch(): Promise<void> {
    await this.bot.launch();
    console.log('Telegram bot iniciado (long-polling)');
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
}
