#!/bin/bash

echo "Starting SVN MCP Server..."

# Verificar si Node.js está disponible
if ! command -v node &> /dev/null; then
    echo "Error: Node.js no está instalado o no está en PATH"
    exit 1
fi

# Verificar si el proyecto está compilado
if [ ! -f "dist/index.js" ]; then
    echo "Compilando el proyecto..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "Error: Falló la compilación"
        exit 1
    fi
fi

# Ejecutar el servidor MCP
echo "Ejecutando SVN MCP Server..."
node dist/index.js 