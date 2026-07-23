FROM node:24-alpine

WORKDIR /app
RUN mkdir -p /default

COPY package.json .
COPY worker.js .
COPY server.js .
COPY wrangler.jsonc .
COPY templates/ /default/templates/

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8787

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
