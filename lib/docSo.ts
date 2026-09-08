/**
 * Đọc một ô Excel ra số, đoán đúng kiểu viết số của cả hai vùng.
 *
 * Vì sao cần: báo giá của nhà cung cấp tàu biển viết kiểu quốc tế
 * ("1,250.00" = một nghìn hai trăm năm mươi), còn file nội bộ viết kiểu Việt
 * Nam ("1.250,00" cùng nghĩa). Khi ô được định dạng CHỮ — rất hay gặp ở file
 * xuất từ PDF, dán từ email, hay cột đặt Text — thư viện đọc Excel trả về
 * nguyên chuỗi, và mọi phép đoán đơn giản đều sai gấp một nghìn lần theo một
 * trong hai hướng. Sai kiểu này không văng lỗi, nó lặng lẽ ghi 1.25 vào đơn
 * mua hàng đáng lẽ là 1250, hoặc ghi tồn kho 1.2 thay cho 1200.
 *
 * Quy tắc: dấu xuất hiện SAU CÙNG là dấu thập phân, dấu còn lại là ngăn nghìn.
 * Khi chỉ có một loại dấu thì căn theo hình dạng nhóm ba chữ số.
 */
export function docSo(v: unknown): number {
  if (typeof v !== "string") return Number(v);
  let s = v.trim().replace(/\s/g, "");
  if (!s) return NaN;

  const cuoiCham = s.lastIndexOf(".");
  const cuoiPhay = s.lastIndexOf(",");

  if (cuoiCham >= 0 && cuoiPhay >= 0) {
    // Có cả hai dấu: dấu đứng sau là thập phân, dấu kia chỉ ngăn nghìn.
    const thapPhan = cuoiCham > cuoiPhay ? "." : ",";
    const nganNghin = thapPhan === "." ? "," : ".";
    s = s.split(nganNghin).join("").replace(thapPhan, ".");
  } else if (cuoiPhay >= 0) {
    // Chỉ có phẩy: "1,200" là ngăn nghìn kiểu quốc tế, "1,5" là thập phân.
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.split(",").join("") : s.replace(",", ".");
  } else if (cuoiCham >= 0) {
    // Chỉ có chấm: "1.200" là ngăn nghìn kiểu Việt Nam, "1.5" là thập phân.
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.split(".").join("");
  }

  return Number(s);
}

/** Như docSo nhưng bỏ trước mọi ký tự không phải số (đơn vị, tiền tệ...). */
export function docSoLoc(s: string): number | null {
  if (!s) return null;
  const t = s.replace(/[^\d.,-]/g, "");
  if (!t) return null;
  const n = docSo(t);
  return Number.isFinite(n) ? n : null;
}
