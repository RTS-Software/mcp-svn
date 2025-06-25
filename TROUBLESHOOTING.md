# 🔧 Solución de Problemas - MCP SVN

## Problema: "not a working copy"

### Error típico:
```
❌ Error: El directorio 'C:\tu\directorio' no es un working copy de SVN. 
Asegúrate de estar en un directorio que contenga un repositorio SVN o hacer checkout primero.
```

### Causa:
Este error ocurre cuando intentas ejecutar comandos SVN (`svn info`, `svn status`, etc.) en un directorio que **no está bajo control de versiones SVN**.

### Soluciones:

#### 1. **Cambiar al directorio correcto**
Si ya tienes un working copy SVN en otro lugar:

```bash
# Configurar la variable de entorno para apuntar a tu working copy
export SVN_WORKING_DIRECTORY="/ruta/a/tu/working-copy"
```

En Windows:
```cmd
set SVN_WORKING_DIRECTORY=C:\ruta\a\tu\working-copy
```

#### 2. **Hacer checkout de un repositorio**
Si necesitas crear un working copy nuevo:

```bash
# Usar la herramienta svn_checkout del MCP
svn_checkout(
  url: "https://tu-servidor-svn.com/repo/trunk",
  path: "mi-proyecto"
)
```

#### 3. **Verificar si un directorio es working copy**
Busca la carpeta `.svn` oculta:

**Windows (PowerShell):**
```powershell
Get-ChildItem -Force | Where-Object {$_.Name -like ".svn*"}
```

**Linux/Mac:**
```bash
ls -la | grep .svn
```

## Configuración del Entorno

### Variables de Entorno Importantes

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SVN_PATH` | Ruta del ejecutable SVN | `C:/Program Files/TortoiseSVN/bin/svn.exe` |
| `SVN_WORKING_DIRECTORY` | Directorio de trabajo | `C:/mi-proyecto` |
| `SVN_USERNAME` | Usuario para autenticación | `usuario@empresa.com` |
| `SVN_PASSWORD` | Contraseña | `mi-contraseña` |

### Ejemplo de configuración MCP

```json
{
  "mcpServers": {
    "svn": {
      "command": "npx",
      "args": ["@grec0/mcp-svn"],
      "env": {
        "SVN_PATH": "C:/Program Files/TortoiseSVN/bin/svn.exe",
        "SVN_WORKING_DIRECTORY": "C:/mi-proyecto",
        "SVN_USERNAME": "mi-usuario",
        "SVN_PASSWORD": "mi-contraseña"
      }
    }
  }
}
```

## Verificación del Sistema

### 1. Verificar instalación de SVN
```bash
svn --version
```

### 2. Verificar que el MCP funciona
Usa la herramienta `svn_health_check()` para verificar:
- ✅ SVN está disponible
- ✅ Working copy es válido
- ✅ Repositorio es accesible

### 3. Testear comandos básicos
```bash
# Verificar info del working copy
svn info

# Ver estado de archivos
svn status
```

## Flujo de Trabajo Típico

### 1. **Primer uso - Hacer checkout**
```
1. svn_checkout(url: "https://servidor/repo", path: "mi-proyecto")
2. Configurar SVN_WORKING_DIRECTORY hacia "mi-proyecto"
3. Usar otros comandos SVN
```

### 2. **Uso regular - Trabajar con archivos**
```
1. svn_info() - Ver información del repositorio
2. svn_status() - Ver archivos modificados
3. svn_add(paths: ["nuevo-archivo.txt"])
4. svn_commit(message: "Añadir nuevo archivo")
```

### 3. **Mantenimiento**
```
1. svn_update() - Actualizar desde el servidor
2. svn_cleanup() - Limpiar working copy si hay problemas
```

## Errores Comunes y Soluciones

### Error: "SVN command failed with code 1"
- **Causa**: Comando SVN falló
- **Solución**: Ver el mensaje de error específico para más detalles

### Error: "SVN is not available"
- **Causa**: SVN no está instalado o no está en PATH
- **Solución**: Instalar SVN o configurar SVN_PATH

### Error: "Authentication failed"
- **Causa**: Credenciales incorrectas
- **Solución**: Verificar SVN_USERNAME y SVN_PASSWORD

### Error: "E215004: No more credentials or we tried too many times"
- **Causa**: Demasiados intentos de autenticación fallidos - credenciales pueden estar cacheadas incorrectamente
- **Solución**: Ejecutar `svn_clear_credentials()` para limpiar el cache de credenciales SVN

### Error: "Working copy locked"
- **Causa**: Operación SVN anterior se interrumpió
- **Solución**: Ejecutar `svn_cleanup()`

## Herramientas de Diagnóstico

### Comando de diagnóstico completo
```javascript
// Verificar todo el sistema
await svn_health_check();

// Si hay problemas, verificar paso a paso:
1. Verificar SVN: svn --version
2. Verificar directorio: ls -la .svn
3. Verificar conexión: svn info --non-interactive
```

## Soporte

Si el problema persiste después de seguir esta guía:

1. **Revisar los logs** del MCP para errores específicos
2. **Verificar permisos** de archivos y directorios
3. **Probar comandos SVN manualmente** en la terminal
4. **Verificar conectividad** al servidor SVN

---

**💡 Consejo**: Siempre ejecuta `svn_health_check()` primero para diagnosticar problemas de configuración. 