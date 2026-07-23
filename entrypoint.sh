#!/bin/sh
set -e

mkdir -p /app/templates
cp -rn /default/templates/* /app/templates/

exec "$@"
