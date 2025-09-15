FROM node:18-alpine

WORKDIR /app

RUN npm config set strict-ssl false
RUN npm config set registry http://registry.npmjs.org/

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 8000

CMD ["npm", "start"]