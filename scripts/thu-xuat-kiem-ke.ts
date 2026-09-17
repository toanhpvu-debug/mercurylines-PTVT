/**
 * Dựng thử hai bản kiểm kê MLS-11-06 và ĐỐI CHIẾU bản tự dựng với tệp gốc.
 *
 * Chạy:  npx tsx scripts/thu-xuat-kiem-ke.ts [thu-muc-ra]
 *
 * Nút "Xuất kiểm kê" có hai đường: điền vào TỆP BIỂU MẪU GỐC của công ty khi hệ
 * thống đã nạp, hoặc TỰ DỰNG một bản chép đúng bố cục khi chưa. Đường thứ hai
 * chỉ chạy trên bản cài mới, tức là đúng nơi không ai ngồi kiểm — nên phải dựng
 * thử được ở đây, không cần đăng nhập và không cần máy chủ.
 *
 * Ba việc:
 *   1. Dựng bản tự dựng, điền 27 dòng thử (vượt 24 chỗ chừa sẵn để ép khối chữ
 *      ký phải dời), ghi ra tệp, đọc lại, kiểm vị trí từng ô.
 *   2. Làm y hệt với tệp gốc trong templates/ (nếu có).
 *   3. So bản tự dựng TRỐNG với tệp gốc: bề rộng cột, chiều cao dòng, tập ô gộp,
 *      phông và viền của từng ô nhãn, số ảnh. Lệch chỗ nào in ra chỗ đó.
 * Không đụng database.
 */
import path from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import {
  DONG_DU_LIEU_DAU,
  SO_DONG_CHUA_SAN,
  dienDongKiemKe,
  dungBieuMauKiemKe,
  ghiChuBanTuDung,
  type DongKiemKe,
} from "@/lib/bieuMauKiemKe";
import { MA_BIEU_MAU_KIEM_KE } from "@/lib/bieuMau";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, dung: boolean, chiTiet = "") {
  if (dung) dat++;
  else truot++;
  console.log(`  ${dung ? "OK   " : "TRUOT"} ${ten}${chiTiet ? ` — ${chiTiet}` : ""}`);
}
function chu(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  return String(v);
}

const DONG_THU: DongKiemKe[] = Array.from({ length: SO_DONG_CHUA_SAN + 3 }, (_, i) => ({
  group: i % 2 ? "Máy" : "Boong",
  name: `Mặt hàng thử số ${i + 1} — tên dài để xem có xuống dòng không`,
  impa: `12345${String(i).padStart(2, "0")}`,
  uom: "PCS",
  lastRob: i * 2,
  received: i,
  consumed: i % 3,
  rob: i * 2 + i - (i % 3),
}));

function dienDauTrang(ws: ExcelJS.Worksheet) {
  const now = new Date();
  ws.getCell("C7").value = "M. ODYSSEY";
  ws.getCell("H7").value = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  ws.getCell("C8").value = "Tất cả (Store & Spare)";
  ws.getCell("H8").value = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
}

function merges(ws: ExcelJS.Worksheet): string[] {
  return [...((ws as unknown as { model: { merges: string[] } }).model.merges ?? [])].sort();
}
function vienChu(b?: Partial<ExcelJS.Borders>): string {
  const s = (x?: Partial<ExcelJS.Border>) => x?.style ?? "-";
  return `${s(b?.top)}/${s(b?.right)}/${s(b?.bottom)}/${s(b?.left)}`;
}
/**
 * Bốn cạnh NHÌN THẤY của một ô, kể cả khi ô là đầu của một vùng gộp: trên và
 * trái lấy ở ô đầu, phải lấy ở ô cột cuối của vùng, dưới lấy ở ô dòng cuối.
 * Excel lưu viền theo từng ô con nên tệp gốc để đường kẻ ở ô con; ExcelJS cho ô
 * con dùng chung kiểu ô đầu. So ô đầu với ô đầu sẽ lệch dù giấy in ra như nhau
 * — phải so cái mắt thấy.
 */
function vienNhinThay(ws: ExcelJS.Worksheet, o: string): string {
  const cell = ws.getCell(o);
  const vung = merges(ws).find((m) => m.startsWith(o + ":"));
  if (!vung) return vienChu(cell.border);
  const [, cuoi] = vung.split(":");
  const cotCuoi = cuoi.replace(/\d+/, "");
  const dongCuoi = cuoi.replace(/[A-Z]+/, "");
  const cotDau = o.replace(/\d+/, "");
  const dongDau = o.replace(/[A-Z]+/, "");
  const s = (x?: Partial<ExcelJS.Border>) => x?.style ?? "-";
  const phai = ws.getCell(`${cotCuoi}${dongDau}`).border?.right;
  const duoi = ws.getCell(`${cotDau}${dongCuoi}`).border?.bottom;
  return `${s(cell.border?.top)}/${s(phai)}/${s(duoi)}/${s(cell.border?.left)}`;
}
function phongChu(f?: Partial<ExcelJS.Font>): string {
  return `${f?.name ?? "?"} ${f?.size ?? "?"}${f?.bold ? " B" : ""}${f?.italic ? " I" : ""}`;
}

async function soatLai(duongDan: string, nhan: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(duongDan);
  const ws = wb.worksheets[0];
  console.log(`\n--- soát lại: ${nhan} ---`);
  kiemTra("tên tàu ở C7", chu(ws.getCell("C7").value) === "M. ODYSSEY");
  kiemTra(
    "đầu cột tiếng Anh ở dòng 11",
    chu(ws.getRow(11).getCell(1).value).trim() === "S. No." && chu(ws.getRow(11).getCell(10).value).trim() === "R.O.B"
  );
  kiemTra("dòng dữ liệu đầu tiên đúng chỗ", chu(ws.getRow(DONG_DU_LIEU_DAU).getCell(1).value) === "1");
  const dongCuoi = DONG_DU_LIEU_DAU + DONG_THU.length - 1;
  kiemTra("dòng dữ liệu cuối cùng đúng chỗ", chu(ws.getRow(dongCuoi).getCell(1).value) === String(DONG_THU.length));
  kiemTra(
    "dòng chèn thêm CÓ viền (trước đây không)",
    vienChu(ws.getRow(dongCuoi).getCell(1).border) === "hair/thin/thin/thin",
    vienChu(ws.getRow(dongCuoi).getCell(1).border)
  );
  kiemTra(
    "dòng chèn thêm có gộp C:D",
    merges(ws).includes(`C${dongCuoi}:D${dongCuoi}`)
  );
  kiemTra(
    "dòng chèn thêm đúng phông Times New Roman 13",
    phongChu(ws.getRow(dongCuoi).getCell(3).font) === "Times New Roman 13"
  );
  const dongKy = dongCuoi + 2; // đệm 1 dòng
  kiemTra(
    "khối chữ ký nằm sau dòng đệm",
    chu(ws.getRow(dongKy).getCell(1).value).includes("Chief Engineer"),
    `dòng ${dongKy}: "${chu(ws.getRow(dongKy).getCell(1).value)}"`
  );
  kiemTra(
    "ô gộp chữ ký dời theo (A:C, E:G, H:J)",
    merges(ws).includes(`A${dongKy}:C${dongKy}`) && merges(ws).includes(`H${dongKy + 1}:J${dongKy + 1}`),
    merges(ws).filter((m) => m.includes(String(dongKy))).join(" ")
  );
  kiemTra("ô gộp chữ ký CŨ không còn sót ở dòng 38", !merges(ws).includes("A38:C38"));
  kiemTra("chữ ký tiếng Việt đúng phông nghiêng", phongChu(ws.getRow(dongKy + 1).getCell(1).font) === "Times New Roman 13 I");
  kiemTra("dòng đệm trước chữ ký không viền", vienChu(ws.getRow(dongKy - 1).getCell(1).border) === "-/-/-/-");
}

async function doiChieuVoiGoc(tuDung: ExcelJS.Worksheet, goc: ExcelJS.Worksheet) {
  console.log("\n--- đối chiếu bản tự dựng TRỐNG với tệp gốc ---");
  for (let c = 1; c <= 10; c++) {
    const a = tuDung.getColumn(c).width, b = goc.getColumn(c).width;
    kiemTra(`bề rộng cột ${String.fromCharCode(64 + c)}`, Math.abs((a ?? 0) - (b ?? 0)) < 0.001, `${a} / ${b}`);
  }
  for (const r of [1, 2, 5, 6, 8, 10, 11, 12]) {
    kiemTra(`chiều cao dòng ${r}`, tuDung.getRow(r).height === goc.getRow(r).height, `${tuDung.getRow(r).height} / ${goc.getRow(r).height}`);
  }
  const mA = merges(tuDung), mB = merges(goc);
  const thieu = mB.filter((x) => !mA.includes(x)), thua = mA.filter((x) => !mB.includes(x));
  kiemTra("tập ô gộp giống hệt", thieu.length === 0 && thua.length === 0, `thiếu: ${thieu.join(" ") || "-"} | thừa: ${thua.join(" ") || "-"}`);
  const oNhan = ["A1", "D1", "D2", "D3", "H1", "H2", "H5", "A7", "C7", "E7", "H7", "A8", "C8", "E8", "H8", "E9", "A11", "C11", "J11", "A12", "J12", "A13", "C13", "J13", "A14", "A36", "A38", "E38", "A39", "H39"];
  for (const o of oNhan) {
    const a = tuDung.getCell(o), b = goc.getCell(o);
    kiemTra(`phông ${o}`, phongChu(a.font) === phongChu(b.font), `${phongChu(a.font)} / ${phongChu(b.font)}`);
    const vA = vienNhinThay(tuDung, o), vB = vienNhinThay(goc, o);
    kiemTra(`viền nhìn thấy ${o}`, vA === vB, `${vA} / ${vB}`);
  }
  for (const o of ["D1", "D2", "D3", "H2", "A7", "E7", "A8", "C8", "E8", "H8", "E9", "A38", "E39"]) {
    kiemTra(`chữ ${o}`, chu(tuDung.getCell(o).value) === chu(goc.getCell(o).value), JSON.stringify(chu(tuDung.getCell(o).value)));
  }
  kiemTra("định dạng ngày H7", tuDung.getCell("H7").numFmt === goc.getCell("H7").numFmt, `${tuDung.getCell("H7").numFmt} / ${goc.getCell("H7").numFmt}`);
  kiemTra("số ảnh nhúng", tuDung.getImages().length === goc.getImages().length, `${tuDung.getImages().length} / ${goc.getImages().length}`);
  kiemTra("in dọc, tỷ lệ 99", tuDung.pageSetup.orientation === goc.pageSetup.orientation && tuDung.pageSetup.scale === goc.pageSetup.scale, `${tuDung.pageSetup.orientation} ${tuDung.pageSetup.scale} / ${goc.pageSetup.orientation} ${goc.pageSetup.scale}`);
}

async function main() {
  const thuMucRa = process.argv[2] ?? path.join(process.cwd(), "_thu-xuat");
  await mkdir(thuMucRa, { recursive: true });

  // 1) Bản TỰ DỰNG — ghi ra, đọc lại, soát.
  const wbTuDung = dungBieuMauKiemKe({ companyName: "MERCURY LINES COMPANY LIMITED", maBieuMau: MA_BIEU_MAU_KIEM_KE });
  dienDauTrang(wbTuDung.worksheets[0]);
  const { dongChuKyCuoi } = dienDongKiemKe(wbTuDung.worksheets[0], DONG_THU);
  ghiChuBanTuDung(wbTuDung.worksheets[0], dongChuKyCuoi);
  const raTuDung = path.join(thuMucRa, "kiem-ke-TU-DUNG.xlsx");
  await writeFile(raTuDung, Buffer.from(await wbTuDung.xlsx.writeBuffer()));
  console.log(`Đã ghi: ${raTuDung}`);
  await soatLai(raTuDung, "bản tự dựng");
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(raTuDung);
    const ws = wb.worksheets[0];
    kiemTra("vùng in dừng ở khối chữ ký (ghi chú không in)", ws.pageSetup.printArea === `A1:J${dongChuKyCuoi}`, String(ws.pageSetup.printArea));
  }

  // 2) Tệp GỐC — cùng quy trình, và 3) đối chiếu bản tự dựng trống với gốc.
  const duongDanGoc = path.join(process.cwd(), "templates", "MLS-11-06.xlsx");
  try {
    const goc = await readFile(duongDanGoc);
    const wbGoc = new ExcelJS.Workbook();
    await wbGoc.xlsx.load(goc as unknown as ArrayBuffer);
    dienDauTrang(wbGoc.worksheets[0]);
    dienDongKiemKe(wbGoc.worksheets[0], DONG_THU);
    const raGoc = path.join(thuMucRa, "kiem-ke-TU-BIEU-MAU-GOC.xlsx");
    await writeFile(raGoc, Buffer.from(await wbGoc.xlsx.writeBuffer()));
    console.log(`\nĐã ghi: ${raGoc}`);
    await soatLai(raGoc, "bản điền vào biểu mẫu gốc");

    const wbGoc2 = new ExcelJS.Workbook();
    await wbGoc2.xlsx.load(goc as unknown as ArrayBuffer);
    const wbTrong = dungBieuMauKiemKe({ companyName: "MERCURY LINES COMPANY LIMITED", maBieuMau: MA_BIEU_MAU_KIEM_KE });
    await doiChieuVoiGoc(wbTrong.worksheets[0], wbGoc2.worksheets[0]);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") console.log(`\n(Không có ${duongDanGoc} — bỏ qua phần tệp gốc.)`);
    else throw e;
  }

  console.log(`\n=== TỔNG: ${dat} đạt / ${truot} trượt ===`);
  if (truot) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
