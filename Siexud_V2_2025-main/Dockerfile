# ---- Node Versión LTS ----
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# Package.json y package-lock.json para cachear las dependencias
COPY package*.json ./
# Instala dependencias de producción y desarrollo necesarias
RUN npm install

# Copia el resto del código fuente
COPY . .

# Expone el puerto que usará la aplicación
EXPOSE 3000

# Usuario no-root para mayor seguridad
USER node

# Comando para iniciar la aplicación
CMD [ "node", "src/app.js" ]