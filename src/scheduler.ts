import * as cron from 'node-cron';
import { promises as fs } from 'fs';
import { LGPontoBot } from './run-once';
import * as dotenv from 'dotenv';

dotenv.config();

interface ScheduleEntry {
  at: string; // Formato: "YYYY-MM-DD HH:MM"
  action: 'start' | 'stop';
}

class PontoScheduler {
  private activeJobs: Map<string, cron.ScheduledTask> = new Map();
  private scheduleFile = 'schedule.json';
  private notifyCallback?: (message: string) => Promise<void>;

  setNotifier(callback: (message: string) => Promise<void>): void {
    this.notifyCallback = callback;
  }

  private async notify(message: string): Promise<void> {
    if (this.notifyCallback) {
      await this.notifyCallback(message).catch(err => console.error('Erro ao enviar notificacao:', err));
    }
  }

  async loadSchedule(): Promise<ScheduleEntry[]> {
    try {
      const content = await fs.readFile(this.scheduleFile, 'utf-8');
      const schedule: ScheduleEntry[] = JSON.parse(content);
      
      console.log(`Carregado ${schedule.length} agendamentos do arquivo ${this.scheduleFile}`);
      return schedule;
    } catch (error) {
      console.error('Erro ao carregar schedule.json:', error);
      return [];
    }
  }

  private parseDateTimeToCron(dateTimeStr: string): { cronExpression: string; isValid: boolean } {
    try {
      const date = new Date(dateTimeStr);
      const now = new Date();
      
      // Verificar se a data é válida e está no futuro
      if (isNaN(date.getTime())) {
        console.error(`Data inválida: ${dateTimeStr}`);
        return { cronExpression: '', isValid: false };
      }

      if (date <= now) {
        console.warn(`Data já passou: ${dateTimeStr}`);
        return { cronExpression: '', isValid: false };
      }

      // Converter para expressão cron: "minuto hora dia mês dia-semana"
      const minute = date.getMinutes();
      const hour = date.getHours();
      const day = date.getDate();
      const month = date.getMonth() + 1; // getMonth() retorna 0-11
      
      const cronExpression = `${minute} ${hour} ${day} ${month} *`;
      
      console.log(`Agendamento: ${dateTimeStr} -> ${cronExpression}`);
      return { cronExpression, isValid: true };
    } catch (error) {
      console.error(`Erro ao processar data ${dateTimeStr}:`, error);
      return { cronExpression: '', isValid: false };
    }
  }

  async scheduleJob(entry: ScheduleEntry): Promise<void> {
    const { cronExpression, isValid } = this.parseDateTimeToCron(entry.at);
    
    if (!isValid) {
      console.error(`Pulando agendamento inválido: ${JSON.stringify(entry)}`);
      return;
    }

    const jobId = `${entry.at}-${entry.action}`;
    
    // Cancelar job existente se houver
    if (this.activeJobs.has(jobId)) {
      this.activeJobs.get(jobId)?.stop();
      this.activeJobs.delete(jobId);
    }

    // Criar novo job
    const task = cron.schedule(cronExpression, async () => {
      console.log(`\\n=== Executando job agendado ===`);
      console.log(`Horário programado: ${entry.at}`);
      console.log(`Ação: ${entry.action}`);
      console.log(`Horário de execução: ${new Date().toISOString()}`);

      const bot = new LGPontoBot();
      
      try {
        await bot.run(entry.action, entry.at);
        console.log(`Job ${jobId} executado com sucesso`);
        await this.notify(`Ponto (${entry.action === 'start' ? 'entrada' : 'saida'}) registrado com sucesso. Horario: ${entry.at}`);
      } catch (error) {
        console.error(`Erro no job ${jobId}:`, error);
        const msg = error instanceof Error ? error.message : String(error);
        await this.notify(`Erro ao registrar ponto (${entry.action === 'start' ? 'entrada' : 'saida'}) no horario ${entry.at}: ${msg}`);
      }

      // Remover job após execução (jobs únicos)
      this.activeJobs.delete(jobId);
      console.log(`Job ${jobId} removido da lista ativa`);
    }, {
      scheduled: false, // Não iniciar automaticamente
      timezone: 'America/Sao_Paulo'
    });

    this.activeJobs.set(jobId, task);
    task.start();
    
    console.log(`Job agendado: ${jobId} para ${entry.at} (${entry.action})`);
  }

  async scheduleAll(): Promise<void> {
    console.log('Iniciando agendador de ponto...');
    
    const schedule = await this.loadSchedule();
    
    if (schedule.length === 0) {
      console.log('Nenhum agendamento encontrado no schedule.json');
      return;
    }

    console.log(`\\nAgendando ${schedule.length} jobs...`);
    
    for (const entry of schedule) {
      await this.scheduleJob(entry);
    }

    console.log(`\\nTotal de jobs ativos: ${this.activeJobs.size}`);
    console.log('Agendador em execução. Pressione Ctrl+C para parar.');
    
    // Listar jobs ativos
    if (this.activeJobs.size > 0) {
      console.log('\\nJobs ativos:');
      for (const [jobId] of this.activeJobs) {
        console.log(`  - ${jobId}`);
      }
    }
  }

  async reloadSchedule(): Promise<void> {
    console.log('\\nRecarregando schedule...');
    
    // Parar todos os jobs ativos
    for (const [jobId, task] of this.activeJobs) {
      task.stop();
      console.log(`Job parado: ${jobId}`);
    }
    this.activeJobs.clear();

    // Reagendar tudo
    await this.scheduleAll();
  }

  stopAll(): void {
    console.log('\\nParando todos os jobs...');
    
    for (const [jobId, task] of this.activeJobs) {
      task.stop();
      console.log(`Job parado: ${jobId}`);
    }
    
    this.activeJobs.clear();
    console.log('Todos os jobs foram parados.');
  }

  getActiveJobs(): string[] {
    return Array.from(this.activeJobs.keys());
  }

  async watchScheduleFile(): Promise<void> {
    // Watcher para recarregar quando o arquivo de schedule mudar
    try {
      const { watch } = await import('fs');
      
      watch(this.scheduleFile, (eventType) => {
        if (eventType === 'change') {
          console.log(`\\nArquivo ${this.scheduleFile} alterado, recarregando...`);
          setTimeout(() => {
            this.reloadSchedule().catch(console.error);
          }, 1000); // Delay para garantir que o arquivo foi completamente gravado
        }
      });
      
      console.log(`Monitorando alterações no arquivo ${this.scheduleFile}...`);
    } catch (error) {
      console.warn('Não foi possível monitorar alterações no arquivo de schedule:', error);
    }
  }
}

async function main() {
  const scheduler = new PontoScheduler();
  
  // Tratar sinais de interrupção
  process.on('SIGINT', () => {
    console.log('\\nRecebido SIGINT, parando scheduler...');
    scheduler.stopAll();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\\nRecebido SIGTERM, parando scheduler...');
    scheduler.stopAll();
    process.exit(0);
  });

  try {
    await scheduler.scheduleAll();
    await scheduler.watchScheduleFile();
    
    // Manter o processo vivo
    setInterval(() => {
      const activeJobs = scheduler.getActiveJobs();
      if (activeJobs.length === 0) {
        console.log('\\nNenhum job ativo. Verifique o schedule.json e reinicie se necessário.');
      }
    }, 60000); // Verificar a cada minuto

  } catch (error) {
    console.error('Erro fatal no scheduler:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { PontoScheduler };