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
  formatDuration
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

      const response = await executeSvnCommand(this.config, args);
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
  }>> {
    const results = {
      statusLocal: false,
      statusRemote: false,
      logBasic: false,
      workingCopyPath: this.config.workingDirectory!,
      errors: [] as string[]
    };

    try {
      // Probar svn status local
      try {
        await executeSvnCommand(this.config, ['status']);
        results.statusLocal = true;
      } catch (error: any) {
        results.errors.push(`Status local falló: ${error.message}`);
      }

      // Probar svn status con --show-updates
      try {
        await executeSvnCommand(this.config, ['status', '--show-updates']);
        results.statusRemote = true;
      } catch (error: any) {
        results.errors.push(`Status remoto falló: ${error.message}`);
      }

      // Probar svn log básico
      try {
        await executeSvnCommand(this.config, ['log', '--limit', '1']);
        results.logBasic = true;
      } catch (error: any) {
        results.errors.push(`Log básico falló: ${error.message}`);
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
} 