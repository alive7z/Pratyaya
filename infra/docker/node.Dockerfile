FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/mock-provider/package.json apps/mock-provider/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --omit=dev

COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/worker apps/worker
COPY apps/mock-provider apps/mock-provider
COPY docs docs

USER node
