FROM node:25

WORKDIR /app

RUN npm install -g wrangler

COPY worker.js .

COPY wrangler.jsonc ./wrangler.jsonc
COPY templates ./templates

EXPOSE 8787

CMD ["wrangler", "dev", "--ip", "0.0.0.0", "--port", "8787"]