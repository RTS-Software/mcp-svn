@echo off
echo Starting SVN MCP Server...

REM Verificar si Node.js está disponible
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js no está instalado o no está en PATH
    pause
    exit /b 1
)

REM Verificar si el proyecto está compilado
if not exist "dist\index.js" (
    echo Compilando el proyecto...
    npm run build
    if %errorlevel% neq 0 (
        echo Error: Falló la compilación
        pause
        exit /b 1
    )
)

REM Ejecutar el servidor MCP
echo Ejecutando SVN MCP Server...
node dist\index.js

pause 