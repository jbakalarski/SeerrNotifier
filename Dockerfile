FROM node:25

WORKDIR /app
RUN mkdir -p /default

RUN npm install -g wrangler

COPY worker.js .
COPY wrangler.jsonc .
COPY templates/ /default/templates/

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8787

CMD ["/bin/bash", "-c", "cp -rn /default/templates/* /app/templates/ && wrangler dev --ip 0.0.0.0 --port 8787"]