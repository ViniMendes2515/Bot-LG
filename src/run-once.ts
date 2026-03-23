import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

interface LogEntry {
  scheduledTime: string;
  actualTime: string;
  action: 'start' | 'stop';
  status: 'success' | 'error';
  error?: string;
  screenshotPath?: string;
  htmlDumpPath?: string;
}

class LGPontoBot {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  private readonly LOGIN_URL = 'https://login.lg.com.br/login/bravolog';
  private readonly FUNCAO_URL = 'https://prd-aa1.lg.com.br/Autoatendimento/index.html#/funcao?id=2824&uid=2025481148&tipo=1';
  private readonly STATE_FILE = 'state.json';

  private readonly username = process.env.LG_USER;
  private readonly password = process.env.LG_PASS;

  constructor() {
    if (!this.username || !this.password) {
      throw new Error('LG_USER e LG_PASS devem estar definidos nas variáveis de ambiente');
    }
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: process.env.NODE_ENV === 'production',
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
      ],
    });

    let storageState = undefined;
    try {
      await fs.access(this.STATE_FILE);
      storageState = this.STATE_FILE;
      console.log('Estado de sessão carregado do arquivo:', this.STATE_FILE);
    } catch {
      console.log('Nenhum estado de sessão encontrado, será criado um novo');
    }

    this.context = await this.browser.newContext({
      storageState,
      viewport: { width: 1280, height: 720 },
    });

    this.page = await this.context.newPage();
  }

  async login(): Promise<void> {
    if (!this.page) throw new Error('Page não inicializada');

    console.log('Acessando página de login...');
    await this.page.goto(this.LOGIN_URL);

    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(3000);

    const isLoggedIn = await this.checkIfLoggedIn();
    if (isLoggedIn) {
      console.log('Usuário já está logado');
      return;
    }

    console.log('Fazendo login (etapa 1/2 - preenchendo login)...');
    
    const loginField = await this.page.waitForSelector('#Login', { timeout: 15000 });
    if (!loginField) {
      throw new Error('Campo Login não encontrado');
    }
    
    await loginField.fill(this.username!);
    console.log('Login preenchido, procurando botão Continuar...');
    
    const continueSelectors = [
      'button:has-text("Continuar")',
      'input:has-text("Continuar")',
      '.btn:has-text("Continuar")',
      'button[type="submit"]',
      'input[type="submit"]',
      '.btn-primary',
      'form button:not([type="button"])'
    ];

    let continueButton = null;
    for (const selector of continueSelectors) {
      try {
        continueButton = await this.page.waitForSelector(selector, { timeout: 2000 });
        if (continueButton) {
          const buttonText = await continueButton.textContent() || '';
          console.log(`Botão encontrado: "${buttonText.trim()}" com seletor: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!continueButton) {
      console.log('Botão Continuar não encontrado, tentando Enter no campo Login');
      await loginField.press('Enter');
    } else {
      await continueButton.click();
    }

    console.log('Aguardando campo de senha aparecer...');
    await this.page.waitForTimeout(2000);

    console.log('Fazendo login (etapa 2/2 - preenchendo senha)...');
    const passwordField = await this.page.waitForSelector('#Senha', { timeout: 15000 });
    if (!passwordField) {
      throw new Error('Campo Senha não apareceu após informar o login');
    }
    
    await passwordField.fill(this.password!);
    console.log('Senha preenchida, procurando botão de login final...');
    
    const submitSelectors = [
      'button:has-text("Entrar")',
      'button:has-text("Login")',
      'button:has-text("Acessar")',
      'input:has-text("Entrar")',
      'button[type="submit"]',
      'input[type="submit"]',
      '.btn-primary',
      'form button:not([type="button"])'
    ];

    let submitButton = null;
    for (const selector of submitSelectors) {
      try {
        submitButton = await this.page.waitForSelector(selector, { timeout: 2000 });
        if (submitButton) {
          const buttonText = await submitButton.textContent() || '';
          console.log(`Botão login final encontrado: "${buttonText.trim()}" com seletor: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!submitButton) {
      console.log('Botão final não encontrado, tentando Enter na senha');
      await passwordField.press('Enter');
    } else {
      await submitButton.click();
    }
    
    try {
      console.log('Aguardando navegação após login...');
      await this.page.waitForNavigation({ timeout: 20000 });
      console.log('Login realizado com sucesso');
    } catch {
      console.log('Sem navegação detectada, verificando se login foi bem-sucedido...');
      await this.page.waitForTimeout(3000);
      const loggedIn = await this.checkIfLoggedIn();

      if (!loggedIn) {
        throw new Error('Login falhou - credenciais inválidas ou página não carregou');
      }

      console.log('Login realizado com sucesso (sem navegação)');
    }
    
    await this.context!.storageState({ path: this.STATE_FILE });
    console.log('Estado de sessão salvo em:', this.STATE_FILE);
  }

  private async checkIfLoggedIn(): Promise<boolean> {
    if (!this.page) return false;
    
    try {
      const loggedInSelectors = [
        '.logout',
        '.user-info', 
        '.menu-principal',
        '[href*="logout"]',
        '[href*="sair"]',
        '.navbar-nav',
        '.user-menu',
        'a:has-text("Sair")',
        'button:has-text("Logout")',
        '.profile'
      ];

      for (const selector of loggedInSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          console.log(`Login detectado com seletor: ${selector}`);
          return true;
        } catch {
          continue;
        }
      }

      const currentUrl = this.page.url();
      if (!currentUrl.includes('login') && !currentUrl.includes('bravolog')) {
        console.log('Não está mais na página de login, assumindo que está logado');
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  async navigateToFuncao(): Promise<void> {
    if (!this.page) throw new Error('Page não inicializada');

    console.log('Navegando para a função Sobreaviso...');
    await this.page.goto(this.FUNCAO_URL);
    
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(3000); 
    
    console.log('Procurando iframe da função...');
    
    const iframe = await this.page.waitForSelector('iframe.iframe-container, .lg-aa-layout__funcao__iframe', { timeout: 15000 });

    if (!iframe) {
      console.log('⚠️  Iframe não encontrado, tentando na página principal...');
    } else {
      
      const frame = await iframe.contentFrame();
      if (!frame) {
        throw new Error('Não foi possível acessar o conteúdo do iframe');
      }
            
      await frame.waitForLoadState('networkidle');
      await this.page.waitForTimeout(2000);
      
      const groupContainer = await frame.waitForSelector('.group-container', { timeout: 15000 });
      if (!groupContainer) {
        throw new Error('Container de grupos não encontrado no iframe');
      }
      
      let groupList = await frame.$('.group-list');
      console.log('Lista inicialmente visível:', !!groupList);
      
      if (!groupList) {
        console.log('🖱️  Lista não visível, tentando hover...');
        
        const selectedElement = await frame.$('.group-container__selected');

        if (selectedElement) {
          await selectedElement.hover();
          await this.page.waitForTimeout(1000);

          groupList = await frame.$('.group-list');        }
      }
      
      if (!groupList) {
        await groupContainer.hover();
        await this.page.waitForTimeout(1000);

        groupList = await frame.$('.group-list');
      }
      
      if (groupList) {        
        await groupContainer.hover();
        await this.page.waitForTimeout(1500);
        
        await this.page.waitForTimeout(1000);
                
        const sobreavisoSpan = await frame.waitForSelector('span.flag-name:has-text("Sobreaviso - Solicitar aprovação (Colaboradores)")', { timeout: 10000 }).catch(() => null);
        
        if (sobreavisoSpan) {
          const isVisible = await sobreavisoSpan.isVisible();
          
          if (!isVisible) {
            await groupContainer.hover();
            await this.page.waitForTimeout(1000);
            
            const parentLi = await sobreavisoSpan.evaluateHandle((el: any) => el.closest('li'));
            if (parentLi) {
              await parentLi.asElement()?.hover();
              await this.page.waitForTimeout(500);
            }
          }
                    
          try {
            await sobreavisoSpan.click({ timeout: 10000 });
            
            await this.page.waitForTimeout(2000);
            
            if (!this.page) {
              throw new Error('Page não inicializada');
            }
            
            await this.page.waitForLoadState('networkidle');
            await this.page.waitForTimeout(1000);
            
            return; 
            
          } catch (clickError) {
            
            await sobreavisoSpan.evaluate((el: any) => el.click());
            
            await this.page.waitForTimeout(2000);
            return;
          }
          
        } else {
          console.log('❌ span.flag-name com Sobreaviso não encontrado, tentando busca alternativa...');
          
          const allItems = await frame.$$('.group-list__item');
          console.log(`Encontrados ${allItems.length} itens na lista para busca alternativa:`);
          
          for (let i = 0; i < allItems.length; i++) {
            const item = allItems[i];
            const text = await item.textContent() || '';
            console.log(`  ${i + 1}. "${text.trim()}"`);
            
            if (text.includes('Sobreaviso')) {              
              await groupContainer.hover();
              await this.page.waitForTimeout(1000);
              
              await item.hover();
              await this.page.waitForTimeout(500);
              
              try {
                await item.click({ timeout: 10000 });
              } catch {
                await item.evaluate((el: any) => el.click());
              }
              
              await this.page.waitForTimeout(2000);
              
              if (!this.page) {
                throw new Error('Page não inicializada');
              }
              
              await this.page.waitForLoadState('networkidle');
              await this.page.waitForTimeout(1000);
              
              console.log('✅ Navegação para função Sobreaviso concluída');
              return;
            }
          }
          
          console.log('❌ Item Sobreaviso não encontrado em nenhuma busca');
          throw new Error('Opção "Sobreaviso - Solicitar aprovação (Colaboradores)" não encontrada no iframe');
        }
        
      } else {
        console.log('❌ Não foi possível tornar a lista visível no iframe');
        throw new Error('Lista de grupos não pode ser ativada no iframe');
      }
    }
        
    const groupContainer = await this.page.waitForSelector('.group-container', { timeout: 5000 }).catch(() => null);
    if (!groupContainer) {
      throw new Error('Container de grupos não encontrado nem na página principal nem no iframe');
    }
        
    let groupList = await this.page.$('.group-list');
    console.log('Lista inicialmente visível:', !!groupList);
    
    if (!groupList) {
      console.log('🖱️  Lista não visível, tentando hover...');
      
      const selectedElement = await this.page.$('.group-container__selected');
      if (selectedElement) {
        await selectedElement.hover();
        await this.page.waitForTimeout(1000);
        groupList = await this.page.$('.group-list');
      }
    }
    
    if (!groupList) {
      await groupContainer.hover();
      await this.page.waitForTimeout(1000);
      groupList = await this.page.$('.group-list');
    }
    
    if (groupList) {
      
      await this.page.waitForTimeout(1000);
      
      
      const allItems = await this.page.$$('.group-list__item');
      
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        const text = await item.textContent() || '';
        console.log(`  ${i + 1}. "${text.trim()}"`);
        
        if (text.includes('Sobreaviso')) {
          await item.click();
          await this.page.waitForTimeout(2000);
          
          await this.page!.waitForLoadState('networkidle');
          await this.page!.waitForTimeout(1000);
          
          return;
        }
      }
      
      console.log('❌ Item Sobreaviso não encontrado na lista da página principal');
      throw new Error('Opção "Sobreaviso - Solicitar aprovação (Colaboradores)" não encontrada');
      
    } else {
      console.log('❌ Não foi possível tornar a lista visível na página principal');
      throw new Error('Lista de grupos não pode ser ativada');
    }
  }

  async marcarPonto(action: 'start' | 'stop'): Promise<void> {
    if (!this.page) throw new Error('Page não inicializada');

    console.log(`Marcando ponto - ${action}...`);

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      console.log(`[DEV] Modo desenvolvimento ativo - cliques serao simulados`);
    }

    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(3000);
        
    let pontoButton = await this.page.$('text=MARCAR PONTO, button:has-text("MARCAR PONTO"), .ponto__block button');
    
    if (!pontoButton) {
      console.log('Botão não encontrado na página principal, verificando iframe...');
      
      const iframe = await this.page.$('iframe.iframe-container, .lg-aa-layout__funcao__iframe');
      if (iframe) {
        const frame = await iframe.contentFrame();
        if (frame) {
          
          await frame.waitForLoadState('networkidle');
          await this.page.waitForTimeout(2000);
          
          const buttonSelectors = [
            'text=MARCAR PONTO',
            'button:has-text("MARCAR PONTO")',
            '.ponto__block button',
            'button:has-text("Marcar Ponto")',
            'input[type="button"]:has-text("MARCAR PONTO")',
            '.btn:has-text("MARCAR")',
            'button[ng-click]',
            '.ponto__block .btn',
            'button.btn'
          ];
          
          for (const selector of buttonSelectors) {
            try {
              pontoButton = await frame.waitForSelector(selector, { timeout: 3000 });
              if (pontoButton) {
                break;
              }
            } catch {
              continue;
            }
          }
          
          if (pontoButton) {

            if (isDev) {
              console.log(`[DEV] Botao "MARCAR PONTO" encontrado no iframe - clique pulado (action: ${action})`);
              console.log(`✅ Ponto ${action} marcado com sucesso`);
              return;
            }

            try {
              await pontoButton.click({ timeout: 10000 });
            } catch (clickError) {
              await pontoButton.evaluate((el: any) => el.click());
            }

            await this.page.waitForTimeout(2000);

            try {
              console.log('🔍 Procurando botão de confirmação no iframe...');
              
              const confirmSelectors = [
                'button.confirm',
                'button:has-text("Confirmar")',
                '.confirm.btn',
                'button.btn:has-text("Confirmar")',
                '.bg-green-jungle',
                'button[class*="confirm"]',
                '.btn:has-text("Confirmar")'
              ];
              
              let confirmButton = null;
              for (const selector of confirmSelectors) {
                try {
                  confirmButton = await frame.waitForSelector(selector, { timeout: 3000 });
                  if (confirmButton) {
                    break;
                  }
                } catch {
                  continue;
                }
              }
              
              if (confirmButton) {

                const isVisible = await confirmButton.isVisible();
                if (!isVisible) {
                  await this.page.waitForTimeout(1000);
                }

                if (isDev) {
                  console.log(`[DEV] Botao de confirmacao encontrado no iframe - clique pulado (action: ${action})`);
                } else {
                  try {
                    await confirmButton.click({ timeout: 10000 });
                  } catch (clickError) {
                    await confirmButton.evaluate((el: any) => el.click());
                  }
                }

                await this.page.waitForTimeout(1000);
              }
              
            } catch (confirmError) {
              console.log('⚠️  Erro ao procurar confirmação no iframe:', confirmError);
            }
            
            console.log(`✅ Ponto ${action} marcado com sucesso`);
            return;
          }
        }
      }
    }
    
    if (!pontoButton) {
      console.log('🔍 Tentando seletores alternativos na página principal...');
      
      const mainSelectors = [
        'button:has-text("MARCAR PONTO")',
        'input[type="button"]:has-text("MARCAR PONTO")', 
        '.btn:has-text("MARCAR")',
        'button[ng-click]'
      ];
      
      for (const selector of mainSelectors) {
        try {
          pontoButton = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (pontoButton) {
            break;
          }
        } catch {
          continue;
        }
      }
    }
    
    if (!pontoButton) {
      throw new Error('Botão "MARCAR PONTO" não encontrado nem na página principal nem no iframe');
    }

    if (isDev) {
      console.log(`[DEV] Botao "MARCAR PONTO" encontrado na pagina principal - clique pulado (action: ${action})`);
      console.log(`✅ Ponto ${action} marcado com sucesso`);
      return;
    }

    await pontoButton.click();

    await this.page.waitForTimeout(2000);
    
    try {
      
      const confirmSelectors = [
        'button.confirm',
        'button:has-text("Confirmar")',
        '.confirm.btn',
        'button.btn:has-text("Confirmar")',
        '.bg-green-jungle',
        'button[class*="confirm"]',
        'button:has-text("OK")',
        'button:has-text("Sim")'
      ];
      
      let confirmButton = null;
      for (const selector of confirmSelectors) {
        try {
          confirmButton = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (confirmButton) {
            console.log(`✅ Botão de confirmação encontrado: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }

      if (confirmButton) {
        if (isDev) {
          console.log(`[DEV] Botao de confirmacao encontrado na pagina principal - clique pulado (action: ${action})`);
        } else {
          await confirmButton.click();
        }
        await this.page.waitForTimeout(1000);
      }
    } catch {
    }
    
    await this.page.waitForTimeout(1000);
    console.log(`✅ Ponto ${action} marcado com sucesso`);
  }

  async takeScreenshot(): Promise<string> {
    if (!this.page) throw new Error('Page não inicializada');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join('screenshots', `ponto-${timestamp}.png`);
    
    await fs.mkdir('screenshots', { recursive: true });
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    
    return screenshotPath;
  }

  async dumpHTML(): Promise<string> {
    if (!this.page) throw new Error('Page não inicializada');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const htmlPath = path.join('logs', `page-${timestamp}.html`);
    
    await fs.mkdir('logs', { recursive: true });
    const html = await this.page.content();
    await fs.writeFile(htmlPath, html, 'utf-8');
    
    return htmlPath;
  }

  async writeLog(logEntry: LogEntry): Promise<void> {
    const logPath = path.join('logs', 'execution.log');
    await fs.mkdir('logs', { recursive: true });
    
    const logLine = `${JSON.stringify(logEntry)}\n`;
    await fs.appendFile(logPath, logLine, 'utf-8');
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
  }

  async run(action: 'start' | 'stop', scheduledTime?: string): Promise<void> {
    const actualTime = new Date().toISOString();
    const logEntry: LogEntry = {
      scheduledTime: scheduledTime || actualTime,
      actualTime,
      action,
      status: 'error'
    };

    try {
      console.log(`Iniciando execução - ${action} às ${actualTime}`);
      
      await this.init();
      await this.login();
      await this.navigateToFuncao();
      await this.marcarPonto(action);
      
      logEntry.screenshotPath = await this.takeScreenshot();
      logEntry.htmlDumpPath = await this.dumpHTML();
      
      logEntry.status = 'success';
      console.log('Execução concluída com sucesso');
      
    } catch (error) {
      logEntry.error = error instanceof Error ? error.message : String(error);
      console.error('Erro durante execução:', logEntry.error);
      
      try {
        logEntry.screenshotPath = await this.takeScreenshot();
        logEntry.htmlDumpPath = await this.dumpHTML();
      } catch {
      }
      
      throw error;
    } finally {
      await this.writeLog(logEntry);
      await this.close();
    }
  }
}

async function main() {
  if (process.argv.length < 3) {
    console.error('Uso: ts-node run-once.ts <start|stop> [scheduledTime]');
    process.exit(1);
  }

  const action = process.argv[2] as 'start' | 'stop';
  const scheduledTime = process.argv[3];

  if (action !== 'start' && action !== 'stop') {
    console.error('Ação deve ser "start" ou "stop"');
    process.exit(1);
  }

  const bot = new LGPontoBot();
  
  try {
    await bot.run(action, scheduledTime);
  } catch (error) {
    console.error('Falha na execução:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { LGPontoBot };