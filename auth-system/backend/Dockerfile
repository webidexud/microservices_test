FROM node:18-alpine

WORKDIR /app

# Configurar npm para evitar problemas de certificados
RUN npm config set strict-ssl false
RUN npm config set registry http://registry.npmjs.org/

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3001

CMD ["npm", "start"]