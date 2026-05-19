#!/usr/bin/env sh
set -eu

if [ "${KIND_RUN_MIGRATE:-1}" = "1" ]; then
  node dist/db/migrate.js
fi

if [ "${KIND_RUN_SEED:-0}" = "1" ]; then
  node dist/db/seed.js
fi

exec "$@"
