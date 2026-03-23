import { PontoScheduler } from './scheduler';
import { TelegramBot } from './telegram-bot';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('LG Ponto Bot - Sistema de Automacao');
  console.log('=====================================\n');

  const scheduler = new PontoScheduler();

  process.on('SIGINT', () => {
    console.log('\nInterrupcao recebida, parando sistema...');
    scheduler.stopAll();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nTerminacao recebida, parando sistema...');
    scheduler.stopAll();
    process.exit(0);
  });

  try {
    await scheduler.scheduleAll();
    await scheduler.watchScheduleFile();

    const bot = new TelegramBot(scheduler);
    await bot.launch();

    const statusInterval = setInterval(() => {
      const activeJobs = scheduler.getActiveJobs();
      const now = new Date().toLocaleString('pt-BR');

      if (activeJobs.length === 0) {
        console.log(`[${now}] Nenhum job ativo.`);
      } else {
        console.log(`[${now}] Sistema ativo com ${activeJobs.length} job(s) agendado(s)`);
      }
    }, 300000);

    process.on('exit', () => {
      clearInterval(statusInterval);
      console.log('Sistema finalizado');
    });

  } catch (error) {
    console.error('Erro fatal:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}