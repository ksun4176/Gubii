#Pre build stage to install dependencies
FROM node:18-alpine AS pre-build

WORKDIR /app
COPY package.json ./
COPY schema.prisma ./
RUN npm install
RUN npx prisma generate

COPY . .

#Build stage
FROM node:18-alpine AS build

WORKDIR /app
COPY --from=pre-build /app/node_modules ./node_modules
COPY --from=pre-build /app/package*.json ./
COPY . .

RUN npm run build

#Production stage
FROM node:18-alpine AS production

WORKDIR /app
COPY --from=build /app/package*.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

CMD ["node", "dist/app.js"]