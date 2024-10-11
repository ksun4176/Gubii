#Pre build stage to install dependencies
FROM node:18-alpine AS pre-build

WORKDIR /app
COPY package*.json ./
COPY schema.prisma ./
RUN npm install

COPY . .

#Build stage
FROM node:18-alpine AS build

WORKDIR /app
COPY --from=pre-build /app/node_modules ./node_modules
COPY . .

RUN npm run build

#Production stage
FROM node:18-alpine AS production

WORKDIR /app
COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

CMD ["node", "dist/app.js"]