#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Import SVN service
import { SvnService } from "./tools/svn-service.js";
import { formatDuration } from "./common/utils.js";

import { VERSION } from "./common/version.js";

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os'; 

// Create the MCP Server with proper configuration
const server = new McpServer({
  name: "svn-mcp-server",
  version: VERSION,
});

// Create SVN service instance (lazy initialization)
let svnService: SvnService | null = null;

function logToFileParam(message: string, param: string): void {
  const logDir = 'C:\\Logs';
  const logFile = path.join(logDir, 'mcp_svn.log');
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}: ${param}${os.EOL}`);
  } catch (err) {
    // For debugging: print error to stderr
    console.error('Failed to write to log file:', err);
  }
}

function logToFile(m: string): void {
  logToFileParam(m, "");
}


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

// ----- MCP TOOLS FOR SUBVERSION (SVN) -----

// 1. SVN System Health Check
server.tool(
  "svn_health_check",
  "Check the health status of the SVN system and working copy",
  {},
  async () => {
    try {
      logToFile("Running svn_health_check tool");
      const result = await getSvnService().healthCheck();
      
      const data = result.data;
      const statusIcon = data?.svnAvailable ? '✅' : '❌';
      const wcIcon = data?.workingCopyValid ? '📁' : '📂';
      const repoIcon = data?.repositoryAccessible ? '🔗' : '🔌';
      
      const healthText = `${statusIcon} **SVN System Status**\n\n` +
        `**SVN Available:** ${data?.svnAvailable ? 'Yes' : 'No'}\n` +
        `**Version:** ${data?.version || 'N/A'}\n` +
        `${wcIcon} **Working Copy Valid:** ${data?.workingCopyValid ? 'Yes' : 'No'}\n` +
        `${repoIcon} **Repository Accessible:** ${data?.repositoryAccessible ? 'Yes' : 'No'}\n` +
        `**Working Directory:** ${result.workingDirectory}`;

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

// 1.1. Advanced SVN Command Diagnostics
server.tool(
  "svn_diagnose",
  "Diagnose specific problems with SVN commands",
  {},
  async () => {
    try {
      logToFile("Running svn_diagnose tool");
      const result = await getSvnService().diagnoseCommands();
      const data = result.data!;
      
      const statusLocalIcon = data.statusLocal ? '✅' : '❌';
      const statusRemoteIcon = data.statusRemote ? '✅' : '❌';
      const logIcon = data.logBasic ? '✅' : '❌';
      
      let diagnosticText = `🔍 **SVN Command Diagnostics**\n\n` +
        `**Working Directory:** ${data.workingCopyPath}\n\n` +
        `${statusLocalIcon} **Local Status:** ${data.statusLocal ? 'Works' : 'Failed'}\n` +
        `${statusRemoteIcon} **Remote Status:** ${data.statusRemote ? 'Works' : 'Failed'}\n` +
        `${logIcon} **Basic Log:** ${data.logBasic ? 'Works' : 'Failed'}\n`;
      
      if (data.errors.length > 0) {
        diagnosticText += `\n**Detected Errors:**\n`;
        data.errors.forEach((error, index) => {
          diagnosticText += `${index + 1}. ${error}\n`;
        });
      }
      
      // Add suggestions based on errors
      if (!data.statusRemote || !data.logBasic) {
        diagnosticText += `\n**Possible Solutions:**\n`;
        diagnosticText += `• Check internet connection\n`;
        diagnosticText += `• Check SVN credentials\n`;
        diagnosticText += `• Run 'svn cleanup' if there are lock issues\n`;
        diagnosticText += `• Ensure the working copy is up to date\n`;
      }

      return {
        content: [{ type: "text", text: diagnosticText }],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `❌ **Diagnosis Error:** ${error.message}` }],
      };
    }
  }
);

// 2. Get repository information
server.tool(
  "svn_info",
  "Get detailed information about the working copy or a specific file",
  {
    path: z.string().optional().describe("Specific path to query (optional)")
  },
  async (args) => {
    try {
      logToFile(`Running svn_info tool with path: ${args.path || 'current directory'}`);
      const result = await getSvnService().getInfo(args.path);
      const info = result.data!;
      
      const infoText = `📋 **SVN Information**\n\n` +
        `**Path:** ${info.path}\n` +
        `**URL:** ${info.url}\n` +
        `**Relative URL:** ${info.relativeUrl}\n` +
        `**Repository Root:** ${info.repositoryRoot}\n` +
        `**UUID:** ${info.repositoryUuid}\n` +
        `**Revision:** ${info.revision}\n` +
        `**Node Kind:** ${info.nodeKind}\n` +
        `**Last Author:** ${info.lastChangedAuthor}\n` +
        `**Last Revision:** ${info.lastChangedRev}\n` +
        `**Last Date:** ${info.lastChangedDate}\n` +
        `**Working Copy Root:** ${info.workingCopyRootPath}\n` +
        `**Execution Time:** ${formatDuration(result.executionTime || 0)}`;

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

// 3. Get file status
server.tool(
  "svn_status",
  "View the status of files in the working copy",
  {
    path: z.string().optional().describe("Specific path to query"),
    showAll: z.boolean().optional().default(false).describe("Show remote status as well")
  },
  async (args) => {
    try {
      logToFile(`Running svn_status tool with path: ${args.path || 'current directory'}, showAll: ${args.showAll}`);
      const result = await getSvnService().getStatus(args.path, args.showAll);
      const statusList = result.data!;
      
      if (statusList.length === 0) {
        return {
          content: [{ type: "text", text: "✅ **No changes in the working copy**" }],
        };
      }

      const statusText = `📊 **SVN Status** (${statusList.length} items)\n\n` +
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
        `\n\n**Execution Time:** ${formatDuration(result.executionTime || 0)}`;

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

// 4. Get change history
server.tool(
  "svn_log",
  "View commit history of the repository",
  {
    path: z.string().optional().describe("Specific path"),
    limit: z.number().optional().default(10).describe("Maximum number of entries"),
    revision: z.string().optional().describe("Specific revision or range (e.g. 100:200)")
  },
  async (args) => {
    try {
      logToFile(`Running svn_log tool with path: ${args.path || 'current directory'}, limit: ${args.limit}, revision: ${args.revision || 'all'}`);
      const result = await getSvnService().getLog(args.path, args.limit, args.revision);
      const logEntries = result.data!;
      
      if (logEntries.length === 0) {
        return {
          content: [{ type: "text", text: "📝 **No log entries found**" }],
        };
      }

      const logText = `📚 **SVN History** (${logEntries.length} entries)\n\n` +
        logEntries.map((entry, index) => 
          `**${index + 1}. Revision ${entry.revision}**\n` +
          `👤 **Author:** ${entry.author}\n` +
          `📅 **Date:** ${entry.date}\n` +
          `💬 **Message:** ${entry.message || 'No message'}\n` +
          `---`
        ).join('\n\n') +
        `\n**Execution Time:** ${formatDuration(result.executionTime || 0)}`;

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

// 5. View differences
server.tool(
  "svn_diff",
  "View differences between file versions",
  {
    path: z.string().optional().describe("Specific path"),
    oldRevision: z.string().optional().describe("Old revision"),
    newRevision: z.string().optional().describe("New revision")
  },
  async (args) => {
    try {
      logToFile(`Running svn_diff tool with path: ${args.path}, oldRevision: ${args.oldRevision}, newRevision: ${args.newRevision}`);
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

// 6. Repository checkout
server.tool(
  "svn_checkout",
  "Checkout an SVN repository",
  {
    url: z.string().describe("SVN repository URL"),
    path: z.string().optional().describe("Destination directory"),
    revision: z.union([z.number(), z.literal("HEAD")]).optional().describe("Specific revision"),
    depth: z.enum(["empty", "files", "immediates", "infinity"]).optional().describe("Checkout depth"),
    force: z.boolean().optional().default(false).describe("Force checkout"),
    ignoreExternals: z.boolean().optional().default(false).describe("Ignore externals")
  },
  async (args) => {
    try {
      logToFile(`Running svn_checkout tool with URL: ${args.url}, path: ${args.path || 'current directory'}, revision: ${args.revision || 'HEAD'}`);
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
      logToFile(`Running svn_update tool with path: ${args.path || 'current directory'}, revision: ${args.revision || 'HEAD'}`);
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
      logToFile(`Running svn_add tool with paths: ${Array.isArray(args.paths) ? args.paths.join(', ') : args.paths}`);
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
      logToFile(`Running svn_commit tool with message: ${args.message}, paths: ${args.paths?.join(', ') || 'all changes'}`);
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

// 10. Delete files
server.tool(
  "svn_delete",
  "Delete files from version control",
  {
    paths: z.union([z.string(), z.array(z.string())]).describe("File(s) or directory(ies) to delete"),
    message: z.string().optional().describe("Message for direct repository deletion"),
    force: z.boolean().optional().default(false).describe("Force deletion"),
    keepLocal: z.boolean().optional().default(false).describe("Keep local copy")
  },
  async (args) => {
    try {
      logToFile(`Running svn_delete tool with paths: ${Array.isArray(args.paths) ? args.paths.join(', ') : args.paths}`);
      const options = {
        message: args.message,
        force: args.force,
        keepLocal: args.keepLocal
      };
      
      const result = await getSvnService().delete(args.paths, options);
      const pathsArray = Array.isArray(args.paths) ? args.paths : [args.paths];
      
      const deleteText = `🗑️ **Files Deleted**\n\n` +
        `**Files:** ${pathsArray.join(', ')}\n` +
        `**Keep Local:** ${args.keepLocal ? 'Yes' : 'No'}\n` +
        `**Command:** ${result.command}\n` +
        `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
        `**Result:**\n\`\`\`\n${result.data}\n\`\`\``;

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
      logToFile(`Running svn_revert tool with paths: ${Array.isArray(args.paths) ? args.paths.join(', ') : args.paths}`);
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
      logToFile(`Running svn_cleanup tool with path: ${args.path || 'current directory'}`);
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

// 13. Clear SVN credentials cache (to resolve E215004 errors)
server.tool(
  "svn_clear_credentials",
  "Clear SVN credentials cache to resolve authentication errors",
  {},
  async () => {
    logToFile("Running svn_clear_credentials tool");
    try {
      const result = await getSvnService().clearCredentials();
      
      const clearText = `🔐 **SVN Credentials Cache Cleared**\n\n` +
        `**Command:** ${result.command}\n` +
        `**Execution Time:** ${formatDuration(result.executionTime || 0)}\n\n` +
        `**Result:**\n\`\`\`\n${result.data}\n\`\`\`\n\n` +
        `**Note:** This may help resolve errors such as:\n` +
        `• E215004: No more credentials or we tried too many times\n` +
        `• Authentication errors due to incorrectly cached credentials`;

      return {
        content: [{ type: "text", text: clearText }],
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

    logToFile("Starting SVN MCP Server...");
    logToFile("Creating SVN MCP Server...");
    logToFile("Server info: svn-mcp-server");
    logToFileParam("Version:", VERSION);
    
    // Validate environment variables
    if (!process.env.SVN_PATH) {
      logToFile("Info: SVN_PATH environment variable not set, using 'svn' from PATH");
    } else {
      logToFileParam("SVN_PATH:", process.env.SVN_PATH);
    }
    
    if (!process.env.SVN_WORKING_DIRECTORY) {
      logToFile("Info: SVN_WORKING_DIRECTORY not set, using current directory");
    } else {
      logToFileParam("SVN_WORKING_DIRECTORY:", process.env.SVN_WORKING_DIRECTORY);
    }
    
    if (process.env.SVN_USERNAME) {
      logToFileParam("SVN_USERNAME:", process.env.SVN_USERNAME);
    }
    
    if (process.env.SVN_PASSWORD) {
      logToFileParam("SVN_PASSWORD:", "***");
    }
    
    logToFile("Starting SVN MCP Server in stdio mode...");
    
    // Create transport
    const transport = new StdioServerTransport();
    
    logToFile("Connecting server to transport...");
    
    // Connect server to transport - this should keep the process alive
    await server.connect(transport);
    
    logToFile("MCP Server connected and ready!");
    logToFile("Available tools: " + [
      "svn_health_check",
      "svn_diagnose",
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
      "svn_cleanup",
      "svn_clear_credentials"
    ].join(", "));

  } catch (error) {
    console.error("Error starting server:", error);
    console.error("Stack trace:", (error as Error).stack);
    process.exit(1);
  }
}

// Start the server
runServer(); 