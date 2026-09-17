/**
 * Dựng thử hai bản kiểm kê MLS-11-06 để so bằng mắt và bằng máy.
 *
 * Chạy:  npx tsx scripts/thu-xuat-kiem-ke.ts [thu-muc-ra]
 *
 * Nút "Xuất kiểm kê" có hai đường: điền vào TỆP BIỂU MẪU GỐC của công ty khi hệ
 * thống đã nạp, hoặc TỰ DỰNG một bảng cùng bố cục khi chưa. Đường thứ hai chỉ
 * chạy trên bản cài mới, tức là đúng nơi không ai ngồi kiểm — nên phải dựng thử
 * được ở đây, không cần đăng nhập và không cần máy chủ.
 *
 * Script ghi ra hai tệp .xlsx rồi đọc lại, kiểm các ô mà route xuất sẽ ghi vào.
 * Không đụng database.
 */
import path from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import {
  DONG_DU_LIEU_DAU,
  SO_DONG_CHUA_SAN,
  dungBieuMauKiemKe,
} from "@/lib/bieuMauKiemKe";
import { MA_BIEU_MAU_KIEM_KE } from "@/lib/bieuMau";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, dung: boolean, chiTiet = "") {
  if (dung) {
    dat++;
    console.log(`  OK    ${ten}${chiTiet ? ` — ${chiTiet}` : ""}`);
  } else {
    truot++;
    console.log(`  TRUOT ${ten}${chiTiet ? ` — ${chiTiet}` : ""}`);
  }
}

/** Vài dòng giả, đủ để thấy bảng tràn qua số chỗ chừa sẵn. */
const DONG_THU = Array.from({ length: SO_DONG_CHUA_SAN + 3 }, (_, i) => ({
  group: i % 2 ? "Máy" : "Boong",
  name: `Mặt hàng thử số ${i + 1} — tên dài để xem có xuống dòng không`,
  impa: `12345${String(i).padStart(2, "0")}`,
  uom: "PCS",
  lastRob: i * 2,
  received: i,
  consumed: i % 3,
  rob: i * 2 + i - (i % 3),
}));

/** Đúng cách route xuất ghi dữ liệu vào một workbook đã có bố cục. */
function dienDuLieu(wb: ExcelJS.Workbook) {
  const ws = wb.worksheets[0];
  const now = new Date();
  ws.getCell("C7").value = "M. ODYSSEY";
  ws.getCell("H7").value = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  ws.getCell("C8").value = "Tất cả (Store & Spare)";
  ws.getCell("H8").value = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
  if (DONG_THU.length > SO_DONG_CHUA_SAN) {
    ws.insertRows(
      DONG_DU_LIEU_DAU + SO_DONG_CHUA_SAN - 1,
      Array.from({ length: DONG_THU.length - SO_DONG_CHUA_SAN }, () => []),
      "i"
    );
  }
  DONG_THU.forEach((row, index) => {
    const r = ws.getRow(DONG_DU_LIEU_DAU + index);
    r.getCell(1).value = index + 1;
    r.getCell(2).value = row.group;
    r.getCell(3).value = row.name;
    r.getCell(5).value = row.impa;
    r.getCell(6).value = row.uom;
    r.getCell(7).value = row.lastRob;
    r.getCell(8).value = row.received;
    r.getCell(9).value = row.consumed;
    r.getCell(10).value = row.rob;
  });
  return ws;
}

function chu(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText
      .map((r) => r.text)
      .join("");
  }
  return String(v);
}

async function soatLai(duongDan: string, nhan: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(duongDan);
  const ws = wb.worksheets[0];
  console.log(`\n--- soát lại: ${nhan} ---`);
  kiemTra("tên tàu ở C7", chu(ws.getCell("C7").value) === "M. ODYSSEY");
  kiemTra(
    "đầu cột tiếng Anh ở dòng 11",
    chu(ws.getRow(11).getCell(1).value).trim() === "S. No." &&
      chu(ws.getRow(11).getCell(10).value).trim() === "R.O.B"
  );
  kiemTra(
    "đầu cột tiếng Việt ở dòng 12",
    chu(ws.getRow(12).getCell(1).value).trim() === "Stt." &&
      chu(ws.getRow(12).getCell(10).value).trim() === "Tồn trên tàu"
  );
  kiemTra(
    "dòng dữ liệu đầu tiên đúng chỗ",
    chu(ws.getRow(DONG_DU_LIEU_DAU).getCell(1).value) === "1",
    `B${DONG_DU_LIEU_DAU}="${chu(ws.getRow(DONG_DU_LIEU_DAU).getCell(2).value)}"`
  );
  kiemTra(
    "dòng dữ liệu cuối cùng đúng chỗ",
    chu(ws.getRow(DONG_DU_LIEU_DAU + DONG_THU.length - 1).getCell(1).value) ===
      String(DONG_THU.length)
  );
  // Khối chữ ký phải bị đẩy xuống đúng bằng số dòng chèn thêm.
  const dongKy = DONG_DU_LIEU_DAU + DONG_THU.length;
  const chuKy = chu(ws.getRow(dongKy).getCell(1).value);
  kiemTra(
    "khối chữ ký nằm ngay dưới dòng cuối",
    chuKy.includes("Chief Engineer"),
    `dòng ${dongKy}: "${chuKy}"`
  );
  kiemTra(
    "không còn dòng dữ liệu nào sau khối chữ ký",
    chu(ws.getRow(dongKy + 2).getCell(1).value).trim() === ""
  );
}

async function main() {
  const thuMucRa = process.argv[2] ?? path.join(process.cwd(), "_thu-xuat");
  await mkdir(thuMucRa, { recursive: true });

  // 1) Bản TỰ DỰNG — đường chạy khi hệ thống chưa nạp biểu mẫu gốc.
  const wbTuDung = dungBieuMauKiemKe({
    companyName: "MERCURY LINES COMPANY LIMITED",
    address: "Head office: (địa chỉ lấy từ chuẩn biểu mẫu của tàu)",
    maBieuMau: MA_BIEU_MAU_KIEM_KE,
  });
  dienDuLieu(wbTuDung);
  const raTuDung = path.join(thuMucRa, "kiem-ke-TU-DUNG.xlsx");
  await writeFile(raTuDung, Buffer.from(await wbTuDung.xlsx.writeBuffer()));
  console.log(`Đã ghi: ${raTuDung}`);
  await soatLai(raTuDung, "bản tự dựng");

  // 2) Bản điền vào TỆP GỐC — đường chạy khi đã nạp biểu mẫu.
  const duongDanGoc = path.join(process.cwd(), "templates", "MLS-11-06.xlsx");
  try {
    const goc = await readFile(duongDanGoc);
    const wbGoc = new ExcelJS.Workbook();
    await wbGoc.xlsx.load(goc as unknown as ArrayBuffer);
    dienDuLieu(wbGoc);
    const raGoc = path.join(thuMucRa, "kiem-ke-TU-BIEU-MAU-GOC.xlsx");
    await writeFile(raGoc, Buffer.from(await wbGoc.xlsx.writeBuffer()));
    console.log(`\nĐã ghi: ${raGoc}`);
    await soatLai(raGoc, "bản điền vào biểu mẫu gốc");
  } catch {
    console.log(`\n(Không có ${duongDanGoc} — bỏ qua bản điền vào tệp gốc.)`);
  }

  console.log(`\n=== TỔNG: ${dat} đạt / ${truot} trượt ===`);
  if (truot) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
