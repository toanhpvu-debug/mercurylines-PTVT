/**
 * Soi file biểu mẫu MLS-11-06 và đối chiếu với các ô mà mã nguồn ghi vào.
 *
 * Chạy:  npx tsx scripts/kiem-bieu-mau-kiem-ke.ts [duong-dan-file]
 *
 * Xuất kiểm kê điền dữ liệu vào ĐÚNG file Excel của công ty theo tọa độ ô cố
 * định (app/api/export/inventory/route.ts). Công ty đổi biểu mẫu — thêm một dòng
 * tiêu đề, dời khối chữ ký — là tọa độ lệch, mà lệch thì không có gì báo: file
 * vẫn tải về được, chỉ là dữ liệu rơi vào ô khác. Script này in ra những gì
 * đang thật sự nằm ở các ô đó để so bằng mắt.
 *
 * Chỉ ĐỌC file, không ghi.
 */
import path from "node:path";
import ExcelJS from "exceljs";

const FILE =
  process.argv[2] ?? path.join(process.cwd(), "templates", "MLS-11-06.xlsx");

// Đúng các hằng số trong app/api/export/inventory/route.ts.
const O_NHAN = {
  C7: "Tên tàu",
  H7: "Ngày xuất báo cáo",
  C8: "Loại vật tư",
  H8: "Kỳ báo cáo",
};
const FIRST_DATA_ROW = 13;
const TEMPLATE_SLOTS = 25;

function chu(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText
      .map((r) => r.text)
      .join("");
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    return String((v as { result: unknown }).result ?? "");
  }
  return String(v);
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];
  console.log(`File : ${FILE}`);
  console.log(`Sheet: "${ws.name}"  —  ${ws.rowCount} dòng, ${ws.columnCount} cột\n`);

  console.log("=== Các ô mã nguồn GHI ĐÈ (phải đang là nhãn hoặc trống) ===");
  for (const [o, ynghia] of Object.entries(O_NHAN)) {
    console.log(`  ${o.padEnd(4)} ${ynghia.padEnd(22)} hiện là: "${chu(ws.getCell(o).value)}"`);
  }

  console.log("\n=== Vùng đầu bảng (dòng 1..16), cột A..J ===");
  for (let r = 1; r <= Math.min(16, ws.rowCount); r++) {
    const o: string[] = [];
    for (let c = 1; c <= 10; c++) {
      const v = chu(ws.getRow(r).getCell(c).value).trim();
      if (v) o.push(`${String.fromCharCode(64 + c)}${r}="${v.slice(0, 26)}"`);
    }
    const danhDau = r === FIRST_DATA_ROW ? "  <-- mã ghi dòng dữ liệu ĐẦU TIÊN vào đây" : "";
    console.log(`  dòng ${String(r).padStart(2)}: ${o.join("  ") || "(trống)"}${danhDau}`);
  }

  console.log(
    `\n=== Vùng chữ ký (mã giả định nằm sau ${TEMPLATE_SLOTS} dòng dữ liệu, tức dòng ${FIRST_DATA_ROW + TEMPLATE_SLOTS}..) ===`
  );
  for (let r = FIRST_DATA_ROW + TEMPLATE_SLOTS - 1; r <= Math.min(FIRST_DATA_ROW + TEMPLATE_SLOTS + 3, ws.rowCount); r++) {
    const o: string[] = [];
    for (let c = 1; c <= 10; c++) {
      const v = chu(ws.getRow(r).getCell(c).value).trim();
      if (v) o.push(`${String.fromCharCode(64 + c)}${r}="${v.slice(0, 26)}"`);
    }
    console.log(`  dòng ${String(r).padStart(2)}: ${o.join("  ") || "(trống)"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
