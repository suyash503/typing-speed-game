FROM oven/bun:1.4-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
RUN bunx prisma generate

COPY src ./src
COPY tsconfig.json ./

EXPOSE 4000

# Migrations run on boot so a fresh `docker compose up` gives a working database.
CMD ["sh", "-c", "bunx prisma migrate deploy && bun src/index.ts"]
