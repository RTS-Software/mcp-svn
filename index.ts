#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Import SVN service
import { SvnService } from "./tools/svn-service.js";
import { formatDuration } from "./common/utils.js";

import { VERSION } from "./common/version.js";

// Create the MCP Server with proper configuration
const server = new McpServer({
  name: "svn-mcp-server",
  version: VERSION,
});

// Create SVN service instance (lazy initialization)
let svnService: SvnService | null = null;

function getSvnService(): SvnService {
  if (!svnService) {
    try {
      svnService = new SvnService();
    } catch (error: any) {
      throw new Error(`SVN configuration error: ${error.message}`);
    }
  }
  return svnService;
}

// ----- HERRAMIENTAS MCP PARA SUBVERSION (SVN) -----

// 1. Health Check del sistema SVN
server.tool(
  "svn_health_check",
  "Verificar el estado de salud del sistema SVN y working copy",
  {},
  async () => {
    try {
      const result = await getSvnService().healthCheck();
      
      const data = result.data;
      const statusIcon = data?.svnAvailable ? '✅' : '❌';
      const wcIcon = data?.workingCopyValid ? '📁' : '📂';
      const repoIcon = data?.repositoryAccessible ? '🔗' : '🔌';
      
      const healthText = `${statusIcon} **Estado del Sistema SVN**\n\n` +
        `**SVN Disponible:** ${data?.svnAvailable ? 'Sí' : 'No'}\n` +
        `**Versión:** ${data?.version || 'N/A'}\n` +
        `${wcIcon} **Working Copy Válido:** ${data?.workingCopyValid ? 'Sí' : 'No'}\n` +
        `${repoIcon} **Repositorio Accesible:** ${data?.repositoryAccessible ? 'Sí' : 'No'}\n` +
        `**Directorio de Trabajo:** ${result.workingDirectory}`;

      return {
        content: [{ type: "text", text: healthText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

// 1.1. Diagnóstico avanzado de comandos SVN
server.tool(
  "svn_diagnose",
  "Diagnosticar problemas específicos con comandos SVN",
  {},
  async () => {
    try {
      const result = await getSvnService().diagnoseCommands();
      const data = result.data!;
      
      const statusLocalIcon = data.statusLocal ? '✅' : '❌';
      const statusRemoteIcon = data.statusRemote ? '✅' : '❌';
      const logIcon = data.logBasic ? '✅' : '❌';
      
      let diagnosticText = `🔍 **Diagnóstico de Comandos SVN**\n\n` +
        `**Directorio de Trabajo:** ${data.workingCopyPath}\n\n` +
        `${statusLocalIcon} **Status Local:** ${data.statusLocal ? 'Funciona' : 'Falló'}\n` +
        `${statusRemoteIcon} **Status Remoto:** ${data.statusRemote ? 'Funciona' : 'Falló'}\n` +
        `${logIcon} **Log Básico:** ${data.logBasic ? 'Funciona' : 'Falló'}\n`;
      
      if (data.errors.length > 0) {
        diagnosticText += `\n**Errores Detectados:**\n`;
        data.errors.forEach((error, index) => {
          diagnosticText += `${index + 1}. ${error}\n`;
        });
      }
      
      // Añadir sugerencias basadas en los errores
      if (!data.statusRemote || !data.logBasic) {
        diagnosticText += `\n**Posibles Soluciones:**\n`;
        diagnosticText += `• Verificar conexión a internet\n`;
        diagnosticText += `• Verificar credenciales de SVN\n`;
        diagnosticText += `• Ejecutar 'svn cleanup' si hay problemas de lock\n`;
        diagnosticText += `• Verificar que el working copy esté actualizado\n`;
      }

      return {
        content: [{ type: "text", text: diagnosticText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error en diagnóstico:** ${error.message}` }],
      };
    }
  }
);

// 2. Obtener información del repositorio
server.tool(
  "svn_info",
  "Obtener información detallada del working copy o archivo específico",
  {
    path: z.string().optional().describe("Ruta específica a consultar (opcional)")
  },
  async (args) => {
    try {
      const result = await getSvnService().getInfo(args.path);
      const info = result.data!;
      
      const infoText = `📋 **Información SVN**\n\n` +
        `**Ruta:** ${info.path}\n` +
        `**URL:** ${info.url}\n` +
        `**URL Relativa:** ${info.relativeUrl}\n` +
        `**Raíz del Repositorio:** ${info.repositoryRoot}\n` +
        `**UUID:** ${info.repositoryUuid}\n` +
        `**Revisión:** ${info.revision}\n` +
        `**Tipo de Nodo:** ${info.nodeKind}\n` +
        `**Último Autor:** ${info.lastChangedAuthor}\n` +
        `**Última Revisión:** ${info.lastChangedRev}\n` +
        `**Última Fecha:** ${info.lastChangedDate}\n` +
        `**Raíz Working Copy:** ${info.workingCopyRootPath}\n` +
        `**Tiempo de Ejecución:** ${formatDuration(result.executionTime || 0)}`;

      return {
        content: [{ type: "text", text: infoText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

// 3. Obtener estado de archivos
server.tool(
  "svn_status",
  "Ver el estado de archivos en el working copy",
  {
    path: z.string().optional().describe("Ruta específica a consultar"),
    showAll: z.boolean().optional().default(false).describe("Mostrar estado remoto también")
  },
  async (args) => {
    try {
      const result = await getSvnService().getStatus(args.path, args.showAll);
      const statusList = result.data!;
      
      if (statusList.length === 0) {
        return {
          content: [{ type: "text", text: "✅ **No hay cambios en el working copy**" }],
        };
      }

             const statusText = `📊 **Estado SVN** (${statusList.length} elementos)\n\n` +
         statusList.map(status => {
           const statusIcon: {[key: string]: string} = {
             'added': '➕',
             'deleted': '➖',
             'modified': '✏️',
             'replaced': '🔄',
             'merged': '🔀',
             'conflicted': '⚠️',
             'ignored': '🙈',
             'none': '⚪',
             'normal': '✅',
             'external': '🔗',
             'incomplete': '⏸️',
             'unversioned': '❓',
             'missing': '❌'
           };
           
           return `${statusIcon[status.status] || '📄'} **${status.status.toUpperCase()}** - ${status.path}`;
         }).join('\n') +
         `\n\n**Tiempo de Ejecución:** ${formatDuration(result.executionTime || 0)}`;

       return {
         content: [{ type: "text", text: statusText }],
       };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

// 4. Obtener historial de cambios
server.tool(
  "svn_log",
  "Ver historial de commits del repositorio",
  {
    path: z.string().optional().describe("Ruta específica"),
    limit: z.number().optional().default(10).describe("Número máximo de entradas"),
    revision: z.string().optional().describe("Revisión específica o rango (ej: 100:200)")
  },
  async (args) => {
    try {
      const result = await getSvnService().getLog(args.path, args.limit, args.revision);
      const logEntries = result.data!;
      
      if (logEntries.length === 0) {
        return {
          content: [{ type: "text", text: "📝 **No se encontraron entradas en el log**" }],
        };
      }

      const logText = `📚 **Historial SVN** (${logEntries.length} entradas)\n\n` +
        logEntries.map((entry, index) => 
          `**${index + 1}. Revisión ${entry.revision}**\n` +
          `👤 **Autor:** ${entry.author}\n` +
          `📅 **Fecha:** ${entry.date}\n` +
          `💬 **Mensaje:** ${entry.message || 'Sin mensaje'}\n` +
          `---`
        ).join('\n\n') +
        `\n**Tiempo de Ejecución:** ${formatDuration(result.executionTime || 0)}`;

      return {
        content: [{ type: "text", text: logText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

// 5. Ver diferencias
server.tool(
  "svn_diff",
  "Ver diferencias entre versiones de archivos",
  {
    path: z.string().optional().describe("Ruta específica"),
    oldRevision: z.string().optional().describe("Revisión antigua"),
    newRevision: z.string().optional().describe("Revisión nueva")
  },
  async (args) => {
    try {
      const result = await getSvnService().getDiff(args.path, args.oldRevision, args.newRevision);
      const diffOutput = result.data!;
      
      if (!diffOutput || diffOutput.trim().length === 0) {
        return {
          content: [{ type: "text", text: "✅ **No hay diferencias encontradas**" }],
        };
      }

      const diffText = `🔍 **Diferencias SVN**\n\n` +
        `**Comando:** ${result.command}\n` +
        `**Tiempo de Ejecución:** ${formatDuration(result.executionTime || 0)}\n\n` +
        `\`\`\`diff\n${diffOutput}\n\`\`\``;

      return {
        content: [{ type: "text", text: diffText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

// 6. Checkout de repositorio
server.tool(
  "svn_checkout",
  "Hacer checkout de un repositorio SVN",
  {
    url: z.string().describe("URL del repositorio SVN"),
    path: z.string().optional().describe("Directorio destino"),
    revision: z.union([z.number(), z.literal("HEAD")]).optional().describe("Revisión específica"),
    depth: z.enum(["empty", "files", "immediates", "infinity"]).optional().describe("Profundidad del checkout"),
    force: z.boolean().optional().default(false).describe("Forzar checkout"),
    ignoreExternals: z.boolean().optional().default(false).describe("Ignorar externals")
  },
  async (args) => {
    try {
      const options = {
        revision: args.revision,
        depth: args.depth,
        force: args.force,
        ignoreExternals: args.ignoreExternals
      };
      
      const result = await getSvnService().checkout(args.url, args.path, options);
      
      const checkoutText = `📥 **Checkout Completado**\n\n` +
        `**URL:** ${args.url}\n` +
        `**Destino:** ${args.path || 'Directorio actual'}\n` +
        `**Comando:** ${result.command}\n` +
        `**Tiempo de Ejecución:** ${formatDuration(result.executionTime || 0)}\n\n` +
        `**Resultado:**\n\`\`\`\n${result.data}\n\`\`\``;

      return {
        content: [{ type: "text", text: checkoutText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

// 7. Actualizar working copy
server.tool(
  "svn_update",
  "Actualizar working copy desde el repositorio",
  {
    path: z.string().optional().describe("Ruta específica a actualizar"),
    revision: z.union([z.number(), z.literal("HEAD"), z.literal("BASE"), z.literal("COMMITTED"), z.literal("PREV")]).optional().describe("Revisión objetivo"),
    force: z.boolean().optional().default(false).describe("Forzar actualización"),
    ignoreExternals: z.boolean().optional().default(false).describe("Ignorar externals"),
    acceptConflicts: z.enum(["postpone", "base", "mine-conflict", "theirs-conflict", "mine-full", "theirs-full"]).optional().describe("Como manejar conflictos")
  },
  async (args) => {
    try {
      const options = {
        revision: args.revision,
        force: args.force,
        ignoreExternals: args.ignoreExternals,
        acceptConflicts: args.acceptConflicts
      };
      
      const result = await getSvnService().update(args.path, options);
      
      const updateText = `🔄 **Actualización Completada**\n\n` +
        `**Ruta:** ${args.path || 'Directorio actual'}\n` +
        `**Comando:** ${result.command}\n` +
        `**Tiempo de Ejecución:** ${formatDuration(result.executionTime || 0)}\n\n` +
        `**Resultado:**\n\`\`\`\n${result.data}\n\`\`\``;

      return {
        content: [{ type: "text", text: updateText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

// 8. Añadir archivos
server.tool(
  "svn_add",
  "Añadir archivos al control de versiones",
  {
    paths: z.union([z.string(), z.array(z.string())]).describe("Archivo(s) o directorio(s) a añadir"),
    force: z.boolean().optional().default(false).describe("Forzar adición"),
    noIgnore: z.boolean().optional().default(false).describe("No respetar reglas de ignore"),
    parents: z.boolean().optional().default(false).describe("Crear directorios padre si es necesario"),
    autoProps: z.boolean().optional().describe("Aplicar auto-propiedades"),
    noAutoProps: z.boolean().optional().describe("No aplicar auto-propiedades")
  },
  async (args) => {
    try {
      const options = {
        force: args.force,
        noIgnore: args.noIgnore,
        parents: args.parents,
        autoProps: args.autoProps,
        noAutoProps: args.noAutoProps
      };
      
      const result = await getSvnService().add(args.paths, options);
      const pathsArray = Array.isArray(args.paths) ? args.paths : [args.paths];
      
      const addText = `➕ **Archivos Añadidos**\n\n` +
        `**Archivos:** ${pathsArray.join(', ')}\n` +
        `**Comando:** ${result.command}\n` +
        `**Tiempo de Ejecución:** ${formatDuration(result.executionTime || 0)}\n\n` +
        `**Resultado:**\n\`\`\`\n${result.data}\n\`\`\``;

      return {
        content: [{ type: "text", text: addText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

// 9. Commit de cambios
server.tool(
  "svn_commit",
  "Confirmar cambios al repositorio",
  {
    message: z.string().describe("Mensaje del commit"),
    paths: z.array(z.string()).optional().describe("Archivos específicos a confirmar"),
    file: z.string().optional().describe("Archivo con mensaje de commit"),
    force: z.boolean().optional().default(false).describe("Forzar commit"),
    keepLocks: z.boolean().optional().default(false).describe("Mantener locks después del commit"),
    noUnlock: z.boolean().optional().default(false).describe("No desbloquear archivos")
  },
  async (args) => {
    try {
      const options = {
        message: args.message,
        file: args.file,
        force: args.force,
        keepLocks: args.keepLocks,
        noUnlock: args.noUnlock
      };
      
      const result = await getSvnService().commit(options, args.paths);
      
      const commitText = `✅ **Commit Realizado**\n\n` +
        `**Mensaje:** ${args.message}\n` +
        `**Archivos:** ${args.paths?.join(', ') || 'Todos los cambios'}\n` +
        `**Comando:** ${result.command}\n` +
        `**Tiempo de Ejecución:** ${formatDuration(result.executionTime || 0)}\n\n` +
        `**Resultado:**\n\`\`\`\n${result.data}\n\`\`\``;

      return {
        content: [{ type: "text", text: commitText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

// 10. Eliminar archivos
server.tool(
  "svn_delete",
  "Eliminar archivos del control de versiones",
  {
    paths: z.union([z.string(), z.array(z.string())]).describe("Archivo(s) o directorio(s) a eliminar"),
    message: z.string().optional().describe("Mensaje para eliminación directa en repositorio"),
    force: z.boolean().optional().default(false).describe("Forzar eliminación"),
    keepLocal: z.boolean().optional().default(false).describe("Mantener copia local")
  },
  async (args) => {
    try {
      const options = {
        message: args.message,
        force: args.force,
        keepLocal: args.keepLocal
      };
      
      const result = await getSvnService().delete(args.paths, options);
      const pathsArray = Array.isArray(args.paths) ? args.paths : [args.paths];
      
      const deleteText = `🗑️ **Archivos Eliminados**\n\n` +
        `**Archivos:** ${pathsArray.join(', ')}\n` +
        `**Mantener Local:** ${args.keepLocal ? 'Sí' : 'No'}\n` +
        `**Comando:** ${result.command}\n` +
        `**Tiempo de Ejecución:** ${formatDuration(result.executionTime || 0)}\n\n` +
        `**Resultado:**\n\`\`\`\n${result.data}\n\`\`\``;

      return {
        content: [{ type: "text", text: deleteText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

// 11. Revertir cambios
server.tool(
  "svn_revert",
  "Revertir cambios locales en archivos",
  {
    paths: z.union([z.string(), z.array(z.string())]).describe("Archivo(s) o directorio(s) a revertir")
  },
  async (args) => {
    try {
      const result = await getSvnService().revert(args.paths);
      const pathsArray = Array.isArray(args.paths) ? args.paths : [args.paths];
      
      const revertText = `↩️ **Cambios Revertidos**\n\n` +
        `**Archivos:** ${pathsArray.join(', ')}\n` +
        `**Comando:** ${result.command}\n` +
        `**Tiempo de Ejecución:** ${formatDuration(result.executionTime || 0)}\n\n` +
        `**Resultado:**\n\`\`\`\n${result.data}\n\`\`\``;

      return {
        content: [{ type: "text", text: revertText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

// 12. Limpiar working copy
server.tool(
  "svn_cleanup",
  "Limpiar working copy de operaciones interrumpidas",
  {
    path: z.string().optional().describe("Ruta específica a limpiar")
  },
  async (args) => {
    try {
      const result = await getSvnService().cleanup(args.path);
      
      const cleanupText = `🧹 **Cleanup Completado**\n\n` +
        `**Ruta:** ${args.path || 'Directorio actual'}\n` +
        `**Comando:** ${result.command}\n` +
        `**Tiempo de Ejecución:** ${formatDuration(result.executionTime || 0)}\n\n` +
        `**Resultado:**\n\`\`\`\n${result.data}\n\`\`\``;

      return {
        content: [{ type: "text", text: cleanupText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Error:** ${error.message}` }],
      };
    }
  }
);

async function runServer() {
  try {
    console.error("Creating SVN MCP Server...");
    console.error("Server info: svn-mcp-server");
    console.error("Version:", VERSION);
    
    // Validate environment variables
    if (!process.env.SVN_PATH) {
      console.error("Info: SVN_PATH environment variable not set, using 'svn' from PATH");
    } else {
      console.error("SVN_PATH:", process.env.SVN_PATH);
    }
    
    if (!process.env.SVN_WORKING_DIRECTORY) {
      console.error("Info: SVN_WORKING_DIRECTORY not set, using current directory");
    } else {
      console.error("SVN_WORKING_DIRECTORY:", process.env.SVN_WORKING_DIRECTORY);
    }
    
    if (process.env.SVN_USERNAME) {
      console.error("SVN_USERNAME:", process.env.SVN_USERNAME);
    }
    
    if (process.env.SVN_PASSWORD) {
      console.error("SVN_PASSWORD:", "***");
    }
    
    console.error("Starting SVN MCP Server in stdio mode...");
    
    // Create transport
    const transport = new StdioServerTransport();
    
    console.error("Connecting server to transport...");
    
    // Connect server to transport - this should keep the process alive
    await server.connect(transport);
    
    console.error("MCP Server connected and ready!");
    console.error("Available tools:", [
      "svn_health_check",
      "svn_info",
      "svn_status",
      "svn_log",
      "svn_diff",
      "svn_checkout",
      "svn_update",
      "svn_add",
      "svn_commit",
      "svn_delete",
      "svn_revert",
      "svn_cleanup"
    ]);
    
  } catch (error) {
    console.error("Error starting server:", error);
    console.error("Stack trace:", (error as Error).stack);
    process.exit(1);
  }
}

// Start the server
runServer(); 