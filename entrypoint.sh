#!/bin/bash
set -e

cp -rn /default/templates/* /app/templates/

exec "$@"