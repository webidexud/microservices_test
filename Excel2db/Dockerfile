# Imagen base de Node.js
FROM node:20


RUN npm install -g nodemon
# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos
COPY package*.json ./
COPY ./src ./src

# Instalar dependencias
RUN npm install

# Exponer el puerto
EXPOSE 61800

RUN npx @tailwindcss/cli -i ./src/public/main.css -o ./src/public/output.css --watch

# Ejecutar la app
CMD [ "nodemon", "src/app.js" ]

