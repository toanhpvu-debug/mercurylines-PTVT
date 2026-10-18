/*
 * Ô ngày giờ (datetime-local) cho chuỗi "2026-10-18T08:00" KHÔNG có múi giờ. Máy chủ online chạy
 * giờ UTC nên phải đổi sang ISO có múi giờ ngay ở trình duyệt (giờ máy người dùng) trước khi gửi —
 * gửi chuỗi trơn thì 8 giờ sáng Việt Nam thành 15 giờ.
 */

/** "YYYY-MM-DDTHH:mm" theo giờ máy → ISO; trống / sai → "" (máy chủ hiểu là "bây giờ" / báo lỗi). */
export function isoTuGioMay(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

/** ISO (hay chuỗi giờ máy) → "YYYY-MM-DDTHH:mm" theo giờ máy, để điền lại ô datetime-local. */
export function gioMayTuIso(s: string): string {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
