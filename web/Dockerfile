FROM node:22.22.3-alpine

WORKDIR /app

COPY package.json ./
COPY index.html runtime-config.js vercel.json ./
COPY scripts ./scripts
COPY src ./src

ENV PORT=3000
EXPOSE 3000

CMD ["node", "scripts/dev.mjs"]
