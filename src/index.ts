import { PontoScheduler } from './scheduler';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

async function main() {
  console.log('🤖 LG Ponto Bot - Sistema de Automação');
  console.log('=====================================\\n');
  
  const scheduler = new PontoScheduler();
  
  // Configurar handlers de sinal
  process.on('SIGINT', () => {
    console.log('\\n⚠️  Interrupção recebida, parando sistema...');
    scheduler.stopAll();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\\n⚠️  Terminação recebida, parando sistema...');
    scheduler.stopAll();
    process.exit(0);
  });

  try {
    await scheduler.scheduleAll();
    await scheduler.watchScheduleFile();
    
    // Manter processo vivo e mostrar status periodicamente
    const statusInterval = setInterval(() => {
      const activeJobs = scheduler.getActiveJobs();
      const now = new Date().toLocaleString('pt-BR');
      
      if (activeJobs.length === 0) {
        console.log(`[${now}] ⏰ Nenhum job ativo. Verifique schedule.json`);
      } else {
        console.log(`[${now}] ✅ Sistema ativo com ${activeJobs.length} job(s) agendado(s)`);
      }
    }, 300000); // A cada 5 minutos

    // Cleanup no exit
    process.on('exit', () => {
      clearInterval(statusInterval);
      console.log('👋 Sistema finalizado');
    });

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}