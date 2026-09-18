/**
 * Dựng một PDF phiếu giao hàng MẪU có lớp chữ (bảng 5 cột, đặt từng ô theo
 * tọa độ như phần mềm nhà cung cấp xuất ra) — thuần chuỗi, không thư viện.
 *
 * Dùng ở hai chỗ: kiểm chứng đường pdfjs (scripts/kiem-tra-pdf-giao.ts) và nút
 * "Thử đọc thật" trên trang cấu hình bộ đọc AI — gửi đúng tệp này cho nhà
 * cung cấp AI để biết khóa, mô hình, đường mạng từ máy chủ có chạy không, và
 * so kết quả với 3 dòng đã biết.
 */
export const PDF_MAU_DONG_HANG = [
  { ten: "Piston ring set", partNo: "21001-1234", impa: null, soLuong: 2, donVi: "SET" },
  { ten: "Fuel injector nozzle", partNo: "DLF-155", impa: null, soLuong: 6, donVi: "PCS" },
  { ten: "Cotton rags", partNo: null, impa: "190405", soLuong: 25, donVi: "KG" },
] as const;

export function taoPdfMauPhieuGiao(): Buffer {
  const o = (s: string) => s.replace(/[\\()]/g, (c) => "\\" + c);
  const dong: [number, [number, string][]][] = [
    [780, [[50, "MARINE SUPPLY CO., LTD"], [350, "DELIVERY NOTE"]]],
    [760, [[50, "Delivery Note No: DN-2026-0912"], [350, "Date: 12/09/2026"]]],
    [740, [[50, "Vessel: M. ODYSSEY"], [350, "Supplier: Marine Supply Co., Ltd"]]],
    [700, [[50, "No"], [80, "Description"], [300, "Part No / IMPA"], [420, "Qty"], [470, "Unit"]]],
    [680, [[50, "1"], [80, "Piston ring set"], [300, "21001-1234"], [420, "2"], [470, "SET"]]],
    [660, [[50, "2"], [80, "Fuel injector nozzle"], [300, "DLF-155"], [420, "6"], [470, "PCS"]]],
    [640, [[50, "3"], [80, "Cotton rags"], [300, "IMPA 190405"], [420, "25"], [470, "KG"]]],
    [600, [[50, "Total"], [420, "3 items"]]],
    [560, [[50, "Received by: C/E"], [350, "Signature"]]],
  ];
  let noiDung = "";
  for (const [y, o2] of dong) {
    for (const [x, chu] of o2) noiDung += `BT /F1 10 Tf ${x} ${y} Td (${o(chu)}) Tj ET\n`;
  }
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(noiDung)} >>\nstream\n${noiDung}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}
