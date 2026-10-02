FROM node:22.22.3-alpine

WORKDIR /app

COPY package.json ./
COPY index.html runtime-config.js vercel.json ./
COPY scripts ./scripts
COPY src ./src

ENV PORT=4173
EXPOSE 4173

CMD ["node", "scripts/dev.mjs"]
