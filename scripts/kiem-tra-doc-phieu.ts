/**
 * Kiểm tra bộ tách dữ liệu phiếu nhận (BDN scan / phiếu giao / bảng dán tay).
 *
 * Chạy:  kiem-tra-doc-phieu.cmd
 *
 * Gọi đúng hàm mà server dùng. Không đụng database, không cần Windows — phần
 * OCR nằm ở lib/pdfOcr.ts, còn đây chỉ kiểm phần tách chuỗi, vốn là chỗ dễ sai
 * lặng lẽ nhất: đọc nhầm một chữ số của khối lượng dầu là sai cả bảng cân đối
 * nhiên liệu.
 */
import { docPhieuTuChu, type PhieuDeXuat } from "@/lib/bunkerParse";

let dat = 0;
let truot = 0;

function kiem(ten: string, chu: string, mong: Partial<PhieuDeXuat>) {
  const kq = docPhieuTuChu(chu);
  const loi: string[] = [];
  for (const [k, v] of Object.entries(mong)) {
    const thuc = (kq as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(thuc) !== JSON.stringify(v)) {
      loi.push(`${k}: duoc ${JSON.stringify(thuc)}, mong ${JSON.stringify(v)}`);
    }
  }
  if (loi.length === 0) {
    dat++;
    console.log(`  OK    ${ten}`);
  } else {
    truot++;
    console.log(`  TRUOT ${ten}`);
    for (const l of loi) console.log(`          ${l}`);
  }
}

console.log("=== BDN TIENG ANH DAY DU ===");
kiem(
  "BDN Singapore chuan",
  `BUNKER DELIVERY NOTE
BDN No.: SG-2026-004471
Date of Delivery: 20/08/2026
Port of Delivery: SINGAPORE
Supplier: OCEAN BUNKER PTE LTD
Barge Name: MT SEA SUPPLIER 7
Product Name: VLSFO RMG 380
Quantity Delivered: 450.250 MT
Density at 15 deg C: 985.2 kg/m3
Viscosity at 50 deg C: 376.5 cSt
Sulphur Content: 0.42 % m/m
Water Content: 0.15 % v/v
Flash Point: 68.0 deg C
Sample Seal No.: SEAL-99887
Unit Price: 612.50 USD per MT`,
  {
    docNo: "SG-2026-004471",
    receivedAt: "2026-08-20",
    port: "SINGAPORE",
    supplier: "OCEAN BUNKER PTE LTD",
    barge: "MT SEA SUPPLIER 7",
    productName: "VLSFO RMG 380",
    quantity: 450.25,
    uom: "MT",
    density: 985.2,
    viscosity: 376.5,
    sulphur: 0.42,
    waterContent: 0.15,
    flashPoint: 68,
    sampleSealNo: "SEAL-99887",
    unitPrice: 612.5,
    currency: "USD",
  }
);

console.log("\n=== KHONG CO DAU HAI CHAM (bang ke cot) ===");
kiem(
  "Nhan va gia tri cach nhau bang khoang trang",
  `Delivery Date 05/03/2026
Port of Delivery ROTTERDAM
Quantity Delivered 120.5 MT
Density at 15 deg C 991.3
Sulphur Content 0.09 % m/m`,
  {
    receivedAt: "2026-03-05",
    port: "ROTTERDAM",
    quantity: 120.5,
    density: 991.3,
    sulphur: 0.09,
  }
);

console.log("\n=== DAU PHAY THAP PHAN (chung tu chau Au) ===");
kiem(
  "450,250 MT va 985,2 kg/m3",
  `BDN No: NL-77120
Date of Delivery: 01/02/2026
Quantity Delivered: 450,250 MT
Density at 15 deg C: 985,2 kg/m3
Sulphur Content: 0,08 % m/m`,
  { quantity: 450.25, density: 985.2, sulphur: 0.08, receivedAt: "2026-02-01" }
);

console.log("\n=== PHIEU GIAO DAU NHON / HOA CHAT ===");
kiem(
  "Phieu giao co TBN va han dung",
  `DELIVERY RECEIPT NO: INV-2026-8891
Delivery Date: 12/07/2026
Supplier: SHELL MARINE
Product Grade: Alexia 40 Cylinder Oil
Quantity Delivered: 4 DRUM
TBN: 40.0
Expiry Date: 12/07/2028`,
  {
    docNo: "INV-2026-8891",
    receivedAt: "2026-07-12",
    supplier: "SHELL MARINE",
    productName: "Alexia 40 Cylinder Oil",
    quantity: 4,
    uom: "DRUM",
    bnValue: 40,
    expiryDate: "2028-07-12",
  }
);

console.log("\n=== NHAN TIENG VIET ===");
kiem(
  "Phieu tieng Viet",
  `PHIEU GIAO HANG
Số phiếu: PG-2026-0031
Ngày giao: 15/06/2026
Cảng: HAI PHONG
Nhà cung cấp: CONG TY HOA CHAT BIEN
Mặt hàng: Hoa chat xu ly noi hoi
Số lượng: 20 CAN
Hạn dùng: 15/06/2028`,
  {
    docNo: "PG-2026-0031",
    receivedAt: "2026-06-15",
    port: "HAI PHONG",
    supplier: "CONG TY HOA CHAT BIEN",
    quantity: 20,
    uom: "CAN",
    expiryDate: "2028-06-15",
  }
);

console.log("\n=== KHONG DOAN BUA KHI KHONG DOC DUOC ===");
kiem(
  "Chu vo nghia (ban scan mo) -> de trong het",
  `O
00
o:
--- TRANG 1 ---`,
  {
    docNo: null,
    quantity: null,
    sulphur: null,
    receivedAt: null,
    daDoc: [],
  }
);

kiem(
  "Ngay sai dinh dang (thang 13) -> de trong con hon doan sai",
  `BDN No.: X-1
Date of Delivery: 20/13/2026`,
  { docNo: "X-1", receivedAt: null }
);

console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
process.exit(truot ? 1 : 0);
