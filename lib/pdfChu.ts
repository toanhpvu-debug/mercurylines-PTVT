/**
 * Đọc LỚP CHỮ của một PDF (PDF số do nhà cung cấp xuất từ phần mềm), dựng lại
 * thành từng dòng như mắt nhìn trên trang — kể cả bảng.
 *
 * Chỉ dùng ở server action (app/phieu-giao-actions.ts). Không đánh dấu
 * "server-only" để script kiểm chứng chạy bằng tsx vẫn nạp được (xem
 * lib/bieuMauKiemKe.ts — cùng lý do).
 *
 * Khác với lib/pdfOcr.ts (chỉ chạy trên Windows, dùng cho bản scan): đường này
 * là JavaScript thuần (pdfjs-dist), chạy ở mọi nơi kể cả container Linux của
 * máy chủ. Bản scan (ảnh chụp) không có lớp chữ thì trả về ok:false để nơi gọi
 * thử OCR hoặc bảo người dùng nhập tay.
 *
 * Vì sao phải dựng dòng theo TỌA ĐỘ: pdfjs trả về từng mẩu chữ rời (một ô bảng,
 * một từ) kèm vị trí x/y, không có khái niệm "dòng". Ghép các mẩu có cùng y
 * thành một dòng, xếp theo x, và chèn dấu ngăn " | " ở chỗ có khoảng trống lớn
 * — đúng chỗ đường kẻ cột của bảng — thì bộ tách phiếu (lib/phieuGiaoParse.ts)
 * nhìn thấy cột số lượng, cột đơn vị rõ như trên giấy.
 */
export type KetQuaDocChu =
  | { ok: true; text: string; soTrang: number }
  | { ok: false; loi: string; soTrang?: number };

/** Hai mẩu chữ lệch nhau dưới ngần này (đơn vị PDF ≈ 1/72 inch) coi như cùng dòng. */
const SAI_SO_DONG = 2.5;
/** Khoảng trống ngang lớn hơn ngần này giữa hai mẩu = sang cột khác. */
const KHE_COT = 9;

type Mau = { x: number; cuoi: number; s: string };

export async function docChuTuPdf(buffer: Buffer, soTrangToiDa = 8): Promise<KetQuaDocChu> {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  } catch (e) {
    return { ok: false, loi: `Không nạp được bộ đọc PDF: ${String((e as Error)?.message ?? e)}` };
  }
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });
  try {
    doc = await task.promise;
  } catch (e) {
    return { ok: false, loi: `File không đọc được như một PDF: ${String((e as Error)?.message ?? e)}` };
  }

  const soTrang = doc.numPages;
  const trang: string[] = [];
  for (let i = 1; i <= Math.min(soTrang, soTrangToiDa); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    // Gom mẩu theo dòng (y giảm dần = từ trên xuống).
    const dongs: { y: number; mau: Mau[] }[] = [];
    for (const it of tc.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      const d = dongs.find((r) => Math.abs(r.y - y) <= SAI_SO_DONG);
      const mau: Mau = { x, cuoi: x + (it.width ?? 0), s: it.str };
      if (d) d.mau.push(mau);
      else dongs.push({ y, mau: [mau] });
    }
    dongs.sort((a, b) => b.y - a.y);
    const ra: string[] = [];
    for (const d of dongs) {
      d.mau.sort((a, b) => a.x - b.x);
      let chu = "";
      let cuoiTruoc = -Infinity;
      for (const m of d.mau) {
        if (chu) {
          const khe = m.x - cuoiTruoc;
          chu += khe > KHE_COT ? " | " : khe > 1 ? " " : "";
        }
        chu += m.s;
        cuoiTruoc = m.cuoi;
      }
      ra.push(chu.replace(/[ \t]+/g, " ").trim());
    }
    trang.push(ra.join("\n"));
  }
  await task.destroy().catch(() => undefined);

  const text = trang.map((t, i) => `--- trang ${i + 1} ---\n${t}`).join("\n");
  const coChu = text.replace(/--- trang \d+ ---/g, "").trim().length >= 10;
  if (!coChu) {
    return {
      ok: false,
      soTrang,
      loi: "PDF này không có lớp chữ (bản scan / ảnh chụp). Cần bộ nhận dạng chữ (OCR) hoặc nhập tay các dòng.",
    };
  }
  return { ok: true, text, soTrang };
}
