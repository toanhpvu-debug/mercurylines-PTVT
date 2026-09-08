/**
 * Kiểm tra file Excel mẫu có nhập lại được không.
 *
 * Chạy:  kiem-tra-mau-danh-muc.cmd
 *
 * Dựng file mẫu (lib/materialTemplate.ts) rồi ĐƯA THẲNG qua chính bộ đọc mà
 * trang nhập danh mục dùng (lib/materialImport.ts), và đối chiếu kết quả.
 *
 * Vì sao cần: phát cho tàu một file mẫu mà nhập lại không được thì tệ hơn là
 * không phát — người ta đã gõ xong vài trăm dòng rồi mới biết. Hai file này ở
 * hai chỗ khác nhau, đổi tên cột bên này mà quên bên kia là hỏng lặng lẽ.
 *
 * Không đụng database nên chạy lúc nào cũng được.
 */
import { taoFileMauDanhMuc } from "@/lib/materialTemplate";
import { parseMaterialExcel } from "@/lib/materialImport";
import { warehouseKindForSheet } from "@/lib/materialImport";

let dat = 0;
let truot = 0;

function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) {
    dat++;
  } else {
    truot++;
    console.log(
      `  TRUOT ${ten}\n        duoc  ${JSON.stringify(thuc)}\n        mong  ${JSON.stringify(mong)}`
    );
  }
}

async function main() {
  console.log("=== KIEM TRA FILE MAU DANH MUC ===\n");

  const buf = await taoFileMauDanhMuc();
  console.log(`File mau dung xong: ${Math.round(buf.length / 1024)} KB\n`);

  const kq = parseMaterialExcel(buf);

  console.log("1. Bo doc mo duoc file, khong bao loi");
  // Mẫu rỗng nên bộ đọc trả về lỗi "không có dòng nào" — đó là ĐÚNG, miễn là
  // nó vẫn nhận ra các sheet. Lỗi phải kiểm là lỗi ĐỌC FILE.
  kiemTra(
    "khong phai loi hong file",
    /không đọc được|không có sheet/i.test(kq.error ?? ""),
    false
  );
  kiemTra("mau chua co dong nao", kq.items.length, 0);

  console.log("\n2. Nhan dung tung sheet");
  const sheets = kq.sheets ?? [];
  const theoTen = new Map(sheets.map((s) => [s.name, s]));
  console.log(`   Doc duoc ${sheets.length} sheet:`);
  for (const s of sheets) {
    console.log(
      `     ${s.skipped ? "bo qua " : "doc    "} "${s.name}" → ${s.materialType ?? "(khong ro loai)"}`
    );
  }

  // Sheet huong dan PHAI bi bo qua: no chi co chu, khong phai bang danh muc.
  // Neu bi nhan nham la bang thi may dong huong dan se thanh vat tu.
  const hd = theoTen.get("Hướng dẫn");
  kiemTra("co sheet Huong dan", !!hd, true);
  kiemTra("sheet Huong dan bi BO QUA", hd?.skipped, true);

  // Nam sheet du lieu phai duoc nhan dung loai hang.
  const mongDoi: [string, "STORE" | "SPARE", string][] = [
    ["Phụ tùng (Spare Parts)", "SPARE", "ENG"],
    ["Vật tư (Stores)", "STORE", "STORE"],
    ["Vật tư Boong (Deck Stores)", "STORE", "DECK"],
    ["Vật tư Phục vụ (Catering)", "STORE", "STORE"],
    ["Vật tư Bảo hộ (Safety)", "STORE", "STORE"],
  ];
  for (const [ten, loai, kho] of mongDoi) {
    const s = theoTen.get(ten);
    kiemTra(`sheet "${ten}" co trong file`, !!s, true);
    // Loại hàng suy từ TÊN SHEET nên nhận ra được ngay cả khi sheet còn rỗng —
    // đây chính là chỗ dễ hỏng nếu ai đó đổi tên sheet trong file mẫu.
    kiemTra(`  loai hang cua "${ten}"`, s?.materialType, loai);
    // Sheet rỗng thì bộ đọc xếp vào "bỏ qua" — đúng, vì không có gì để nhập.
    // Việc dòng tiêu đề có đọc được hay không sẽ chứng minh ở mục 3, bằng cách
    // điền dữ liệu thật vào rồi đọc lại.
    kiemTra(`  mau con rong nen bo qua "${ten}"`, s?.skipped, true);
    kiemTra(`  kho ghi ton cua "${ten}"`, warehouseKindForSheet(ten), kho);
  }

  console.log("\n3. Dien thu vai dong roi nhap lai");
  // Đây mới là phép thử thật: chèn dữ liệu vào đúng vị trí người dùng sẽ điền
  // (ngay dưới dòng tiêu đề) rồi đọc lại xem có ra đúng từng cột không.
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "buffer" });
  const dien = (sheet: string, dong: number, cot: number, giaTri: unknown) => {
    const ws = wb.Sheets[sheet];
    const dc = XLSX.utils.encode_cell({ r: dong, c: cot });
    ws[dc] = { t: typeof giaTri === "number" ? "n" : "s", v: giaTri };
    const rng = XLSX.utils.decode_range(ws["!ref"] as string);
    rng.e.r = Math.max(rng.e.r, dong);
    rng.e.c = Math.max(rng.e.c, cot);
    ws["!ref"] = XLSX.utils.encode_range(rng);
  };
  // Dòng tiêu đề nằm ở dòng 2 (chỉ số 1) → dòng dữ liệu đầu là chỉ số 2.
  // Cột: 0 STT · 1 Nhóm · 2 Mô tả · 3 IMPA · 4 Part No. · 5 Đơn vị · 6 R.O.B · 7 Min
  dien("Phụ tùng (Spare Parts)", 2, 1, "Main Engine");
  dien("Phụ tùng (Spare Parts)", 2, 2, "Fuel valve (Vòi phun nhiên liệu)");
  dien("Phụ tùng (Spare Parts)", 2, 4, "E14200");
  dien("Phụ tùng (Spare Parts)", 2, 5, "SET");
  dien("Phụ tùng (Spare Parts)", 2, 6, 2);
  dien("Phụ tùng (Spare Parts)", 2, 7, 1);
  dien("Vật tư Boong (Deck Stores)", 2, 1, "Vật tư boong");
  dien("Vật tư Boong (Deck Stores)", 2, 2, "Gloves, cotton working ordinary");
  dien("Vật tư Boong (Deck Stores)", 2, 3, "19.01.01");
  dien("Vật tư Boong (Deck Stores)", 2, 5, "PAIR");
  dien("Vật tư Boong (Deck Stores)", 2, 6, 24);

  const buf2 = Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer
  );
  const kq2 = parseMaterialExcel(buf2);
  kiemTra("doc duoc 2 dong vua dien", kq2.items.length, 2);
  // Sheet co du lieu thi phai duoc DOC, khong con bi bo qua — day la bang
  // chung dong tieu de trong file mau dung khuon bo doc mong doi.
  const sheet2 = new Map((kq2.sheets ?? []).map((x) => [x.name, x]));
  kiemTra(
    "sheet phu tung da duoc doc",
    sheet2.get("Phụ tùng (Spare Parts)")?.skipped,
    false
  );
  kiemTra(
    "sheet boong da duoc doc",
    sheet2.get("Vật tư Boong (Deck Stores)")?.skipped,
    false
  );
  kiemTra("sheet Huong dan van bi bo qua", sheet2.get("Hướng dẫn")?.skipped, true);

  const pt = kq2.items.find((x) => x.name.startsWith("Fuel valve"));
  kiemTra("phu tung: nhan dung loai", pt?.materialType, "SPARE");
  kiemTra("phu tung: nhom = thiet bi", pt?.group, "Main Engine");
  kiemTra("phu tung: part no", pt?.partNumber, "E14200");
  kiemTra("phu tung: khong nham part no thanh IMPA", pt?.impa, null);
  kiemTra("phu tung: don vi", pt?.uom, "SET");
  kiemTra("phu tung: ton tren tau", pt?.rob, 2);
  kiemTra("phu tung: so luong toi thieu", pt?.minStock, 1);

  const vt = kq2.items.find((x) => x.name.startsWith("Gloves"));
  kiemTra("vat tu: nhan dung loai", vt?.materialType, "STORE");
  kiemTra("vat tu: ma IMPA bo dau cham", vt?.impa, "19.01.01");
  kiemTra("vat tu: don vi", vt?.uom, "PAIR");
  kiemTra("vat tu: ton tren tau", vt?.rob, 24);
  kiemTra("vat tu: vao kho boong", warehouseKindForSheet(vt?.sheet ?? null), "DECK");

  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  process.exit(truot ? 1 : 0);
}

main();
