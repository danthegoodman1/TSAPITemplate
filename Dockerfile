FROM node:18-alpine as build

WORKDIR /app

COPY . .

RUN npm ci --production

RUN npm build

FROM node:18-alpine

WORKDIR /app

COPY --from=build /app/build /app/
COPY --from=build /app/node_modules /app/

ENTRYPOINT ["node", "/app/build/index.js"]
