import "server-only";

import path from "path";
import { mkdir } from "fs/promises";

// Whitelist định dạng cho phép — quyết định cả phần mở rộng lưu trữ
// lẫn Content-Type khi tải xuống (không tin mime từ trình duyệt).
export const ALLOWED_EXTENSIONS: Record<
  string,
  { mime: string; label: string; inline: boolean }
> = {
  ".pdf": { mime: "application/pdf", label: "PDF", inline: true },
  ".xls": { mime: "application/vnd.ms-excel", label: "Excel", inline: false },
  ".xlsx": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel",
    inline: false,
  },
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

export function getUploadDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export async function ensureUploadDir() {
  const dir = getUploadDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export function fileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}
