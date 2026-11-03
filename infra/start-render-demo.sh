#!/bin/sh
set -eu

pnpm --filter @starlight/api db:migrate
if [ "${PUBLIC_DEMO_MODE:-false}" = "true" ]; then
  pnpm --filter @starlight/api seed:public-demo
  pnpm --filter @starlight/api bootstrap:public-demo-manager
fi

node apps/api/dist/worker.js &
worker_pid=$!
pnpm --filter @starlight/api start &
api_pid=$!

cleanup() {
  kill -TERM "$api_pid" "$worker_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
  wait "$worker_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
wait "$api_pid"
