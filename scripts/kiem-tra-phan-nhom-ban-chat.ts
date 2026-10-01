/**
 * Kiểm PHÂN NHÓM THEO BẢN CHẤT (lib/phanNhomBanChat.ts) bằng TÊN HÀNG THẬT của
 * danh mục công ty: hàng đi đúng nhóm (Boong · Máy · Điện · Sinh hoạt & Phục vụ ·
 * An toàn chung) và nhóm con công ty; các bẫy từng khớp nhầm khi soát (chổi sơn,
 * mũi khoan, quả ném, băng dính cách điện, giấy nhám, cờ lê ống, chảo teflon...);
 * hàng dùng chung không bị đoán; ghim tay thắng; An toàn chung chỉ giữ hàng an
 * toàn; người giữ theo nhóm con.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-phan-nhom-ban-chat.ts
 */
import { banChatVatTu, nhomCuaVatTu } from "@/lib/phanNhomBanChat";
import { chucDanhChiuTrachNhiem, laNguoiPhuTrach } from "@/lib/chucDanhChiuTrachNhiem";

let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}
const bc = (nameVn: string, impa: string | null = null, nameEn: string | null = null) => {
  const r = banChatVatTu({ nameVn, nameEn, impa, materialType: "STORE" });
  return r ? `${r.nhom}${r.nhomCongTy ? `/${r.nhomCongTy}` : ""}` : null;
};

console.log("\n=== 1) Ban chat theo ten hang that ===");
const CA: [string, string | null, string | null][] = [
  // Hàn cắt → Máy (TOL)
  ["High Pressure gas Cylinder, Oxygen", "85.01.42", "ENGINE/TOL"],
  ["Que hàn điện 4.0mm", null, "ENGINE/TOL"],
  ["Mỏ cắt gió đá", null, "ENGINE/TOL"],
  ["Welders' Gloves", null, "ENGINE/TOL"],
  ["Mặt nạ hàn", null, "ENGINE/TOL"],
  ["Dây hàn điện", "794103", "ENGINE/TOL"],
  ["gas cutting tip", null, "ENGINE/TOL"],
  ["Bép cắt hơi", "850262", "ENGINE/TOL"],
  // An toàn
  ["Phao áo / Life jacket", "370100", "SAFETY/LSA"],
  ["Cầu thang thoát nạn xuồng cứu sinh", null, "SAFETY/LSA"],
  ["Bình chữa cháy CO2 / CO2 fire extinguisher", "370001", "SAFETY/FFA"],
  ["Máy đo nồng độ khí CO2", null, "SAFETY"],
  ["Gloves, cotton working ordinary", "19.01.01", "SAFETY"],
  ["Ear-plug(Bịt tai chống ồn)", "331250", "SAFETY"],
  ["GĂNG TAY CÁCH ĐIỆN", null, "SAFETY"],
  ["Rubber Boots, size 29 cm", "19.02.05", "SAFETY"],
  ["Dust Mask Disposable", "33.11.28", "SAFETY"],
  // Điện
  ["Power socket with cable", null, "ELEC/ELS"],
  ["Băng dính điện", null, "ELEC/ELS"],
  ["BĂNG DÍNH CÁCH ĐIỆN ĐỎ", null, "ELEC/ELS"],
  ["Dry battery 12v-200Ah", "232501", "ELEC/BAT"],
  ["Đèn pin nhỏ đội đầu", null, "ELEC/LIT"],
  ["Headlamp", null, "ELEC/LIT"],
  ["electrical wire", null, "ELEC/ELS"],
  // Sinh hoạt & Phục vụ
  ["Cây gạt nước", "174292", "SERVICE/CLN"],
  ["Gầu hót rác", "174141", "SERVICE/CLN"],
  ["Garbage bag (Túi đựng rác 90 x 130 cm)", "174175", "SERVICE/CLN"],
  ["Washing powder (Xà phòng vệ sinh)", "550103", "SERVICE/CLN"],
  ["Potato peelers, handle wood", "17.23.63", "SERVICE/UTN"],
  ["Frying pan, Teflon coated", "17.17.33", "SERVICE/UTN"],
  ["Dishwasher", null, "SERVICE/GAL"],
  // Boong
  ["Cầu thang hoa tiêu 6m", null, "DECK/DST"],
  ["Bóng neo", null, "DECK/DST"],
  ["Cát, xi măng", null, "DECK/DST"],
  ["Chổi quét boong", null, "DECK/DST"],
  ["Nylon Deck Brush, head only", "51.06.12", "DECK/DST"],
  ["Chổi sơn nhỏ", null, "DECK/PNT"],
  ["Flat Paint Brush, W 25mm", "51.06.61", "DECK/PNT"],
  ["Mani 2T", null, "DECK/MOR"],
  ["Chắn chuột", null, "DECK/MOR"],
  ["Grease, wire rope", "45.00.00", "DECK/MOR"],
  ["Khóa kho", null, "DECK/DST"],
  ["Mùn cưa", null, "DECK/DST"],
  ["Cờ bản nhỏ", null, "DECK/DST"],
  ["VHF(Bộ đàm)", null, "DECK/COM"],
  ["White Board (Bảng trắng 600 x 900 mm)", "471631", "DECK/DOC"],
  ["A4 Pocket Multi-Punched (Túi đục lỗ A4)", "470397", "DECK/DOC"],
  // Máy: vật tư chỉ dùng cho máy móc
  ["Keo dán Gioăng", null, "ENGINE/TOL"],
  ["Lamella blankets (Bọc cách nhiệt)", "813994", "ENGINE/TOL"],
  ["Globe valve(Van cầu DN25)", "75.00.00", "ENGINE/TOL"],
  ["Gas R-407C, (10.9kg/chai)", null, "ENGINE/REF"],
  // Hàng DÙNG CHUNG hoặc bẫy từng khớp nhầm → không đoán (null)
  ["Mũi khoan", null, null],
  ["Quả ném", null, null],
  ["Coarse sand paper 180#", "614758", null],
  ["Socket wrench set, 8-32mm", "61.01.26", null],
  ["Pipe Wrench, Straight heavy duty", "61.13.04", null],
  ["Hose Bands, Stainless Steel", "61.40.00", null],
  ["Bucket, Gavanized", "17.41.29", null],
  ["Adjustable Wrench, Heavy Duty", "61.13.33", null],
  ["Thước mét rút", null, null],
  ["Giẻ lau", null, null],
  ["Angle Radiator Brush, W 25mm", "51.06.00", null],
  ["Grease general purpose", null, null],
];
for (const [ten, impa, mong] of CA) kiemTra(ten, bc(ten, impa), mong);
kiemTra("phu tung khong qua day", banChatVatTu({ nameVn: "Gasket", materialType: "SPARE" }), null);

console.log("\n=== 2) Nhom hien thi ===");
const thuocRut = { nameVn: "Thước mét rút", materialType: "STORE", code: "D-IMPA-0431", categoryName: "Vật tư bảo hộ & an toàn" };
kiemTra("An toan chung chi giu hang an toan: thuoc rut ve Boong theo ma", nhomCuaVatTu(thuocRut).nhom, "DECK");
kiemTra("hang an toan that van o An toan", nhomCuaVatTu({ ...thuocRut, nameVn: "Kính bảo hộ" }).nhom, "SAFETY");
kiemTra("ghim tay thang", nhomCuaVatTu({ ...thuocRut, nhomQuanLy: "SAFETY" }), {
  nhom: "SAFETY",
  banChat: null,
  nguon: "ghim",
  nhomCu: "SAFETY",
});
kiemTra("ghim gia tri la bi bo qua", nhomCuaVatTu({ ...thuocRut, nhomQuanLy: "XYZ" }).nguon, "cu");
const oxy = nhomCuaVatTu({ nameVn: "High Pressure gas Cylinder, Oxygen", impa: "85.01.42", materialType: "STORE", code: "D-IMPA-0055", categoryName: "Boong (Deck)" });
kiemTra("chuyen nhom: Boong -> May, ghi nhom cu", [oxy.nhom, oxy.nhomCu, oxy.nguon], ["ENGINE", "DECK", "ban-chat"]);
kiemTra("phu tung theo thiet bi nhu cu", nhomCuaVatTu({ nameVn: "Piston ring", materialType: "SPARE", code: "E-SPR-0003", categoryName: "Main Engine" }).nhom, "ENGINE");
kiemTra("khong luat, khong an toan -> nhom cu", nhomCuaVatTu({ nameVn: "Adjustable Wrench", impa: "61.13.33", materialType: "STORE", code: "D-IMPA-0001", categoryName: "Boong (Deck)" }).nhom, "DECK");

console.log("\n=== 3) Nguoi giu theo nhom con ===");
const giu = (nameVn: string, code: string, categoryName: string, impa: string | null = null) => chucDanhChiuTrachNhiem({ nameVn, code, categoryName, impa, materialType: "STORE" });
kiemTra("phao ao -> Pho ba", giu("Phao áo / Life jacket", "D-IMPA-0302", "Vật tư bảo hộ & an toàn"), { chucDanh: "3O", nguon: "ban-chat" });
kiemTra("binh chua chay -> Pho ba", giu("Bình chữa cháy CO2", "D-IMPA-0301", "Vật tư bảo hộ & an toàn"), { chucDanh: "3O", nguon: "ban-chat" });
kiemTra("binh oxy han -> May truong", giu("High Pressure gas Cylinder, Oxygen", "D-IMPA-0055", "Boong (Deck)", "85.01.42"), { chucDanh: "CE", nguon: "ban-chat" });
kiemTra("tui rac kho may -> Phuc vu vien", giu("Garbage bag", "E-IMPA-0114", "Engine Stores"), { chucDanh: "STW", nguon: "ban-chat" });
// Sheet "Engine Stores" có mã Category riêng → trước đây luôn ra Máy trưởng, kể cả món đã chuyển nhóm.
const giuCat = (nameVn: string, code: string, impa: string | null = null) =>
  chucDanhChiuTrachNhiem({ nameVn, code, impa, categoryName: "Engine Stores", categoryCode: "CAT-engine-stores", materialType: "STORE" });
kiemTra("tui rac trong sheet Engine Stores -> Phuc vu vien", giuCat("Garbage bag", "E-IMPA-0114"), { chucDanh: "STW", nguon: "ban-chat" });
kiemTra("bang trang trong sheet Engine Stores -> Pho hai", giuCat("White Board", "E-IMPA-0136", "471631"), { chucDanh: "2O", nguon: "ban-chat" });
kiemTra("vat tu may khong chuyen -> van May truong", giuCat("Bolt and nut M8*75", "E-IMPA-0004"), { chucDanh: "CE", nguon: "thiet-bi" });
kiemTra("bat an -> Bep truong", giu("Bowl, soup", "C-IMPA-0011", "Phục vụ (Catering)"), { chucDanh: "CCK", nguon: "ban-chat" });
kiemTra("gang tay kho may -> May truong cap", giu("Work safety gloves", "E-IMPA-0024", "Engine Stores", "190104"), { chucDanh: "CE", nguon: "bo-phan" });
kiemTra("gang tay kho boong -> Thuy thu truong", giu("Gloves, cotton", "D-IMPA-0037", "Boong (Deck)", "19.01.01"), { chucDanh: "BSN", nguon: "bo-phan" });
kiemTra("gang cach dien kho dien -> Tho dien", giu("GĂNG TAY CÁCH ĐIỆN", "L-IMPA-0117", "Electrical Stores"), { chucDanh: "ELC", nguon: "bo-phan" });
kiemTra("bong den -> Tho dien", giu("Led lamp E27", "L-IMPA-0007", "Electrical Stores", "79.00.00"), { chucDanh: "ELC", nguon: "ban-chat" });
kiemTra("VHF -> Pho hai", giu("VHF(Bộ đàm)", "E-IMPA-0135", "Engine Stores"), { chucDanh: "2O", nguon: "ban-chat" });
kiemTra("dai pho bao trum Pho ba (cuu sinh)", laNguoiPhuTrach("CO", { nameVn: "Phao áo", code: "D-IMPA-0302", categoryName: "Vật tư bảo hộ & an toàn", materialType: "STORE" }), true);
kiemTra("thuyen truong bao trum ca Phuc vu vien", laNguoiPhuTrach("MST", { nameVn: "Garbage bag", code: "E-IMPA-0114", categoryName: "Engine Stores", materialType: "STORE" }), true);
kiemTra("bep truong bao trum Phuc vu vien", laNguoiPhuTrach("CCK", { nameVn: "Garbage bag", code: "E-IMPA-0114", categoryName: "Engine Stores", materialType: "STORE" }), true);

console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
if (truot) process.exit(1);
