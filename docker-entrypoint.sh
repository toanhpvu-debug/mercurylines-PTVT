#!/bin/sh
set -e

mkdir -p /data

if [ -z "$SESSION_SECRET" ]; then
  if [ ! -f /data/.session-secret ]; then
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" > /data/.session-secret
  fi
  export SESSION_SECRET="$(cat /data/.session-secret)"
fi

npx prisma migrate deploy

if [ ! -f /data/.seeded ]; then
  npx prisma db seed
  touch /data/.seeded
fi

exec npm run start
