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

# Docker chỉ biết "tiến trình còn sống"; node kẹt (cạn pool Prisma, event loop
# bị chặn) thì container vẫn "running" và Traefik vẫn dồn lưu lượng vào. Hỏi
# thẳng trang /login (công khai, chạm cả render lẫn phông) mỗi 30 giây; 40 giây
# đầu bỏ qua để migrate + khởi động kịp. Không thêm curl/wget vào ảnh chỉ để làm việc này.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/login',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["sh", "/app/docker-entrypoint.sh"]
