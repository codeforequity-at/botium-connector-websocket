FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 2345
EXPOSE 2346
CMD [ "npm", "start" ]
