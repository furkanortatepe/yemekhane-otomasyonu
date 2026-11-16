FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8000/api/health || exit 1

CMD ["node", "src/server.js"]
