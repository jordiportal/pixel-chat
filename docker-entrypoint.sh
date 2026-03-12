#!/bin/bash
set -e

# Script de entrypoint para inyectar configuración en tiempo de ejecución

# Crear archivo de configuración JavaScript con variables de entorno
cat > /usr/share/nginx/html/config.js << EOF
window.__BRAIN_API_URL__ = "${BRAIN_API_URL:-}";
window.__APP_VERSION__ = "${APP_VERSION:-0.1.0}";
EOF

# Inyectar el script de configuración en index.html si no está ya
if ! grep -q "config.js" /usr/share/nginx/html/index.html; then
    sed -i 's/<head>/<head>\n  <script src="\/config.js"><\/script>/' /usr/share/nginx/html/index.html
fi

echo "Pixel Chat - Configuración aplicada"
echo "BRAIN_API_URL: ${BRAIN_API_URL:-'(no configurado - usará localStorage)'}"

# Ejecutar el comando original (nginx)
exec "$@"
