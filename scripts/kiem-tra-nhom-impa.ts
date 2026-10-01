/**
 * Kiểm NHÓM CON THEO CHƯƠNG IMPA (lib/nhomImpa.ts) và luật người giữ theo nhóm
 * IMPA (lib/chucDanhChiuTrachNhiem.ts): văn phòng phẩm / thiết bị hàng hải / tủ
 * thuốc thuộc Boong do Phó hai giữ (bộ phân loại công ty), dụng cụ boong khác
 * vẫn Thủy thủ trưởng; đã gán tay thì giữ nguyên; thuyền trưởng bao trùm Phó hai.
 * Kèm: mọi chương có tên ở cả hai ngôn ngữ, tên bộ phận mới.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-nhom-impa.ts
 */
import { CHUONG_IMPA, NHOM_THEO_CHUONG, chuongImpa, laTenBoPhan } from "@/lib/nhomImpa";
import { chucDanhChiuTrachNhiem, laNguoiPhuTrach } from "@/lib/chucDanhChiuTrachNhiem";
import { NHOM_THIET_BI } from "@/lib/maVatTu";
import { TU_DIEN } from "@/lib/i18n/tuDien";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}

console.log("\n=== 1) Chuong IMPA ===");
kiemTra(
  "doc chuong",
  ["61.13.33", "470397", "IMPA 190405", "51.08", "12", "999999", "", null, "1234567"].map((x) => chuongImpa(x)),
  ["61", "47", "19", "51", null, null, null, null, null]
);
kiemTra("chuong co nhom rieng", NHOM_THEO_CHUONG, { "37": "NAV", "39": "MED", "47": "DOC" });
kiemTra("nhom rieng deu thuoc Boong, Pho hai giu", Object.values(NHOM_THEO_CHUONG).map((k) => [NHOM_THIET_BI[k!]?.boPhan, NHOM_THIET_BI[k!]?.chucDanh[0]]), [["D", "2O"], ["D", "2O"], ["D", "2O"]]);
const vi = TU_DIEN.labels.vi as Record<string, string>;
const en = TU_DIEN.labels.en as Record<string, string>;
kiemTra("moi chuong co ten VI + EN", CHUONG_IMPA.filter((c) => !vi[`impaChuong_${c}`] || !en[`impaChuong_${c}`]), []);
kiemTra("ten mau", [vi.impaChuong_61, vi.impaChuong_47, en.impaChuong_31], ["Dụng cụ cầm tay (Hand tools)", "Văn phòng phẩm (Stationery)", "Safety protective gear (PPE)"]);
kiemTra("ten bo phan moi", [vi.dept_SERVICE, vi.dept_SAFETY, en.dept_SERVICE, en.dept_SAFETY], ["Sinh hoạt & Phục vụ (Cabin/Galley)", "An toàn chung (Safety)", "Cabin & Galley", "General safety"]);

console.log("\n=== 2) Ten nhom chi la ten bo phan ===");
kiemTra(
  "la ten bo phan",
  [
    "Boong (Deck)", "Máy (Engine)", "Phục vụ / Tiêu hao (Service)", "DECK STORES", "an toàn", "", null,
    // Tên nhóm có thật trong danh mục công ty:
    "Vật tư Boong", "Vật tư máy", "Vật tư điện", "Vật tư tiêu hao", "ENGINE STORE", "ELECTRIC STORE", "Electrical Stores",
    "Engine Stores", "Phục vụ (Catering)", "Vật tư nhà bếp & phục vụ", "Vật tư bảo hộ & an toàn",
  ].map((x) => laTenBoPhan(x)),
  Array(18).fill(true)
);
kiemTra(
  "nhom that su",
  ["Hệ thống đèn hàng hải", "MAIN ENGINE", "Hand tools", "Lashing", "Oil Separator", "Thiết bị an toàn", "LIFEBOAT 380J-3 ENGINE"].map((x) => laTenBoPhan(x)),
  [false, false, false, false, false, false, false]
);

console.log("\n=== 3) Nguoi giu theo nhom IMPA ===");
const boong = { materialType: "STORE", department: "D", categoryName: "Boong (Deck)", code: "D-IMPA-0801" };
kiemTra("van phong pham boong -> Pho hai", chucDanhChiuTrachNhiem({ ...boong, impa: "470397" }), { chucDanh: "2O", nguon: "nhom-impa" });
kiemTra("thiet bi hang hai -> Pho hai", chucDanhChiuTrachNhiem({ ...boong, impa: "37.01.11" }), { chucDanh: "2O", nguon: "nhom-impa" });
kiemTra("thuoc -> Pho hai", chucDanhChiuTrachNhiem({ ...boong, impa: "390101" }), { chucDanh: "2O", nguon: "nhom-impa" });
kiemTra("dung cu cam tay boong -> van Thuy thu truong", chucDanhChiuTrachNhiem({ ...boong, impa: "61.13.33" }), { chucDanh: "BSN", nguon: "bo-phan" });
kiemTra("khong IMPA -> theo bo phan", chucDanhChiuTrachNhiem({ ...boong, impa: null }), { chucDanh: "BSN", nguon: "bo-phan" });
kiemTra("van phong pham o kho may -> nguoi kho may", chucDanhChiuTrachNhiem({ materialType: "STORE", department: "E", impa: "470397", code: "E-IMPA-0009" }), { chucDanh: "CE", nguon: "bo-phan" });
kiemTra("da gan tay -> giu nguyen", chucDanhChiuTrachNhiem({ ...boong, impa: "470397", responsibleRank: "CO" }), { chucDanh: "CO", nguon: "gan" });
kiemTra("phu tung co IMPA 47 -> khong ap", chucDanhChiuTrachNhiem({ materialType: "SPARE", department: "D", impa: "470397", code: "D-SPR-0001" })?.nguon, "bo-phan");

console.log("\n=== 4) Loc theo chuc danh ===");
const vpp = { ...boong, impa: "470397" };
kiemTra("Pho hai thay van phong pham", laNguoiPhuTrach("2O", vpp), true);
kiemTra("Thuy thu truong khong con thay", laNguoiPhuTrach("BSN", vpp), false);
kiemTra("Thuyen truong bao trum Pho hai", laNguoiPhuTrach("MST", vpp), true);
kiemTra("Thuyen truong van bao trum kho boong", laNguoiPhuTrach("MST", { ...boong, impa: "61.13.33" }), true);

console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
if (truot) process.exit(1);
