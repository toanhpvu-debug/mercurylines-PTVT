FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# DATABASE_URL truyen tu docker-compose (dich vu postgres), khong ghim trong image.
ENV UPLOAD_DIR="/data/uploads"

EXPOSE 3000

CMD ["sh", "/app/docker-entrypoint.sh"]
