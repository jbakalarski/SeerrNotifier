FROM node:20-bookworm

WORKDIR /app

RUN npm install -g wrangler

COPY worker.js .

COPY wrangler.jsonc ./default-config/wrangler.jsonc
COPY templates ./default-templates

COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

EXPOSE 8787

ENTRYPOINT ["./entrypoint.sh"]