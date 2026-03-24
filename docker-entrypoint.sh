#!/bin/bash
set -e

# Script de entrypoint para inyectar configuración en tiempo de ejecución

# Crear archivo de configuración JavaScript con variables de entorno
cat > /usr/share/nginx/html/config.js << EOF
window.__BRAIN_API_URL__ = "${BRAIN_API_URL:-}";
window.__APP_VERSION__ = "${APP_VERSION:-0.1.0}";
EOF

# Inyectar el script de configuración en todas las páginas HTML
for htmlfile in /usr/share/nginx/html/index.html /usr/share/nginx/html/editor.html; do
    if [ -f "$htmlfile" ] && ! grep -q "config.js" "$htmlfile"; then
        sed -i 's/<head>/<head>\n  <script src="\/config.js"><\/script>/' "$htmlfile"
    fi
done

echo "Pixel Chat - Configuración aplicada"
echo "BRAIN_API_URL: ${BRAIN_API_URL:-'(no configurado - usará localStorage)'}"

# Ejecutar el comando original (nginx)
exec "$@"
