/**
 * Soi ĐỊNH DẠNG của biểu mẫu MLS-11-06 gốc: phông, viền, nền, bề rộng cột,
 * chiều cao dòng, ô gộp, ảnh, thiết lập in, định dạng số.
 *
 * Chạy:  npx tsx scripts/soi-dinh-dang-bieu-mau.ts [duong-dan-file]
 *
 * Bản tự dựng (lib/bieuMauKiemKe.ts) muốn giống bản gốc thì phải chép đúng
 * những thứ này, mà mắt thường nhìn Excel không đọc ra được số đo. Script in
 * hết ra để đối chiếu từng con số. Chỉ đọc, không ghi.
 */
import path from "node:path";
import ExcelJS from "exceljs";

const FILE =
  process.argv[2] ?? path.join(process.cwd(), "templates", "MLS-11-06.xlsx");

function chu(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  return String(v);
}
function vien(b?: Partial<ExcelJS.Borders>) {
  if (!b) return "-";
  const s = (x?: Partial<ExcelJS.Border>) => (x?.style ? x.style[0] : ".");
  return `${s(b.top)}${s(b.right)}${s(b.bottom)}${s(b.left)}`; // t r b l
}
function phong(f?: Partial<ExcelJS.Font>) {
  if (!f) return "-";
  return `${f.name ?? "?"} ${f.size ?? "?"}${f.bold ? " B" : ""}${f.italic ? " I" : ""}${f.color && "argb" in f.color ? " #" + String(f.color.argb).slice(-6) : ""}`;
}
function nen(f?: ExcelJS.Fill) {
  if (!f || f.type !== "pattern" || f.pattern === "none") return "-";
  const c = (f as ExcelJS.FillPattern).fgColor;
  return c && "argb" in c ? "#" + String(c.argb).slice(-6) : f.pattern;
}
function canh(a?: Partial<ExcelJS.Alignment>) {
  if (!a) return "-";
  return `${a.horizontal ?? "-"}/${a.vertical ?? "-"}${a.wrapText ? " wrap" : ""}`;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.worksheets[0];
  console.log(`File: ${FILE}\nSheet: "${ws.name}" — ${ws.rowCount} dòng × ${ws.columnCount} cột\n`);

  console.log("=== Thiết lập in ===");
  const ps = ws.pageSetup;
  console.log(
    `  paperSize=${ps.paperSize} orientation=${ps.orientation} fitToPage=${ps.fitToPage} fitToWidth=${ps.fitToWidth} fitToHeight=${ps.fitToHeight} scale=${ps.scale}`
  );
  console.log(`  margins=${JSON.stringify(ps.margins)}`);
  console.log(`  printArea=${ps.printArea ?? "-"} horizontalCentered=${ps.horizontalCentered}`);
  console.log(`  views=${JSON.stringify(ws.views)}`);

  console.log("\n=== Bề rộng cột (đơn vị ký tự Excel) ===");
  const cot: string[] = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    const col = ws.getColumn(c);
    cot.push(`${String.fromCharCode(64 + c)}=${col.width ?? "auto"}${col.hidden ? "(ẩn)" : ""}`);
  }
  console.log("  " + cot.join("  "));

  console.log("\n=== Chiều cao dòng (pt), chỉ dòng có đặt riêng ===");
  const cao: string[] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (row.height) cao.push(`${r}=${row.height}`);
  }
  console.log("  " + (cao.join("  ") || "(không dòng nào)"));

  console.log("\n=== Ô gộp ===");
  const gop = (ws as unknown as { model: { merges: string[] } }).model.merges ?? [];
  console.log("  " + gop.join("  "));

  console.log("\n=== Ảnh nhúng ===");
  const anh = ws.getImages();
  if (!anh.length) console.log("  (không có)");
  for (const a of anh) {
    const img = wb.getImage(Number(a.imageId));
    // range chứa tham chiếu ngược về worksheet — chỉ in góc trên/dưới, không
    // JSON.stringify cả cục (vòng tròn).
    const r = a.range as { tl?: { col: number; row: number }; br?: { col: number; row: number }; ext?: { width: number; height: number } };
    console.log(
      `  imageId=${a.imageId} type=${img.extension} buffer=${img.buffer ? (img.buffer as unknown as Buffer).length + " byte" : "?"} tl=${r.tl ? `col ${r.tl.col} row ${r.tl.row}` : "-"} br=${r.br ? `col ${r.br.col} row ${r.br.row}` : "-"} ext=${r.ext ? `${r.ext.width}×${r.ext.height}px` : "-"}`
    );
  }

  console.log("\n=== Từng ô có nội dung hoặc định dạng, dòng 1–13 và 37–40 ===");
  console.log("  ô     | giá trị                        | phông                 | viền(trbl) | nền     | căn            | numFmt");
  const dongXem = [...Array.from({ length: 13 }, (_, i) => i + 1), 37, 38, 39, 40];
  for (const r of dongXem) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      const gt = chu(cell.value).replace(/\s+/g, " ").trim();
      const coDinhDang = cell.border || (cell.fill && (cell.fill as ExcelJS.FillPattern).pattern !== "none") || cell.font;
      if (!gt && !coDinhDang) continue;
      // Ô bị gộp vào ô khác thì ExcelJS trả về master; chỉ in ô master.
      if (cell.isMerged && cell.master !== cell) continue;
      console.log(
        `  ${cell.address.padEnd(5)} | ${gt.slice(0, 30).padEnd(30)} | ${phong(cell.font).padEnd(21)} | ${vien(cell.border).padEnd(10)} | ${nen(cell.fill).padEnd(7)} | ${canh(cell.alignment).padEnd(14)} | ${cell.numFmt ?? "-"}`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
