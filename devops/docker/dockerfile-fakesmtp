FROM node:22-alpine

COPY . /www

WORKDIR /www

RUN npm i && npm run build

EXPOSE 1025
EXPOSE 1080

CMD ["node", "index.js"]
