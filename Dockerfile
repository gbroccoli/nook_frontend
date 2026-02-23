# syntax=docker/dockerfile:1.7

FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM docker.angie.software/angie-minimal:latest AS runner

COPY ./angie.conf /etc/angie/http.d/default.conf
COPY --from=builder /app/dist /usr/share/angie/html

EXPOSE 80
CMD ["angie", "-g", "daemon off;"]
