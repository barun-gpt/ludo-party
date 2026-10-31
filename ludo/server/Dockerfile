FROM node:22-slim
WORKDIR /app
COPY package.json index.js ./
ENV PORT=8080 DB_PATH=/data/ludo.db
EXPOSE 8080
CMD ["node", "index.js"]
