FROM mcr.microsoft.com/playwright:v1.50.1-noble

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY prompts ./prompts
COPY src ./src
RUN npm run build && npm prune --omit=dev

EXPOSE 4000

CMD ["node", "dist/index.js"]
