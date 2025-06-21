import { spawn, SpawnOptions } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { SvnConfig, SvnResponse, SvnError, SvnInfo, SvnStatus, SvnLogEntry, SVN_STATUS_CODES } from './types.js';

/**
 * Crear configuración de SVN desde variables de entorno y parámetros
 */
export function createSvnConfig(overrides: Partial<SvnConfig> = {}): SvnConfig {
  return {
    svnPath: overrides.svnPath || process.env.SVN_PATH || 'svn',
    workingDirectory: overrides.workingDirectory || process.env.SVN_WORKING_DIRECTORY || process.cwd(),
    username: overrides.username || process.env.SVN_USERNAME,
    password: overrides.password || process.env.SVN_PASSWORD,
    timeout: overrides.timeout || parseInt(process.env.SVN_TIMEOUT || '30000', 10)
  };
}

/**
 * Validar que SVN esté disponible en el sistema
 */
export async function validateSvnInstallation(config: SvnConfig): Promise<boolean> {
  try {
    const result = await executeSvnCommand(config, ['--version', '--quiet']);
    return result.success;
  } catch (error) {
    return false;
  }
}

/**
 * Detectar si el directorio actual es un working copy de SVN
 */
export async function isWorkingCopy(workingDirectory: string): Promise<boolean> {
  try {
    const svnDir = path.join(workingDirectory, '.svn');
    return await promisify(fs.access)(svnDir).then(() => true).catch(() => false);
  } catch {
    return false;
  }
}

/**
 * Normalizar rutas para Windows
 */
export function normalizePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/');
}

/**
 * Escapar argumentos para línea de comandos en Windows
 */
export function escapeArgument(arg: string): string {
  // Si el argumento contiene espacios o caracteres especiales, lo encerramos en comillas
  if (/[\s&()<>[\]{}^=;!'+,`~%]/.test(arg)) {
    return `"${arg.replace(/"/g, '""')}"`;
  }
  return arg;
}

/**
 * Construir argumentos de autenticación
 */
export function buildAuthArgs(config: SvnConfig): string[] {
  const args: string[] = [];
  
  if (config.username) {
    args.push('--username', config.username);
  }
  
  if (config.password) {
    args.push('--password', config.password);
  }
  
  // Siempre usar --non-interactive para evitar prompts
  args.push('--non-interactive');
  
  return args;
}

/**
 * Ejecutar comando SVN con manejo de errores mejorado
 */
export async function executeSvnCommand(
  config: SvnConfig,
  args: string[],
  options: { input?: string; encoding?: BufferEncoding } = {}
): Promise<SvnResponse> {
  const startTime = Date.now();
  
  // Agregar argumentos de autenticación
  const finalArgs = [...args, ...buildAuthArgs(config)];
  const command = `${config.svnPath} ${finalArgs.join(' ')}`;
  
  return new Promise((resolve, reject) => {
    // Configurar opciones de spawn para Windows
    const spawnOptions: SpawnOptions = {
      cwd: config.workingDirectory,
      shell: true, // Importante para Windows
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Asegurar que SVN use UTF-8
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8'
      }
    };
    
    const childProcess = spawn(config.svnPath!, finalArgs, spawnOptions);
    
    let stdout = '';
    let stderr = '';
    
    // Configurar timeout
    const timeout = setTimeout(() => {
      childProcess.kill('SIGTERM');
      reject(new SvnError(`Command timeout after ${config.timeout}ms: ${command}`));
    }, config.timeout);
    
    // Capturar stdout
    childProcess.stdout?.on('data', (data) => {
      stdout += data.toString(options.encoding || 'utf8');
    });
    
    // Capturar stderr
    childProcess.stderr?.on('data', (data) => {
      stderr += data.toString(options.encoding || 'utf8');
    });
    
    // Enviar input si se proporciona
    if (options.input && childProcess.stdin) {
      childProcess.stdin.write(options.input);
      childProcess.stdin.end();
    }
    
    // Manejar finalización del proceso
    childProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      const executionTime = Date.now() - startTime;
      const response: SvnResponse = {
        success: code === 0,
        command,
        workingDirectory: config.workingDirectory!,
        executionTime
      };
      
      if (code === 0) {
        response.data = stdout.trim();
        resolve(response);
      } else {
        const error = new SvnError(`SVN command failed with code ${code}: ${command}`);
        error.code = code || undefined;
        error.stderr = stderr.trim();
        error.command = command;
        
        response.error = error.message;
        response.data = stderr.trim();
        
        reject(error);
      }
    });
    
    // Manejar errores del proceso
    childProcess.on('error', (error) => {
      clearTimeout(timeout);
      
      const svnError = new SvnError(`Failed to execute SVN command: ${error.message}`);
      svnError.command = command;
      
      reject(svnError);
    });
  });
}

/**
 * Parsear output XML de SVN
 */
export function parseXmlOutput(xmlString: string): any {
  // Implementación básica de parsing XML
  // En un entorno de producción, sería mejor usar una librería como xml2js
  try {
    // Esta es una implementación simplificada para Node.js
    // En navegadores se usaría DOMParser, pero en Node.js necesitamos otra aproximación
    const lines = xmlString.split('\n');
    const result: any = {};
    
    for (const line of lines) {
      const match = line.match(/<([^>]+)>([^<]+)<\/\1>/);
      if (match) {
        result[match[1]] = match[2];
      }
    }
    
    return result;
  } catch (error) {
    throw new SvnError(`Failed to parse XML output: ${error}`);
  }
}

/**
 * Parsear información de svn info
 */
export function parseInfoOutput(output: string): SvnInfo {
  const lines = output.split('\n');
  const info: Partial<SvnInfo> = {};
  
  for (const line of lines) {
    const [key, ...valueParts] = line.split(': ');
    const value = valueParts.join(': ').trim();
    
    switch (key.trim()) {
      case 'Path':
        info.path = value;
        break;
      case 'Working Copy Root Path':
        info.workingCopyRootPath = value;
        break;
      case 'URL':
        info.url = value;
        break;
      case 'Relative URL':
        info.relativeUrl = value;
        break;
      case 'Repository Root':
        info.repositoryRoot = value;
        break;
      case 'Repository UUID':
        info.repositoryUuid = value;
        break;
      case 'Revision':
        info.revision = parseInt(value, 10);
        break;
      case 'Node Kind':
        info.nodeKind = value as 'file' | 'directory';
        break;
      case 'Schedule':
        info.schedule = value;
        break;
      case 'Last Changed Author':
        info.lastChangedAuthor = value;
        break;
      case 'Last Changed Rev':
        info.lastChangedRev = parseInt(value, 10);
        break;
      case 'Last Changed Date':
        info.lastChangedDate = value;
        break;
      case 'Text Last Updated':
        info.textLastUpdated = value;
        break;
      case 'Checksum':
        info.checksum = value;
        break;
    }
  }
  
  return info as SvnInfo;
}

/**
 * Parsear output de svn status
 */
export function parseStatusOutput(output: string): SvnStatus[] {
  const lines = output.split('\n').filter(line => line.trim());
  const statusList: SvnStatus[] = [];
  
  for (const line of lines) {
    if (line.length < 8) continue;
    
    const statusCode = line[0];
    const propStatusCode = line[1];
    const path = line.substring(8).trim();
    
    const status: SvnStatus = {
      path,
      status: (SVN_STATUS_CODES as any)[statusCode] || 'unknown'
    };
    
    statusList.push(status);
  }
  
  return statusList;
}

/**
 * Parsear output de svn log
 */
export function parseLogOutput(output: string): SvnLogEntry[] {
  const entries: SvnLogEntry[] = [];
  const logEntries = output.split(/^-{72}$/gm).filter(entry => entry.trim());
  
  for (const entryText of logEntries) {
    const lines = entryText.trim().split('\n');
    if (lines.length < 2) continue;
    
    const headerLine = lines[0];
    const headerMatch = headerLine.match(/^r(\d+) \| ([^|]+) \| ([^|]+) \| (.+)$/);
    
    if (headerMatch) {
      const [, revision, author, date, details] = headerMatch;
      const message = lines.slice(2).join('\n').trim();
      
      entries.push({
        revision: parseInt(revision, 10),
        author: author.trim(),
        date: date.trim(),
        message
      });
    }
  }
  
  return entries;
}

/**
 * Formatear duración en milisegundos a formato legible
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Validar nombre de archivo/directorio
 */
export function validatePath(filePath: string): boolean {
  // Verificar que no contenga caracteres prohibidos en Windows
  const invalidChars = /[<>:"|?*]/;
  return !invalidChars.test(filePath);
}

/**
 * Obtener rutas relativas desde el directorio de trabajo
 */
export function getRelativePath(fullPath: string, workingDirectory: string): string {
  return path.relative(workingDirectory, fullPath).replace(/\\/g, '/');
}

/**
 * Validar URL de repositorio SVN
 */
export function validateSvnUrl(url: string): boolean {
  const svnUrlPattern = /^(svn|https?|file):\/\/.+/i;
  return svnUrlPattern.test(url);
}

/**
 * Limpiar y normalizar salida de comando
 */
export function cleanOutput(output: string): string {
  return output
    .replace(/\r\n/g, '\n')  // Normalizar line endings
    .replace(/\r/g, '\n')    // Convertir CR a LF
    .trim();
}

/**
 * Crear mensaje de error SVN más descriptivo
 */
export function createSvnError(message: string, command?: string, stderr?: string): SvnError {
  const error = new SvnError(message);
  if (command) error.command = command;
  if (stderr) error.stderr = stderr;
  return error;
} 