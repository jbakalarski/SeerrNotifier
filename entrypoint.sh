#!/bin/sh

mkdir -p /app/config
mkdir -p /app/templates

if [ ! -f /app/config/wrangler.jsonc ]; then
  cp /app/default-config/wrangler.jsonc /app/config/wrangler.jsonc
fi

if [ -z "$(ls -A /app/templates)" ]; then
  cp -r /app/default-templates/* /app/templates/
fi

exec wrangler dev /app/worker.js --local --host 0.0.0.0 --assets /app/templates