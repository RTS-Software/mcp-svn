import {
  SvnConfig,
  SvnResponse,
  SvnInfo,
  SvnStatus,
  SvnLogEntry,
  SvnCheckoutOptions,
  SvnUpdateOptions,
  SvnCommitOptions,
  SvnAddOptions,
  SvnDeleteOptions,
  SvnError
} from '../common/types.js';

import {
  createSvnConfig,
  executeSvnCommand,
  parseInfoOutput,
  parseStatusOutput,
  parseLogOutput,
  validateSvnInstallation,
  isWorkingCopy,
  normalizePath,
  validatePath,
  validateSvnUrl,
  cleanOutput,
  formatDuration,
  clearSvnCredentials
} from '../common/utils.js';

export class SvnService {
  private config: SvnConfig;

  constructor(config: Partial<SvnConfig> = {}) {
    this.config = createSvnConfig(config);
  }

  /**
   * Función auxiliar para manejar errores comunes de SVN
   */
  private handleSvnError(error: any, operation: string): never {
    let message = `Failed to ${operation}`;
    
    if (error.message.includes('E155007') || error.message.includes('not a working copy')) {
      message = `El directorio '${this.config.workingDirectory}' no es un working copy de SVN. Asegúrate de estar en un directorio que contenga un repositorio SVN o hacer checkout primero.`;
    } else if (error.message.includes('E175002') || error.message.includes('Unable to connect')) {
      message = `No se puede conectar al repositorio SVN. Verifica tu conexión a internet y las credenciales.`;
    } else if (error.message.includes('E170001') || error.message.includes('Authentication failed')) {
      message = `Error de autenticación. Verifica tu nombre de usuario y contraseña SVN.`;
    } else if (error.message.includes('E155036') || error.message.includes('working copy locked')) {
      message = `El working copy está bloqueado. Ejecuta 'svn cleanup' para resolverlo.`;
    } else if (error.message.includes('E200030') || error.message.includes('sqlite')) {
      message = `Error en la base de datos del working copy. Ejecuta 'svn cleanup' para repararlo.`;
    } else if (error.stderr && error.stderr.length > 0) {
      message = `${message}: ${error.stderr}`;
    } else {
      message = `${message}: ${error.message}`;
    }
    
    throw new SvnError(message);
  }

  /**
   * Verificar que SVN está disponible y configurado correctamente
   */
  async healthCheck(): Promise<SvnResponse<{
    svnAvailable: boolean;
    version?: string;
    workingCopyValid?: boolean;
    repositoryAccessible?: boolean;
  }>> {
    try {
      // Verificar instalación de SVN
      const svnAvailable = await validateSvnInstallation(this.config);
      if (!svnAvailable) {
        return {
          success: false,
          error: 'SVN is not available in the system PATH',
          command: 'svn --version',
          workingDirectory: this.config.workingDirectory!
        };
      }

      // Obtener versión de SVN
      const versionResponse = await executeSvnCommand(this.config, ['--version', '--quiet']);
      const version = versionResponse.data as string;

      // Verificar si estamos en un working copy
      const workingCopyValid = await isWorkingCopy(this.config.workingDirectory!);

      let repositoryAccessible = false;
      if (workingCopyValid) {
        try {
          await this.getInfo();
          repositoryAccessible = true;
        } catch (error) {
          repositoryAccessible = false;
        }
      }

      return {
        success: true,
        data: {
          svnAvailable,
          version: version.trim(),
          workingCopyValid,
          repositoryAccessible
        },
        command: 'health-check',
        workingDirectory: this.config.workingDirectory!
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        command: 'health-check',
        workingDirectory: this.config.workingDirectory!
      };
    }
  }

  /**
   * Obtener información del working copy o directorio específico
   */
  async getInfo(path?: string): Promise<SvnResponse<SvnInfo>> {
    try {
      const args = ['info'];
      if (path) {
        // Check if it's a URL or a local path
        if (validateSvnUrl(path)) {
          // It's a URL, add it directly without normalization
          args.push(path);
        } else if (validatePath(path)) {
          // It's a local path, normalize it
          args.push(normalizePath(path));
        } else {
          throw new SvnError(`Invalid path or URL: ${path}`);
        }
      }

      const response = await executeSvnCommand(this.config, args);
      const info = parseInfoOutput(cleanOutput(response.data as string));

      return {
        success: true,
        data: info,
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      this.handleSvnError(error, 'get SVN info');
    }
  }

  /**
   * Obtener estado de archivos en el working copy
   */
  async getStatus(path?: string, showAll: boolean = false): Promise<SvnResponse<SvnStatus[]>> {
    try {
      const args = ['status'];
      
      if (path) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
        args.push(normalizePath(path));
      }

      let response;
      
      // Si showAll es true, intentar primero con --show-updates
      if (showAll) {
        try {
          const argsWithUpdates = [...args, '--show-updates'];
          response = await executeSvnCommand(this.config, argsWithUpdates);
        } catch (error: any) {
          // Si falla con --show-updates, intentar sin él
          console.warn(`Warning: --show-updates failed, falling back to local status only: ${error.message}`);
          response = await executeSvnCommand(this.config, args);
        }
      } else {
        response = await executeSvnCommand(this.config, args);
      }

      const statusList = parseStatusOutput(cleanOutput(response.data as string));

      return {
        success: true,
        data: statusList,
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      this.handleSvnError(error, 'get SVN status');
    }
  }

  /**
   * Obtener historial de cambios (log)
   */
  async getLog(
    path?: string, 
    limit?: number, 
    revision?: string
  ): Promise<SvnResponse<SvnLogEntry[]>> {
    try {
      const args = ['log'];
      
      if (limit && limit > 0) {
        args.push('--limit', limit.toString());
      }
      
      if (revision) {
        args.push('--revision', revision);
      }
      
      if (path) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
        args.push(normalizePath(path));
      }

      let response;
      try {
        response = await executeSvnCommand(this.config, args);
      } catch (error: any) {
        // Detectar si SVN no está instalado
        if ((error.message.includes('spawn') && error.message.includes('ENOENT')) ||
            error.code === 127) {
          const enhancedError = new SvnError(
            'SVN no está instalado o no se encuentra en el PATH del sistema. Instala Subversion para usar este comando.'
          );
          enhancedError.command = error.command;
          enhancedError.code = error.code;
          throw enhancedError;
        }
        
        // Detectar errores de red/conectividad y proporcionar mensajes más útiles
        if (error.message.includes('E175002') || 
            error.message.includes('Unable to connect') ||
            error.message.includes('Connection refused') ||
            error.message.includes('Network is unreachable') ||
            error.code === 1) {
          
          // Intentar con opciones que funcionen sin conectividad remota si es posible
          console.warn(`Log remoto falló, posible problema de conectividad: ${error.message}`);
          
          // Para comandos log, podemos intentar usar --offline si está disponible, 
          // o proporcionar una respuesta vacía con información útil
          const enhancedError = new SvnError(
            `No se pudo obtener el historial de cambios. Posibles causas:
            - Sin conectividad al servidor SVN
            - Credenciales requeridas pero no proporcionadas
            - Servidor SVN temporalmente inaccesible
            - Working copy no sincronizado con el repositorio remoto`
          );
          enhancedError.command = error.command;
          enhancedError.stderr = error.stderr;
          enhancedError.code = error.code;
          throw enhancedError;
        }
        // Re-lanzar otros errores sin modificar
        throw error;
      }

      const logEntries = parseLogOutput(cleanOutput(response.data as string));

      return {
        success: true,
        data: logEntries,
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      this.handleSvnError(error, 'get SVN log');
    }
  }

  /**
   * Obtener diferencias entre versiones
   */
  async getDiff(
    path?: string,
    oldRevision?: string,
    newRevision?: string
  ): Promise<SvnResponse<string>> {
    try {
      const args = ['diff'];
      
      if (oldRevision && newRevision) {
        args.push('--old', `${path || '.'}@${oldRevision}`);
        args.push('--new', `${path || '.'}@${newRevision}`);
      } else if (oldRevision) {
        args.push('--revision', oldRevision);
        if (path) {
          args.push(normalizePath(path));
        }
      } else if (path) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
        args.push(normalizePath(path));
      }

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to get SVN diff: ${error.message}`);
    }
  }

  /**
   * Checkout de un repositorio
   */
  async checkout(
    url: string,
    path?: string,
    options: SvnCheckoutOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      if (!validateSvnUrl(url)) {
        throw new SvnError(`Invalid SVN URL: ${url}`);
      }

      const args = ['checkout'];
      
      if (options.revision) {
        args.push('--revision', options.revision.toString());
      }
      
      if (options.depth) {
        args.push('--depth', options.depth);
      }
      
      if (options.force) {
        args.push('--force');
      }
      
      if (options.ignoreExternals) {
        args.push('--ignore-externals');
      }

      args.push(url);
      
      if (path) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
        args.push(normalizePath(path));
      }

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to checkout: ${error.message}`);
    }
  }

  /**
   * Actualizar working copy
   */
  async update(
    path?: string,
    options: SvnUpdateOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      const args = ['update'];
      
      if (options.revision) {
        args.push('--revision', options.revision.toString());
      }
      
      if (options.force) {
        args.push('--force');
      }
      
      if (options.ignoreExternals) {
        args.push('--ignore-externals');
      }
      
      if (options.acceptConflicts) {
        args.push('--accept', options.acceptConflicts);
      }
      
      if (path) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
        args.push(normalizePath(path));
      }

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to update: ${error.message}`);
    }
  }

  /**
   * Añadir archivos al control de versiones
   */
  async add(
    paths: string | string[],
    options: SvnAddOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      
      // Validar todas las rutas
      for (const path of pathArray) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
      }

      const args = ['add'];
      
      if (options.force) {
        args.push('--force');
      }
      
      if (options.noIgnore) {
        args.push('--no-ignore');
      }
      
      if (options.autoProps) {
        args.push('--auto-props');
      }
      
      if (options.noAutoProps) {
        args.push('--no-auto-props');
      }
      
      if (options.parents) {
        args.push('--parents');
      }

      // Añadir rutas normalizadas
      args.push(...pathArray.map(p => normalizePath(p)));

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to add files: ${error.message}`);
    }
  }

  /**
   * Confirmar cambios al repositorio
   */
  async commit(
    options: SvnCommitOptions,
    paths?: string[]
  ): Promise<SvnResponse<string>> {
    try {
      if (!options.message && !options.file) {
        throw new SvnError('Commit message is required');
      }

      const args = ['commit'];
      
      if (options.message) {
        args.push('--message', options.message);
      }
      
      if (options.file) {
        args.push('--file', normalizePath(options.file));
      }
      
      if (options.force) {
        args.push('--force');
      }
      
      if (options.keepLocks) {
        args.push('--keep-locks');
      }
      
      if (options.noUnlock) {
        args.push('--no-unlock');
      }

      // Añadir rutas específicas si se proporcionan
      if (paths && paths.length > 0) {
        for (const path of paths) {
          if (!validatePath(path)) {
            throw new SvnError(`Invalid path: ${path}`);
          }
        }
        args.push(...paths.map(p => normalizePath(p)));
      } else if (options.targets) {
        args.push(...options.targets.map(p => normalizePath(p)));
      }

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to commit: ${error.message}`);
    }
  }

  /**
   * Eliminar archivos del control de versiones
   */
  async delete(
    paths: string | string[],
    options: SvnDeleteOptions = {}
  ): Promise<SvnResponse<string>> {
    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      
      // Validar todas las rutas
      for (const path of pathArray) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
      }

      const args = ['delete'];
      
      if (options.force) {
        args.push('--force');
      }
      
      if (options.keepLocal) {
        args.push('--keep-local');
      }
      
      if (options.message) {
        args.push('--message', options.message);
      }

      // Añadir rutas normalizadas
      args.push(...pathArray.map(p => normalizePath(p)));

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to delete files: ${error.message}`);
    }
  }

  /**
   * Revertir cambios locales
   */
  async revert(paths: string | string[]): Promise<SvnResponse<string>> {
    try {
      const pathArray = Array.isArray(paths) ? paths : [paths];
      
      // Validar todas las rutas
      for (const path of pathArray) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
      }

      const args = ['revert'];
      
      // Añadir rutas normalizadas
      args.push(...pathArray.map(p => normalizePath(p)));

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to revert files: ${error.message}`);
    }
  }

  /**
   * Limpiar working copy
   */
  async cleanup(path?: string): Promise<SvnResponse<string>> {
    try {
      const args = ['cleanup'];
      
      if (path) {
        if (!validatePath(path)) {
          throw new SvnError(`Invalid path: ${path}`);
        }
        args.push(normalizePath(path));
      }

      const response = await executeSvnCommand(this.config, args);

      return {
        success: true,
        data: cleanOutput(response.data as string),
        command: response.command,
        workingDirectory: response.workingDirectory,
        executionTime: response.executionTime
      };

    } catch (error: any) {
      throw new SvnError(`Failed to cleanup: ${error.message}`);
    }
  }

  /**
   * Diagnóstico específico para comandos problemáticos
   */
  async diagnoseCommands(): Promise<SvnResponse<{
    statusLocal: boolean;
    statusRemote: boolean;
    logBasic: boolean;
    workingCopyPath: string;
    errors: string[];
    suggestions: string[];
  }>> {
    const results = {
      statusLocal: false,
      statusRemote: false,
      logBasic: false,
      workingCopyPath: this.config.workingDirectory!,
      errors: [] as string[],
      suggestions: [] as string[]
    };

    try {
      // Probar svn status local
      try {
        await executeSvnCommand(this.config, ['status']);
        results.statusLocal = true;
      } catch (error: any) {
        const errorMsg = this.categorizeError(error, 'status local');
        results.errors.push(errorMsg.message);
        if (errorMsg.suggestion) {
          results.suggestions.push(errorMsg.suggestion);
        }
      }

      // Probar svn status con --show-updates
      try {
        await executeSvnCommand(this.config, ['status', '--show-updates']);
        results.statusRemote = true;
      } catch (error: any) {
        const errorMsg = this.categorizeError(error, 'status remoto');
        results.errors.push(errorMsg.message);
        if (errorMsg.suggestion) {
          results.suggestions.push(errorMsg.suggestion);
        }
      }

      // Probar svn log básico
      try {
        await executeSvnCommand(this.config, ['log', '--limit', '1']);
        results.logBasic = true;
      } catch (error: any) {
        const errorMsg = this.categorizeError(error, 'log básico');
        results.errors.push(errorMsg.message);
        if (errorMsg.suggestion) {
          results.suggestions.push(errorMsg.suggestion);
        }
      }

      // Agregar sugerencias generales basadas en los resultados
      if (!results.statusRemote && !results.logBasic && results.statusLocal) {
        results.suggestions.push('Los comandos remotos fallan pero el local funciona. Revisa la conectividad de red y credenciales SVN.');
      }

      return {
        success: true,
        data: results,
        command: 'diagnostic',
        workingDirectory: this.config.workingDirectory!
      };

    } catch (error: any) {
      results.errors.push(`Error general: ${error.message}`);
      return {
        success: false,
        data: results,
        error: error.message,
        command: 'diagnostic',
        workingDirectory: this.config.workingDirectory!
      };
    }
  }

  /**
   * Categorizar errores y proporcionar sugerencias específicas
   */
  private categorizeError(error: any, commandType: string): { message: string; suggestion?: string } {
    const baseMessage = `${commandType} falló`;
    
    // SVN no encontrado en el sistema
    if ((error.message.includes('spawn') && error.message.includes('ENOENT')) ||
        error.code === 127) {
      return {
        message: `${baseMessage}: SVN no está instalado o no se encuentra en el PATH`,
        suggestion: 'Instala SVN (subversion) o verifica que esté en el PATH del sistema'
      };
    }
    
    // Errores de conectividad
    if (error.message.includes('E175002') || 
        error.message.includes('Unable to connect') ||
        error.message.includes('Connection refused') ||
        error.message.includes('Network is unreachable')) {
      return {
        message: `${baseMessage}: Sin conectividad al servidor SVN`,
        suggestion: 'Verifica tu conexión a internet y que el servidor SVN esté accesible'
      };
    }
    
    // Errores de autenticación - demasiados intentos
    if (error.message.includes('E215004') || 
        error.message.includes('No more credentials') ||
        error.message.includes('we tried too many times')) {
      return {
        message: `${baseMessage}: Demasiados intentos de autenticación fallidos`,
        suggestion: 'Las credenciales pueden estar incorrectas o cachadas. Limpia el cache de credenciales SVN y verifica SVN_USERNAME y SVN_PASSWORD'
      };
    }
    
    // Errores de autenticación generales
    if (error.message.includes('E170001') || 
        error.message.includes('Authentication failed') ||
        error.message.includes('authorization failed')) {
      return {
        message: `${baseMessage}: Error de autenticación`,
        suggestion: 'Verifica tus credenciales SVN (SVN_USERNAME y SVN_PASSWORD)'
      };
    }
    
    // Working copy no válido
    if (error.message.includes('E155007') || 
        error.message.includes('not a working copy')) {
      return {
        message: `${baseMessage}: No es un working copy válido`,
        suggestion: 'Asegúrate de estar en un directorio con checkout de SVN o ejecuta svn checkout primero'
      };
    }
    
    // Working copy bloqueado
    if (error.message.includes('E155036') || 
        error.message.includes('working copy locked')) {
      return {
        message: `${baseMessage}: Working copy bloqueado`,
        suggestion: 'Ejecuta "svn cleanup" para desbloquear el working copy'
      };
    }
    
    // Error genérico con código 1 (frecuente en comandos remotos)
    if (error.code === 1) {
      return {
        message: `${baseMessage}: Comando falló con código 1 (posible problema de red/autenticación)`,
        suggestion: 'Revisa conectividad de red, credenciales SVN, y que el repositorio sea accesible'
      };
    }
    
    // Error genérico
    return {
      message: `${baseMessage}: ${error.message}`,
      suggestion: undefined
    };
  }

  /**
   * Limpiar cache de credenciales SVN para resolver errores de autenticación
   */
  async clearCredentials(): Promise<SvnResponse> {
    return await clearSvnCredentials(this.config);
  }
} 