FROM node:18-alpine 

WORKDIR /src

RUN apk add --no-cache \
	bash \
	vim

COPY package.json .
COPY .env.template ./.env

RUN npm install

COPY backend backend
COPY frontend frontend

EXPOSE 9000/tcp

CMD npm start