/**
 * Kiểm tra bộ sinh và bộ soát mã vật tư.
 *
 * Chạy:  kiem-tra-ma-vat-tu.cmd
 *
 * Gọi đúng hàm mà giao diện và server action dùng (lib/maVatTu.ts), kỳ vọng
 * viết TAY theo quy ước — không suy ra từ chính hàm đang kiểm tra, vì làm vậy
 * thì bài kiểm tra chỉ chứng minh bản sao chép đúng với chính nó.
 *
 * Không đụng database nên chạy lúc nào cũng được.
 */
import {
  CHUC_DANH,
  NHOM_THIET_BI,
  boPhanYeuCau,
  chucDanhCuaNguoiDung,
  chucDanhThuocBoPhan,
  chucDanhTuVaiTro,
  chuanHoaImpa,
  kiemTraMa,
  moTaMa,
  phanTichMa,
  boCucKhoi,
  doanLoai,
  khoiCuaSo,
  soDauKhoi,
  soKhoiCanCho,
  sttTheoNhom,
  sinhMaImpa,
  sinhMaNgan,
  sttKeTiepNgan,
  sinhMaPhuTung,
  sinhMaVatTu,
  sttKeTiep,
} from "@/lib/maVatTu";
import {
  chucDanhChiuTrachNhiem,
  laNguoiPhuTrach,
} from "@/lib/chucDanhChiuTrachNhiem";
import {
  boPhanCuaChucDanh,
  docKhaiMoi,
  loiTrung,
  timTrung,
} from "@/lib/vatTuMoiChoTau";

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

function coLoi(ten: string, kq: unknown) {
  const co = !!kq && typeof kq === "object" && "loi" in (kq as object);
  if (co) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}: mong doi bao loi, nhung duoc ${JSON.stringify(kq)}`);
  }
}

console.log("=== KIEM TRA MA VAT TU ===\n");

console.log("1. Chuan hoa ma IMPA (bo dau cham, khoang trang)");
kiemTra("61.13.33", chuanHoaImpa("61.13.33"), "611333");
kiemTra("61 13 33", chuanHoaImpa("61 13 33"), "611333");
kiemTra("611333", chuanHoaImpa("611333"), "611333");
kiemTra("61-13-33", chuanHoaImpa("61-13-33"), "611333");
kiemTra("thieu so -> null", chuanHoaImpa("6113"), null);
kiemTra("thua so -> null", chuanHoaImpa("6113333"), null);
kiemTra("co chu -> null", chuanHoaImpa("61A333"), null);
kiemTra("rong -> null", chuanHoaImpa(""), null);
kiemTra("null -> null", chuanHoaImpa(null), null);

console.log("\n2. Sinh ma vat tu tieu hao (IMPA)");
kiemTra(
  "Boong - Thuy thu truong - 61.13.33",
  sinhMaImpa({ boPhan: "D", chucDanh: "BSN", impa: "61.13.33" }),
  { ma: "D-BSN-IMP-611333" }
);
kiemTra(
  "May - May truong - 570101",
  sinhMaImpa({ boPhan: "E", chucDanh: "CE", impa: "570101" }),
  { ma: "E-CE-IMP-570101" }
);
coLoi(
  "chuc danh boong gan vao bo phan may",
  sinhMaImpa({ boPhan: "E", chucDanh: "BSN", impa: "611333" })
);
coLoi(
  "chuc danh khong co trong quy uoc",
  sinhMaImpa({ boPhan: "D", chucDanh: "XX", impa: "611333" })
);
coLoi("ma IMPA sai", sinhMaImpa({ boPhan: "D", chucDanh: "BSN", impa: "61133" }));

console.log("\n3. Sinh ma phu tung theo thiet bi");
kiemTra(
  "May - May hai - MAN B&W - 1",
  sinhMaPhuTung({ boPhan: "E", chucDanh: "2E", nhomThietBi: "BME", stt: 1 }),
  { ma: "E-2E-SPA-BME-0001" }
);
kiemTra(
  "STT 4 chu so",
  sinhMaPhuTung({ boPhan: "E", chucDanh: "4E", nhomThietBi: "PUR", stt: 137 }),
  { ma: "E-4E-SPA-PUR-0137" }
);
kiemTra(
  "Boong - Dai pho - chang buoc container",
  sinhMaPhuTung({ boPhan: "D", chucDanh: "CO", nhomThietBi: "LSH", stt: 12 }),
  { ma: "D-CO-SPA-LSH-0012" }
);
coLoi(
  "nhom thiet bi cua may gan vao bo phan boong",
  sinhMaPhuTung({ boPhan: "D", chucDanh: "CO", nhomThietBi: "BME", stt: 1 })
);
coLoi(
  "nhom thiet bi khong co",
  sinhMaPhuTung({ boPhan: "E", chucDanh: "2E", nhomThietBi: "ZZZ", stt: 1 })
);
coLoi(
  "STT vuot 9999",
  sinhMaPhuTung({ boPhan: "E", chucDanh: "2E", nhomThietBi: "BME", stt: 10000 })
);
coLoi(
  "STT bang 0",
  sinhMaPhuTung({ boPhan: "E", chucDanh: "2E", nhomThietBi: "BME", stt: 0 })
);

console.log("\n4. So thu tu ke tiep — lay theo so LON NHAT dang dung");
{
  const daCo = [
    "E-2E-SPA-BME-0001",
    "E-2E-SPA-BME-0007",
    "E-2E-SPA-BME-0003",
    "E-2E-SPA-UEC-0009", // nhom khac, khong duoc tinh
    "D-CO-SPA-LSH-0100", // bo phan khac
    "E-2E-STO-0050", // vat tu, dem rieng
  ];
  kiemTra(
    "ke tiep sau 0007",
    sttKeTiep({ boPhan: "E", chucDanh: "2E", nhomThietBi: "BME" }, daCo),
    8
  );
  kiemTra(
    "nhom chua co ma nao -> 1",
    sttKeTiep({ boPhan: "E", chucDanh: "3E", nhomThietBi: "AEG" }, daCo),
    1
  );
  // Diem quan trong: xoa dong giua chung khong duoc lam so quay lai.
  const sauKhiXoa = ["E-2E-SPA-BME-0001", "E-2E-SPA-BME-0007"];
  kiemTra(
    "xoa bot dong van khong cap lai so cu",
    sttKeTiep({ boPhan: "E", chucDanh: "2E", nhomThietBi: "BME" }, sauKhiXoa),
    8
  );
}

console.log("\n4b. Vat tu KHONG co ma IMPA — dang STO");
kiemTra(
  "Boong - Thuy thu truong - STT 1",
  sinhMaVatTu({ boPhan: "D", chucDanh: "BSN", stt: 1 }),
  { ma: "D-BSN-STO-0001" }
);
kiemTra(
  "May - May truong - STT 42",
  sinhMaVatTu({ boPhan: "E", chucDanh: "CE", stt: 42 }),
  { ma: "E-CE-STO-0042" }
);
coLoi("chuc danh sai bo phan", sinhMaVatTu({ boPhan: "E", chucDanh: "BSN", stt: 1 }));
kiemTra("ma STO hop le", kiemTraMa("D-BSN-STO-0001"), { hopLe: true });
kiemTra(
  "phan tich ma STO",
  phanTichMa("D-BSN-STO-0007"),
  {
    raw: "D-BSN-STO-0007",
    boPhan: "D",
    chucDanh: "BSN",
    loai: "STO",
    nhomThietBi: null,
    impa: null,
    stt: 7,
  }
);
// Diem chinh cua lan sua nay: vat tu va phu tung KHONG con lan vao nhau.
{
  const vatTu = phanTichMa("D-BSN-STO-0001");
  const phuTung = phanTichMa("D-BSN-SPA-LSH-0001");
  const ok =
    !("loi" in vatTu) &&
    !("loi" in phuTung) &&
    vatTu.loai === "STO" &&
    phuTung.loai === "SPA";
  if (ok) dat++;
  else {
    truot++;
    console.log("  TRUOT: khong phan biet duoc vat tu voi phu tung");
  }
}
kiemTra(
  "so thu tu STO dem rieng khoi SPA",
  sttKeTiep({ boPhan: "E", chucDanh: "2E" }, [
    "E-2E-STO-0050",
    "E-2E-SPA-BME-0900",
  ]),
  51
);

console.log("\n4c. Bon bo phan: Boong · May · Dien · Phuc vu");
kiemTra(
  "Dien - si quan dien - bang dien",
  sinhMaPhuTung({ boPhan: "L", chucDanh: "ETO", nhomThietBi: "SWB", stt: 3 }),
  { ma: "L-ETO-SPA-SWB-0003" }
);
kiemTra(
  "Phuc vu - bep truong - do bep",
  sinhMaVatTu({ boPhan: "C", chucDanh: "CCK", stt: 5 }),
  { ma: "C-CCK-STO-0005" }
);
kiemTra(
  "Phuc vu - phuc vu vien - IMPA",
  sinhMaImpa({ boPhan: "C", chucDanh: "STW", impa: "17.03.10" }),
  { ma: "C-STW-IMP-170310" }
);
kiemTra("ma dien hop le", kiemTraMa("L-ELC-STO-0001"), { hopLe: true });
kiemTra("ma phuc vu hop le", kiemTraMa("C-CCK-SPA-GAL-0001"), { hopLe: true });

// KIEM NHIEM: tau khong co si quan dien thi may hai/may ba giu kho dien.
kiemTra(
  "may hai kiem nhiem kho dien",
  sinhMaPhuTung({ boPhan: "L", chucDanh: "2E", nhomThietBi: "MOT", stt: 1 }),
  { ma: "L-2E-SPA-MOT-0001" }
);
kiemTra("si quan dien kiem nhiem buong may", chucDanhThuocBoPhan("ETO", "E"), true);
kiemTra("dai pho kiem nhiem phuc vu", chucDanhThuocBoPhan("CO", "C"), true);
// Nhung kiem nhiem CO GIOI HAN: khong phai ai cung giu duoc moi thu.
kiemTra("bep truong khong giu hang may", chucDanhThuocBoPhan("CCK", "E"), false);
kiemTra("thuy thu truong khong giu hang dien", chucDanhThuocBoPhan("BSN", "L"), false);
kiemTra("may tu khong giu hang dien", chucDanhThuocBoPhan("4E", "L"), false);
coLoi(
  "bep truong gan vao bo phan may",
  sinhMaVatTu({ boPhan: "E", chucDanh: "CCK", stt: 1 })
);
coLoi(
  "nhom bep gan vao bo phan dien",
  sinhMaPhuTung({ boPhan: "L", chucDanh: "ETO", nhomThietBi: "GAL", stt: 1 })
);

// Bo phan cua ma phai dan toi dung duong phe duyet yeu cau vat tu.
kiemTra("Boong -> DECK", boPhanYeuCau("D"), "DECK");
kiemTra("May -> ENGINE", boPhanYeuCau("E"), "ENGINE");
kiemTra("Dien -> ELECTRICAL", boPhanYeuCau("L"), "ELECTRICAL");
kiemTra("Phuc vu -> GENERAL", boPhanYeuCau("C"), "GENERAL");

console.log("\n4d. Chuc danh cua nguoi dang dang nhap");
// Vai tro dang nhap suy ra chuc danh giu vat tu — dung cho man hinh
// "vat tu toi quan ly".
kiemTra("may hai", chucDanhTuVaiTro("SECOND_ENGINEER"), "2E");
kiemTra("dai pho", chucDanhTuVaiTro("CHIEF_OFFICER"), "CO");
kiemTra("thuyen truong", chucDanhTuVaiTro("MASTER"), "MST");
// Van phong khong giu kho nao — khong duoc suy bua ra mot chuc danh tau.
kiemTra("quan tri", chucDanhTuVaiTro("ADMIN"), null);
kiemTra("quan ly ky thuat", chucDanhTuVaiTro("TECH_MANAGER"), null);
// Thuy thu truong, tho may, si quan dien, bep truong deu dang nhap bang CREW
// nen KHONG suy ra duoc — phai khai tay o cot rankCode.
kiemTra("thuyen vien chung chung", chucDanhTuVaiTro("CREW"), null);

kiemTra(
  "khai tay duoc uu tien hon vai tro",
  chucDanhCuaNguoiDung({ role: "CREW", rankCode: "BSN" }),
  "BSN"
);
kiemTra(
  "khong khai tay thi suy tu vai tro",
  chucDanhCuaNguoiDung({ role: "THIRD_ENGINEER", rankCode: null }),
  "3E"
);
kiemTra(
  "khai tay sai ma thi bo qua, quay ve vai tro",
  chucDanhCuaNguoiDung({ role: "CHIEF_ENGINEER", rankCode: "XYZ" }),
  "CE"
);
kiemTra(
  "thuyen vien chua khai tay -> khong co chuc danh",
  chucDanhCuaNguoiDung({ role: "CREW" }),
  null
);
// Bep truong dang nhap bang CREW nhung khai tay CCK thi ra dung bo phan Phuc vu.
{
  const cd = chucDanhCuaNguoiDung({ role: "CREW", rankCode: "CCK" });
  kiemTra("bep truong: ra dung chuc danh", cd, "CCK");
  kiemTra("bep truong: thuoc bo phan Phuc vu", CHUC_DANH[cd!].boPhan, "C");
}

console.log("\n5. Phan tich va soat ma");
kiemTra("ma IMPA hop le", kiemTraMa("D-BSN-IMP-611333"), { hopLe: true });
kiemTra("ma phu tung hop le", kiemTraMa("E-2E-SPA-BME-0001"), { hopLe: true });
kiemTra(
  "phan tich ma IMPA",
  phanTichMa("D-BSN-IMP-611333"),
  {
    raw: "D-BSN-IMP-611333",
    boPhan: "D",
    chucDanh: "BSN",
    loai: "IMP",
    nhomThietBi: null,
    impa: "611333",
    stt: null,
  }
);
kiemTra(
  "phan tich ma phu tung",
  phanTichMa("E-4E-SPA-PUR-0137"),
  {
    raw: "E-4E-SPA-PUR-0137",
    boPhan: "E",
    chucDanh: "4E",
    loai: "SPA",
    nhomThietBi: "PUR",
    impa: null,
    stt: 137,
  }
);
kiemTra("chu thuong van doc duoc", kiemTraMa("e-2e-spa-bme-0001"), { hopLe: true });
kiemTra("co khoang trang thua", kiemTraMa("  E-2E-SPA-BME-0001  "), { hopLe: true });

for (const [ma, viSao] of [
  ["E-2E-SPA-BME-1", "STT thieu chu so"],
  ["E-2E-SPA-BME-00001", "STT thua chu so"],
  ["X-2E-SPA-BME-0001", "bo phan khong ton tai"],
  ["E-BSN-SPA-BME-0001", "chuc danh boong o bo phan may"],
  ["D-CO-SPA-BME-0001", "nhom thiet bi may o bo phan boong"],
  ["E-2E-BME-0001", "thieu doan loai hang (khuon cu)"],
  ["E-2E-XYZ-0001", "doan loai hang khong hop le"],
  ["E-2E-IMP-61133", "ma IMPA thieu so"],
  ["E2EBME0001", "khong co dau gach ngang"],
  ["", "ma rong"],
] as const) {
  const kq = kiemTraMa(ma);
  if (!kq.hopLe) dat++;
  else {
    truot++;
    console.log(`  TRUOT "${ma}" (${viSao}): dang duoc coi la HOP LE`);
  }
}

console.log("\n6. Mo ta ma bang tieng Viet");
kiemTra(
  "mo ta ma IMPA",
  moTaMa("D-BSN-IMP-611333"),
  "Boong · Thủy thủ trưởng · vật tư IMPA 611333"
);
kiemTra(
  "mo ta ma phu tung",
  moTaMa("E-2E-SPA-BME-0001"),
  "Máy · Máy hai · phụ tùng · Máy chính MAN B&W (2 kỳ) · STT 1"
);
kiemTra(
  "mo ta ma vat tu khong IMPA",
  moTaMa("D-BSN-STO-0001"),
  "Boong · Thủy thủ trưởng · vật tư (không có IMPA) · STT 1"
);

console.log("\n7. Tu dien quy uoc");
{
  // Moi nhom thiet bi phai co it nhat mot chuc danh, va chuc danh do phai
  // DUOC PHEP giu hang cua bo phan do (ke ca theo dien kiem nhiem) — sai cho
  // nay thi giao dien goi y ra nguoi khong co trach nhiem giu mon hang do.
  for (const [ma, nhom] of Object.entries(NHOM_THIET_BI)) {
    const ok =
      nhom.chucDanh.length > 0 &&
      nhom.chucDanh.every((cd) => chucDanhThuocBoPhan(cd, nhom.boPhan));
    if (ok) dat++;
    else {
      truot++;
      console.log(`  TRUOT nhom ${ma}: chuc danh goi y khong dung bo phan`);
    }
  }
  // Moi chuc danh phai sinh duoc ma — bat loi go nham ma chuc danh trong tu dien.
  for (const [ma, cd] of Object.entries(CHUC_DANH)) {
    // Chuc danh kiem nhiem phai sinh duoc ma o CA bo phan kiem nhiem.
    for (const bp of cd.kiemNhiem ?? []) {
      const kq2 = sinhMaImpa({ boPhan: bp, chucDanh: ma, impa: "123456" });
      if ("ma" in kq2 && kiemTraMa(kq2.ma).hopLe) dat++;
      else {
        truot++;
        console.log(`  TRUOT chuc danh ${ma} kiem nhiem ${bp}: khong sinh duoc ma`);
      }
    }
    const kq = sinhMaImpa({ boPhan: cd.boPhan, chucDanh: ma, impa: "123456" });
    if ("ma" in kq && kiemTraMa(kq.ma).hopLe) dat++;
    else {
      truot++;
      console.log(`  TRUOT chuc danh ${ma}: khong sinh duoc ma hop le`);
    }
  }
}

console.log("\n8. KHUON DANG DUNG: [bo phan]-IMPA/SPR-[4 so]");

// Day la khuon that su nam tren nhan dan ngoai kho va tren phieu xuat kho. Moi
// khang dinh o duoi deu la mot cau ma nguoi dung tau se doc thanh loi.
kiemTra("vat tu boong", sinhMaNgan({ boPhan: "D", loai: "IMPA", stt: 75 }), {
  ma: "D-IMPA-0075",
});
kiemTra("phu tung may", sinhMaNgan({ boPhan: "E", loai: "SPR", stt: 34 }), {
  ma: "E-SPR-0034",
});
kiemTra("vat tu dien", sinhMaNgan({ boPhan: "L", loai: "IMPA", stt: 3 }), {
  ma: "L-IMPA-0003",
});
kiemTra("vat tu phuc vu", sinhMaNgan({ boPhan: "C", loai: "IMPA", stt: 7 }), {
  ma: "C-IMPA-0007",
});
coLoi("bo phan la", sinhMaNgan({ boPhan: "X" as never, loai: "IMPA", stt: 1 }));
coLoi("loai la", sinhMaNgan({ boPhan: "D", loai: "SPA" as never, stt: 1 }));
coLoi("stt 0", sinhMaNgan({ boPhan: "D", loai: "IMPA", stt: 0 }));
coLoi("stt qua 9999", sinhMaNgan({ boPhan: "D", loai: "IMPA", stt: 10000 }));

// SPARE -> SPR, con lai -> IMPA. Lay tu COT materialType chu khong suy tu "co
// ma IMPA hay khong": mot cai bom du phong van la phu tung du nha cung cap co
// gan cho no ma IMPA, con mot cuon bang dinh khong co ma IMPA van la vat tu.
kiemTra("SPARE -> SPR", doanLoai("SPARE"), "SPR");
kiemTra("STORE -> IMPA", doanLoai("STORE"), "IMPA");
kiemTra("null -> IMPA", doanLoai(null), "IMPA");

console.log("\n8b. Doc nguoc lai ma khuon dang dung");
kiemTra("ma vat tu hop le", kiemTraMa("D-IMPA-0075"), { hopLe: true });
kiemTra("ma phu tung hop le", kiemTraMa("E-SPR-0034"), { hopLe: true });
kiemTra("chu thuong van doc duoc", kiemTraMa("d-impa-0075"), { hopLe: true });
kiemTra("phan tich", phanTichMa("D-IMPA-0075"), {
  raw: "D-IMPA-0075",
  boPhan: "D",
  chucDanh: null,
  loai: "IMPA",
  nhomThietBi: null,
  impa: null,
  stt: 75,
});
// Khuon nay KHONG noi ai giu — phai la null, khong duoc doan bua ra mot chuc
// danh: doan sai la mon hang bien mat khoi danh sach kiem ke cua nguoi that su
// dang giu no.
kiemTra(
  "khong noi chuc danh",
  (phanTichMa("E-SPR-0034") as { chucDanh: string | null }).chucDanh,
  null
);
kiemTra("thieu so -> sai", kiemTraMa("D-IMPA-75").hopLe, false);
kiemTra("thua so -> sai", kiemTraMa("D-IMPA-00075").hopLe, false);
kiemTra("bo phan la -> sai", kiemTraMa("X-IMPA-0075").hopLe, false);
kiemTra("loai la -> sai", kiemTraMa("D-STORE-0075").hopLe, false);
kiemTra("mo ta vat tu", moTaMa("D-IMPA-0075"), "Boong · Vật tư · STT 75");
kiemTra("mo ta phu tung", moTaMa("E-SPR-0034"), "Máy · Phụ tùng · STT 34");

console.log("\n8c. So thu tu ke tiep — LON NHAT + 1, khong phai dem so dong");
{
  const daCo = ["D-IMPA-0001", "D-IMPA-0007", "E-SPR-0003", "L-IMPA-0002"];
  kiemTra("boong tiep theo", sttKeTiepNgan("D", "IMPA", daCo), 8);
  kiemTra("phu tung may tiep theo", sttKeTiepNgan("E", "SPR", daCo), 4);
  kiemTra("khuon chua co ma nao", sttKeTiepNgan("C", "SPR", daCo), 1);
  // Xoa mot dong giua chung KHONG duoc lam so quay lai: ma cu con nam tren
  // thung hang trong kho.
  const sauKhiXoa = daCo.filter((m) => m !== "D-IMPA-0001");
  kiemTra("xoa giua chung van khong quay lai", sttKeTiepNgan("D", "IMPA", sauKhiXoa), 8);
  // Moi khuon mot day so rieng, khong lan sang nhau.
  kiemTra("khong lan sang SPR", sttKeTiepNgan("D", "SPR", daCo), 1);
}

// Sinh ra roi doc lai phai ve dung cho cu. Vong tron nay bat moi lech giua bo
// sinh va bo doc — thu de lot nhat khi sau nay co ai sua mot ben.
{
  let vong = 0;
  for (const bp of ["D", "E", "L", "C"] as const) {
    for (const loai of ["IMPA", "SPR"] as const) {
      for (const stt of [1, 42, 9999]) {
        const kq = sinhMaNgan({ boPhan: bp, loai, stt });
        if (!("ma" in kq)) {
          truot++;
          continue;
        }
        const doc = phanTichMa(kq.ma);
        if ("loi" in doc) {
          truot++;
          console.log(`  TRUOT sinh roi doc ${kq.ma}: ${doc.loi.split("\n")[0]}`);
          continue;
        }
        if (doc.boPhan === bp && doc.loai === loai && doc.stt === stt) vong++;
        else {
          truot++;
          console.log(`  TRUOT sinh roi doc ${kq.ma}: doc ra khac luc sinh`);
        }
      }
    }
  }
  dat += vong;
  console.log(`   sinh roi doc lai: ${vong}/24 vong tron khop`);
}

console.log("\n9. Danh so THEO KHOI — moi nhom mot dai so rieng");

kiemTra("khoi cua so 1", khoiCuaSo(1), 1);
kiemTra("khoi cua so 100", khoiCuaSo(100), 1);
kiemTra("khoi cua so 101", khoiCuaSo(101), 2);
kiemTra("so dau khoi 1", soDauKhoi(1), 1);
kiemTra("so dau khoi 4", soDauKhoi(4), 301);
// Du chua gap doi so hang dang co: cho trong chinh la de nhap them ma khong
// phai danh so lai ca danh muc — danh so lai la phai in lai nhan dan ngoai kho.
kiemTra("1 mat hang -> 1 khoi", soKhoiCanCho(1), 1);
kiemTra("49 mat hang -> 1 khoi", soKhoiCanCho(49), 1);
kiemTra("51 mat hang -> 2 khoi", soKhoiCanCho(51), 2);
kiemTra("142 mat hang -> 3 khoi", soKhoiCanCho(142), 3);
kiemTra("nhom rong van co 1 khoi", soKhoiCanCho(0), 1);

console.log("\n9b. Bo cuc khoi khi xep lai ca khuon");
{
  const bc = boCucKhoi([
    { nhom: "boong", soMatHang: 142 },
    { nhom: "an-toan", soMatHang: 2 },
    { nhom: "bao-ho", soMatHang: 35 },
  ]);
  kiemTra("nhom dau", bc.get("boong"), { dau: 1, cuoi: 300 });
  kiemTra("nhom hai bat dau o moc tram", bc.get("an-toan"), { dau: 301, cuoi: 400 });
  kiemTra("nhom ba", bc.get("bao-ho"), { dau: 401, cuoi: 500 });
}

console.log("\n9c. Cap so cho hang MOI — roi vao dung khoi cua nhom");
{
  // Bo cuc: nhom A giu 0001-0300 (dang dung toi 0142), nhom B giu 0301-0400.
  const daCo = [
    { ma: "D-IMPA-0001", nhom: "A" },
    { ma: "D-IMPA-0142", nhom: "A" },
    { ma: "D-IMPA-0301", nhom: "B" },
    { ma: "D-IMPA-0302", nhom: "B" },
  ];
  kiemTra("hang moi cua nhom A", sttTheoNhom("D", "IMPA", daCo, "A"), {
    stt: 143,
    trongKhoi: true,
  });
  kiemTra("hang moi cua nhom B", sttTheoNhom("D", "IMPA", daCo, "B"), {
    stt: 303,
    trongKhoi: true,
  });
  // Nhom chua co ma nao thi MO KHOI MOI o moc tram ke tiep, khong chen vao
  // giua khoi cua nguoi khac.
  kiemTra("nhom moi mo khoi moi", sttTheoNhom("D", "IMPA", daCo, "C"), {
    stt: 401,
    trongKhoi: true,
  });
  // Khuon chua co ma nao thi bat dau tu 0001.
  kiemTra("khuon con trong", sttTheoNhom("C", "SPR", daCo, "A"), {
    stt: 1,
    trongKhoi: true,
  });
  // Khong lan sang khuon khac: E-SPR khong thay gi cua D-IMPA.
  kiemTra("khong lan khuon", sttTheoNhom("E", "SPR", daCo, "A"), {
    stt: 1,
    trongKhoi: true,
  });
}

console.log("\n9d. Khoi day thi xep vao duoi VA BAO LEN");
{
  // Nhom A chi con dung mot cho truoc khi cham nhom B.
  const chatCho = [
    { ma: "D-IMPA-0001", nhom: "A" },
    { ma: "D-IMPA-0002", nhom: "A" },
    { ma: "D-IMPA-0003", nhom: "B" },
    { ma: "D-IMPA-0004", nhom: "B" },
  ];
  // 0003 da co nguoi giu -> khong chen duoc, phai xuong duoi.
  kiemTra("khoi kin -> xuong duoi", sttTheoNhom("D", "IMPA", chatCho, "A"), {
    stt: 5,
    trongKhoi: false,
  });
  // trongKhoi:false khong phai loi — no la tin hieu de chay lai --theo-nhom.
  // Mat ma van dung khuon va van khong trung.
  const cho = sttTheoNhom("D", "IMPA", chatCho, "A");
  const ma = sinhMaNgan({ boPhan: "D", loai: "IMPA", stt: cho.stt });
  kiemTra("ma van hop le", "ma" in ma && kiemTraMa(ma.ma).hopLe, true);
}

console.log("\n9e. Xoa hang giua chung KHONG duoc lam so quay lai");
{
  // Ma cu con nam tren thung hang trong kho: cap lai dung so do la hai mon
  // hang khac nhau cung mot ma.
  const sauKhiXoa = [
    { ma: "D-IMPA-0001", nhom: "A" },
    { ma: "D-IMPA-0005", nhom: "A" },
  ];
  kiemTra("van di tiep tu so lon nhat", sttTheoNhom("D", "IMPA", sauKhiXoa, "A"), {
    stt: 6,
    trongKhoi: true,
  });
}

console.log("\n10. Chuc danh chiu trach nhiem (cot \"Giu boi\")");

// Cot da gan tay thi ton trong tuyet doi, khong suy lai.
kiemTra("da gan -> ton trong", chucDanhChiuTrachNhiem({
  responsibleRank: "2E", categoryCode: "CAT-boong-deck", materialType: "STORE",
}), { chucDanh: "2E", nguon: "gan" });

// Phu tung may: chia theo si quan phu trach tung cum may.
kiemTra("may chinh -> May 2", chucDanhChiuTrachNhiem({
  categoryCode: "CAT-main-engine", materialType: "SPARE",
}), { chucDanh: "2E", nguon: "thiet-bi" });
kiemTra("may phu -> May 3", chucDanhChiuTrachNhiem({
  categoryCode: "CAT-aux-engine", materialType: "SPARE",
}), { chucDanh: "3E", nguon: "thiet-bi" });
kiemTra("phan ly dau -> May 4", chucDanhChiuTrachNhiem({
  categoryCode: "CAT-oil-separator", materialType: "SPARE",
}), { chucDanh: "4E", nguon: "thiet-bi" });

// Khong nhan ra thiet bi -> nguoi giu kho cua bo phan (suy tu ten nhom).
kiemTra("hang boong -> Thuy thu truong", chucDanhChiuTrachNhiem({
  categoryName: "Boong (Deck)", materialType: "STORE",
}), { chucDanh: "BSN", nguon: "bo-phan" });
kiemTra("hang phuc vu -> Bep truong", chucDanhChiuTrachNhiem({
  categoryName: "Phục vụ (Catering)", materialType: "STORE",
}), { chucDanh: "CCK", nguon: "bo-phan" });
kiemTra("hang dien -> Tho dien", chucDanhChiuTrachNhiem({
  categoryName: "Electrical Stores", materialType: "STORE",
}), { chucDanh: "ELC", nguon: "bo-phan" });
kiemTra("kho may chung -> May truong", chucDanhChiuTrachNhiem({
  categoryCode: "CAT-engine-stores", categoryName: "Engine Stores", materialType: "STORE",
}), { chucDanh: "CE", nguon: "thiet-bi" });

// Moi mat hang deu co nguoi giu — khong bao gio tra null cho hang thuong.
kiemTra("luon co nguoi giu", chucDanhChiuTrachNhiem({
  categoryName: "Linh tinh khong ro", materialType: "STORE",
}) !== null, true);

console.log("\n11. Loc theo chuc danh phu trach (nut Tim) — khop cot \"Giu boi\"");

const monMayChinh = { categoryCode: "CAT-main-engine", materialType: "SPARE" };
const monMayPhu = { categoryCode: "CAT-aux-engine", materialType: "SPARE" };
const monKhoMay = { categoryCode: "CAT-engine-stores", categoryName: "Engine Stores", materialType: "STORE" };
const monBoong = { categoryName: "Boong (Deck)", materialType: "STORE" };
const monBep = { categoryName: "Phục vụ (Catering)", materialType: "STORE" };

// Cap giu kho: chon ra DUNG phan minh giu, khong lan sang cum may khac.
kiemTra("May 2 phu trach may chinh", laNguoiPhuTrach("2E", monMayChinh), true);
kiemTra("May 3 KHONG phu trach may chinh", laNguoiPhuTrach("3E", monMayChinh), false);
kiemTra("May 3 phu trach may phu", laNguoiPhuTrach("3E", monMayPhu), true);
kiemTra("May 3 KHONG phu trach hang boong", laNguoiPhuTrach("3E", monBoong), false);

// Cap chi huy: bao trum ca phan cap duoi.
kiemTra("May truong bao trum may chinh", laNguoiPhuTrach("CE", monMayChinh), true);
kiemTra("May truong giu kho may chung", laNguoiPhuTrach("CE", monKhoMay), true);
kiemTra("Dai pho bao trum kho boong", laNguoiPhuTrach("CO", monBoong), true);
kiemTra("Thuyen truong bao trum ca bep", laNguoiPhuTrach("MST", monBep), true);

// Thuy thu truong giu boong; Pho 2 khong giu kho nen khong khop.
kiemTra("Thuy thu truong giu boong", laNguoiPhuTrach("BSN", monBoong), true);
kiemTra("Pho 2 khong giu kho boong", laNguoiPhuTrach("2O", monBoong), false);

console.log("\n12. Khai mat hang moi tai tau, gan chuc danh (lib/vatTuMoiChoTau)");

// Bo phan theo chuc danh: bo phan chinh truoc, kiem nhiem sau.
kiemTra("May 2: May roi Dien", boPhanCuaChucDanh("2E"), ["E", "L"]);
kiemTra("Thuyen truong: Boong roi Phuc vu", boPhanCuaChucDanh("MST"), ["D", "C"]);
kiemTra("Thuy thu truong: chi Boong", boPhanCuaChucDanh("BSN"), ["D"]);
kiemTra("chuc danh la: rong", boPhanCuaChucDanh("XYZ"), []);

// Doc form dung -> du lieu da chuan hoa.
const khaiDung = docKhaiMoi({
  rankCode: "2e",
  materialType: "SPARE",
  nameVn: "  Vòi   phun ",
  nameEn: "",
  equipment: "Máy đèn số 2",
  partNumber: " 123-A ",
  uom: "set",
  minStock: "2",
  categoryId: "7",
  isCritical: "on",
});
kiemTra("khai dung: ok", khaiDung.ok, true);
if (khaiDung.ok) {
  kiemTra("chuc danh viet hoa", khaiDung.gt.rankCode, "2E");
  kiemTra("bo phan mac dinh theo chuc danh", khaiDung.gt.boPhan, "E");
  kiemTra("ten gon khoang trang", khaiDung.gt.nameVn, "Vòi phun");
  kiemTra("ten Anh trong -> null", khaiDung.gt.nameEn, null);
  kiemTra("DVT viet hoa", khaiDung.gt.uom, "SET");
  kiemTra("ton toi thieu thanh so", khaiDung.gt.minStock, 2);
  kiemTra("nhom thanh so", khaiDung.gt.categoryId, 7);
  kiemTra("critical", khaiDung.gt.isCritical, true);
  kiemTra("part no gon", khaiDung.gt.partNumber, "123-A");
}

// Kiem nhiem: May 2 giu duoc hang Dien, KHONG giu duoc hang Boong.
kiemTra(
  "May 2 giu hang Dien: ok",
  docKhaiMoi({ rankCode: "2E", boPhan: "L", nameVn: "Cầu chì" }).ok,
  true
);
const saiBoPhan = docKhaiMoi({ rankCode: "2E", boPhan: "D", nameVn: "Dây" });
kiemTra("May 2 giu hang Boong: tu choi", saiBoPhan.ok, false);
kiemTra(
  "...loi noi ro chon May hoac Dien",
  !saiBoPhan.ok && saiBoPhan.loi.includes("Máy hoặc Điện"),
  true
);

// Loi DAU TIEN, viet cho nguoi van hanh.
kiemTra("thieu chuc danh", docKhaiMoi({ nameVn: "X" }), {
  ok: false,
  loi: "Chọn chức danh sẽ giữ mặt hàng này.",
});
const chucDanhLa = docKhaiMoi({ rankCode: "ABC", nameVn: "X" });
kiemTra(
  "chuc danh la",
  !chucDanhLa.ok && chucDanhLa.loi.includes("không có trong quy ước"),
  true
);
kiemTra("thieu ten", docKhaiMoi({ rankCode: "BSN", nameVn: "  " }).ok, false);
kiemTra(
  "phu tung thieu thiet bi",
  docKhaiMoi({ rankCode: "3E", materialType: "SPARE", nameVn: "Bạc" }).ok,
  false
);
kiemTra(
  "vat tu khong can thiet bi",
  docKhaiMoi({ rankCode: "BSN", materialType: "STORE", nameVn: "Giẻ lau" }).ok,
  true
);
kiemTra(
  "ton toi thieu am",
  docKhaiMoi({ rankCode: "BSN", nameVn: "X", minStock: "-1" }).ok,
  false
);
const vatTuCoThietBi = docKhaiMoi({
  rankCode: "BSN",
  materialType: "STORE",
  nameVn: "X",
  equipment: "Tời",
});
kiemTra(
  "vat tu: thiet bi bi bo (chi phu tung moi co)",
  vatTuCoThietBi.ok && vatTuCoThietBi.gt.equipment,
  null
);

// Trung: cung ba tieu chi voi buoc nhap file.
const daCo = [
  {
    code: "E-SPR-0301",
    nameVn: "Bạc trục",
    equipment: "Máy chính",
    impa: null,
    partNumber: "BT-01",
    manufacturer: null,
    isActive: true,
  },
  {
    code: "D-IMPA-0075",
    nameVn: "Găng tay da",
    equipment: null,
    impa: "190411",
    partNumber: null,
    manufacturer: null,
    isActive: false,
  },
];
kiemTra(
  "trung IMPA",
  timTrung(
    { nameVn: "Găng khác", equipment: null, impa: " 190411 ", partNumber: null },
    daCo
  )?.theo,
  "impa"
);
kiemTra(
  "trung Part No (khong phan biet hoa thuong)",
  timTrung(
    { nameVn: "Tên khác", equipment: null, impa: null, partNumber: "bt-01" },
    daCo
  )?.theo,
  "part-no"
);
kiemTra(
  "trung ten + thiet bi",
  timTrung(
    { nameVn: "bạc  trục", equipment: "máy chính", impa: null, partNumber: null },
    daCo
  )?.theo,
  "ten"
);
kiemTra(
  "cung ten khac thiet bi: KHONG trung",
  timTrung(
    { nameVn: "Bạc trục", equipment: "Máy đèn", impa: null, partNumber: null },
    daCo
  ),
  null
);
kiemTra(
  "khong trung",
  timTrung(
    { nameVn: "Mới tinh", equipment: null, impa: null, partNumber: null },
    daCo
  ),
  null
);
kiemTra(
  "loi trung chi sang o chon",
  loiTrung({ mon: daCo[0], theo: "part-no" }).includes(
    "Chọn vật tư từ danh mục gốc"
  ),
  true
);
kiemTra(
  "loi trung hang ngung dung",
  loiTrung({ mon: daCo[1], theo: "impa" }).includes("Ngừng dùng"),
  true
);

console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
process.exit(truot ? 1 : 0);
