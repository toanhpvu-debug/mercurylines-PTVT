/**
 * Rút các ảnh nhúng trong biểu mẫu MLS-11-06 ra tệp, để nhìn và để quyết định
 * có dùng lại cho bản tự dựng không.
 *
 * Chạy:  npx tsx scripts/rut-anh-bieu-mau.ts [duong-dan-file] [thu-muc-ra]
 * Chỉ đọc biểu mẫu; ghi ảnh ra thư mục _thu-xuat (đã nằm trong .gitignore).
 */
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";

const FILE =
  process.argv[2] ?? path.join(process.cwd(), "templates", "MLS-11-06.xlsx");
const RA = process.argv[3] ?? path.join(process.cwd(), "_thu-xuat");

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  await mkdir(RA, { recursive: true });
  let n = 0;
  for (const ws of wb.worksheets) {
    for (const a of ws.getImages()) {
      const img = wb.getImage(Number(a.imageId));
      if (!img.buffer) continue;
      n++;
      const ten = path.join(RA, `anh-${n}.${img.extension}`);
      const du = img.buffer as unknown as Buffer;
      await writeFile(ten, du);
      console.log(`  ${ten}  (${du.length} byte)`);
    }
  }
  console.log(n ? `${n} ảnh.` : "Không có ảnh nhúng.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
