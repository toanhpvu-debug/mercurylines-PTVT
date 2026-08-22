import "server-only";

import { spawn } from "child_process";
import path from "path";
import os from "os";

/**
 * Đọc chữ từ file PDF, kể cả PDF SCAN.
 *
 * Gọi scripts/doc-pdf-scan.ps1 — script đó dùng hai thành phần có sẵn của
 * Windows (Windows.Data.Pdf để dựng trang thành ảnh, Windows.Media.Ocr để nhận
 * dạng chữ). Máy này không có thư viện đọc PDF nào và cũng không cài thêm được,
 * nên đây là đường duy nhất đọc được bản scan.
 *
 * Vì phụ thuộc Windows, hàm này BÁO LỖI RÕ RÀNG khi chạy ở nơi khác (Docker,
 * Linux) thay vì ném lỗi khó hiểu — người dùng vẫn nhập tay được, chỉ mất phần
 * điền sẵn.
 */
export type KetQuaOcr =
  | { ok: true; text: string }
  | { ok: false; loi: string };

const TIMEOUT_MS = 120_000;

export async function docPdfBangOcr(
  duongDanPdf: string,
  soTrang = 3
): Promise<KetQuaOcr> {
  if (os.platform() !== "win32") {
    return {
      ok: false,
      loi: "Đọc PDF scan chỉ chạy được trên Windows (dùng bộ nhận dạng chữ có sẵn của hệ điều hành). Trên máy chủ này hãy nhập tay các ô.",
    };
  }

  const script = path.resolve(process.cwd(), "scripts", "doc-pdf-scan.ps1");

  return new Promise<KetQuaOcr>((resolve) => {
    const ps = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        "-File",
        duongDanPdf,
        "-MaxPages",
        String(soTrang),
        "-Scale",
        "2.5",
      ],
      { windowsHide: true }
    );

    let ra = "";
    let loi = "";
    let xong = false;

    const hen = setTimeout(() => {
      if (xong) return;
      xong = true;
      ps.kill();
      resolve({
        ok: false,
        loi: "Đọc file quá lâu (trên 2 phút) nên đã dừng. File scan quá lớn — thử tách bớt trang hoặc nhập tay.",
      });
    }, TIMEOUT_MS);

    ps.stdout.on("data", (d) => (ra += d.toString("utf8")));
    ps.stderr.on("data", (d) => (loi += d.toString("utf8")));

    ps.on("error", (e) => {
      if (xong) return;
      xong = true;
      clearTimeout(hen);
      resolve({ ok: false, loi: `Không chạy được bộ đọc PDF: ${e.message}` });
    });

    ps.on("close", (code) => {
      if (xong) return;
      xong = true;
      clearTimeout(hen);
      if (code !== 0) {
        resolve({
          ok: false,
          loi:
            loi.trim().split("\n")[0] ||
            `Bộ đọc PDF trả về mã lỗi ${code}. File có thể hỏng hoặc được đặt mật khẩu.`,
        });
        return;
      }
      const text = ra.trim();
      if (!text || text.replace(/---.*---/g, "").trim().length < 10) {
        resolve({
          ok: false,
          loi: "Đọc được file nhưng không nhận ra chữ nào. Bản scan có thể quá mờ, bị nghiêng, hoặc là ảnh chụp thiếu sáng — chụp lại rõ hơn, hoặc nhập tay.",
        });
        return;
      }
      resolve({ ok: true, text });
    });
  });
}
