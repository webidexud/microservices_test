# 📁 calculator-service/Dockerfile
FROM node:18-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de forma más eficiente
RUN npm install --production --no-optional --no-fund --no-audit && \
    npm cache clean --force

# Copiar código fuente
COPY . .

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Cambiar ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Exponer puerto
EXPOSE 3003

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3003/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => { process.exit(1); });"

# Comando de inicio
CMD ["npm", "start"]