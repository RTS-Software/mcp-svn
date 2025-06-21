# SVN MCP Server

Un servidor MCP (Model Context Protocol) completo para integración con Subversion (SVN), diseñado para permitir a agentes de IA gestionar repositorios SVN de manera eficiente.

## 🎯 Características

- ✅ **Operaciones básicas de repositorio**: info, status, log, diff, checkout, update
- ✅ **Gestión de archivos**: add, commit, delete, revert
- ✅ **Herramientas de mantenimiento**: cleanup
- 🔄 **Gestión de ramas**: (En desarrollo)
- 🔄 **Operaciones avanzadas**: merge, switch, properties (En desarrollo)
- 🔄 **Herramientas de análisis**: blame, conflict detection (En desarrollo)
- 🔄 **Operaciones en lote**: (En desarrollo)

## 📋 Requisitos

- **Node.js** >= 18.0.0
- **Subversion (SVN)** instalado y disponible en PATH
- **TypeScript** (para desarrollo)

### Verificar instalación de SVN

```bash
svn --version
```

### Instalar SVN en Windows

```bash
# Usando Chocolatey
choco install subversion

# Usando winget
winget install CollabNet.Subversion

# Usando Scoop
scoop install subversion
```

## 🚀 Instalación

### Desde NPM

```bash
npm install -g @grec0/mcp-svn
```

### Desarrollo Local

```bash
git clone https://github.com/gcorroto/mcp-svn.git
cd mcp-svn
npm install
npm run build
```

## ⚙️ Configuración

### Variables de Entorno

| Variable | Descripción | Por Defecto |
|----------|-------------|-------------|
| `SVN_PATH` | Ruta del ejecutable SVN | `svn` |
| `SVN_WORKING_DIRECTORY` | Directorio de trabajo | `process.cwd()` |
| `SVN_USERNAME` | Usuario para autenticación | - |
| `SVN_PASSWORD` | Contraseña para autenticación | - |
| `SVN_TIMEOUT` | Timeout en milisegundos | `30000` |

### Ejemplo de configuración MCP

```json
{
  "mcpServers": {
    "svn": {
      "command": "npx",
      "args": ["@grec0/mcp-svn"],
      "env": {
        "SVN_PATH": "svn",
        "SVN_WORKING_DIRECTORY": "/path/to/working/copy",
        "SVN_USERNAME": "tu_usuario",
        "SVN_PASSWORD": "tu_contraseña"
      }
    }
  }
}
```

## 🛠️ Herramientas Disponibles

### Operaciones Básicas

#### `svn_health_check`
Verificar el estado de salud del sistema SVN y working copy.

```
svn_health_check()
```

#### `svn_info`
Obtener información detallada del working copy o archivo específico.

```
svn_info(path?: string)
```

#### `svn_status` 
Ver el estado de archivos en el working copy.

```
svn_status(path?: string, showAll?: boolean)
```

#### `svn_log`
Ver historial de commits del repositorio.

```
svn_log(path?: string, limit?: number, revision?: string)
```

#### `svn_diff`
Ver diferencias entre versiones de archivos.

```
svn_diff(path?: string, oldRevision?: string, newRevision?: string)
```

### Operaciones de Repositorio

#### `svn_checkout`
Hacer checkout de un repositorio SVN.

```
svn_checkout(
  url: string,
  path?: string,
  revision?: number | "HEAD",
  depth?: "empty" | "files" | "immediates" | "infinity",
  force?: boolean,
  ignoreExternals?: boolean
)
```

#### `svn_update`
Actualizar working copy desde el repositorio.

```
svn_update(
  path?: string,
  revision?: number | "HEAD" | "BASE" | "COMMITTED" | "PREV",
  force?: boolean,
  ignoreExternals?: boolean,
  acceptConflicts?: "postpone" | "base" | "mine-conflict" | "theirs-conflict" | "mine-full" | "theirs-full"
)
```

### Gestión de Archivos

#### `svn_add`
Añadir archivos al control de versiones.

```
svn_add(
  paths: string | string[],
  force?: boolean,
  noIgnore?: boolean,
  parents?: boolean,
  autoProps?: boolean,
  noAutoProps?: boolean
)
```

#### `svn_commit`
Confirmar cambios al repositorio.

```
svn_commit(
  message: string,
  paths?: string[],
  file?: string,
  force?: boolean,
  keepLocks?: boolean,
  noUnlock?: boolean
)
```

#### `svn_delete`
Eliminar archivos del control de versiones.

```
svn_delete(
  paths: string | string[],
  message?: string,
  force?: boolean,
  keepLocal?: boolean
)
```

#### `svn_revert`
Revertir cambios locales en archivos.

```
svn_revert(paths: string | string[])
```

### Herramientas de Mantenimiento

#### `svn_cleanup`
Limpiar working copy de operaciones interrumpidas.

```
svn_cleanup(path?: string)
```

## 📖 Ejemplos de Uso

### Verificar estado del sistema

```javascript
// Verificar que SVN esté disponible y el working copy sea válido
const healthCheck = await svn_health_check();
```

### Obtener información del repositorio

```javascript
// Información general del working copy
const info = await svn_info();

// Información de un archivo específico
const fileInfo = await svn_info("src/main.js");
```

### Ver estado de archivos

```javascript
// Estado de todos los archivos
const status = await svn_status();

// Estado con información remota
const fullStatus = await svn_status(null, true);
```

### Hacer checkout de un repositorio

```javascript
const checkout = await svn_checkout(
  "https://svn.example.com/repo/trunk",
  "local-copy",
  "HEAD",
  "infinity",
  false,
  false
);
```

### Confirmar cambios

```javascript
// Añadir archivos
await svn_add(["src/new-file.js", "docs/readme.md"], { parents: true });

// Hacer commit
await svn_commit(
  "Add new feature and documentation",
  ["src/new-file.js", "docs/readme.md"]
);
```

## 🧪 Testing

```bash
# Ejecutar tests
npm test

# Tests con cobertura
npm run test -- --coverage

# Tests en modo watch
npm run test -- --watch
```

## 🏗️ Desarrollo

### Scripts disponibles

```bash
# Compilar TypeScript
npm run build

# Modo desarrollo
npm run dev

# Modo watch
npm run watch

# Inspector MCP
npm run inspector

# Tests
npm test

# Publicar nueva versión
npm run release:patch
npm run release:minor
npm run release:major
```

### Estructura del proyecto

```
svn-mcp/
├── package.json
├── tsconfig.json
├── jest.config.js
├── index.ts
├── common/
│   ├── types.ts      # Tipos TypeScript
│   ├── utils.ts      # Utilidades para SVN
│   └── version.ts    # Versión del paquete
├── tools/
│   └── svn-service.ts # Servicio principal SVN
├── tests/
│   └── integration.test.ts # Tests de integración
└── README.md
```

## 📊 Estado del Desarrollo

Ver el archivo [SVN_MCP_IMPLEMENTATION.md](./SVN_MCP_IMPLEMENTATION.md) para el checklist completo de implementación.

**Progreso actual:** Etapa 1 completada (Operaciones Básicas) ✅

**Próximas etapas:**
- Gestión de ramas (branching)
- Operaciones avanzadas (merge, switch)
- Herramientas de análisis
- Operaciones en lote

## 🐛 Troubleshooting

### SVN no encontrado

```
Error: SVN is not available in the system PATH
```

**Solución:** Instalar SVN y asegurarse de que esté en el PATH del sistema.

### No es un working copy

```
Error: Failed to get SVN info: svn: warning: W155007: '.' is not a working copy
```

**Solución:** Navegar a un directorio que sea un working copy de SVN o hacer checkout primero.

### Problemas de autenticación

```
Error: svn: E170001: Authentication failed
```

**Solución:** Configurar las variables de entorno `SVN_USERNAME` y `SVN_PASSWORD`.

### Timeout en operaciones largas

```
Error: Command timeout after 30000ms
```

**Solución:** Incrementar el valor de `SVN_TIMEOUT`.

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para más detalles.

## 🤝 Contribuir

1. Fork el proyecto
2. Crear una rama feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit los cambios (`git commit -am 'Add nueva caracteristica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crear un Pull Request

## 📞 Soporte

- **Issues:** [GitHub Issues](https://github.com/gcorroto/mcp-svn/issues)
- **Documentación:** [Wiki del proyecto](https://github.com/gcorroto/mcp-svn/wiki)
- **Email:** soporte@grec0.dev 