/**
 * Kiểm tra ma trận phân quyền duyệt yêu cầu vật tư.
 *
 * Chạy:  kiem-tra-phan-quyen.cmd
 *
 * Gọi ĐÚNG hàm mà server action và giao diện đang dùng (capDuyetChoPhep,
 * REQUEST_ALLOWED_FROM), không viết lại logic — nếu viết lại thì bài kiểm tra
 * chỉ chứng minh bản sao chép đúng với chính nó.
 *
 * Kỳ vọng ở hàm mongDoi() được viết TAY theo quy định phân cấp, cố ý không suy
 * ra từ hàm đang kiểm tra.
 *
 * Không đụng vào database nên chạy lúc nào cũng được, kể cả khi app đang chạy.
 */
import { REQUEST_ALLOWED_FROM } from "@/lib/requestStatus";
import {
  capDuyetChoPhep,
  coDuyetCapTau,
  nguoiDuyetCapTau,
} from "@/lib/roles";

type KetQua = "TAU" | "CONG_TY" | null;

const VAI_TRO = [
  "CREW",
  "CHIEF_ENGINEER",
  "MASTER",
  "TECH_MANAGER",
  "ADMIN",
] as const;
const BO_PHAN = ["ENGINE", "ELECTRICAL", "DECK", "GENERAL"] as const;
const TRANG_THAI = [
  "DRAFT",
  "PENDING_MASTER",
  "PENDING_OFFICE",
  "APPROVED",
  "REJECTED",
] as const;

let dat = 0;
let truot = 0;

function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) {
    dat++;
  } else {
    truot++;
    console.log(`  TRUOT ${ten}: duoc ${JSON.stringify(thuc)}, mong doi ${JSON.stringify(mong)}`);
  }
}

// Kỳ vọng viết TAY, không suy ra từ chính hàm đang kiểm tra.
function mongDoi(
  vaiTro: string,
  boPhan: string,
  trangThai: string,
  cungTau: boolean
): KetQua {
  const boPhanMay = boPhan === "ENGINE" || boPhan === "ELECTRICAL";
  if (trangThai === "PENDING_MASTER") {
    if (!cungTau && vaiTro !== "ADMIN" && vaiTro !== "TECH_MANAGER") return null;
    if (vaiTro === "ADMIN" || vaiTro === "MASTER") return "TAU";
    if (vaiTro === "CHIEF_ENGINEER" && boPhanMay) return "TAU";
    return null;
  }
  if (trangThai === "PENDING_OFFICE") {
    return vaiTro === "ADMIN" || vaiTro === "TECH_MANAGER" ? "CONG_TY" : null;
  }
  return null;
}

console.log("=== MA TRAN PHAN QUYEN DUYET ===\n");

for (const vaiTro of VAI_TRO) {
  for (const boPhan of BO_PHAN) {
    for (const trangThai of TRANG_THAI) {
      for (const cungTau of [true, false]) {
        // Người dùng gắn tàu 1; yêu cầu thuộc tàu 1 hoặc tàu 2.
        const user = { role: vaiTro, vesselId: cungTau ? 1 : 1 };
        const request = {
          vesselId: cungTau ? 1 : 2,
          status: trangThai,
          department: boPhan,
        };
        // ADMIN / TECH_MANAGER là vai trò văn phòng: không gán tàu.
        if (vaiTro === "ADMIN" || vaiTro === "TECH_MANAGER") {
          user.vesselId = null as unknown as number;
        }
        const thuc = capDuyetChoPhep(user, request);
        kiemTra(
          `${vaiTro}/${boPhan}/${trangThai}/${cungTau ? "cung tau" : "tau khac"}`,
          thuc,
          mongDoi(vaiTro, boPhan, trangThai, cungTau)
        );
      }
    }
  }
}

console.log(`\nMa tran: ${dat} dat / ${truot} truot (tong ${dat + truot})\n`);

// --- Vài điểm then chốt, viết rõ ra để đọc log là thấy ---
console.log("=== DIEM THEN CHOT ===");
const truong = { role: "MASTER", vesselId: 1 };
const mayTruong = { role: "CHIEF_ENGINEER", vesselId: 1 };
const siQuan = { role: "CREW", vesselId: 1 };
const kyThuat = { role: "TECH_MANAGER", vesselId: null };
const yeuCauMay = { vesselId: 1, status: "PENDING_MASTER", department: "ENGINE" };
const yeuCauBoong = { vesselId: 1, status: "PENDING_MASTER", department: "DECK" };
const choCongTy = { vesselId: 1, status: "PENDING_OFFICE", department: "ENGINE" };

const diem: [string, unknown, unknown][] = [
  ["Si quan KHONG duyet duoc", capDuyetChoPhep(siQuan, yeuCauMay), null],
  ["May truong duyet y/c buong may", capDuyetChoPhep(mayTruong, yeuCauMay), "TAU"],
  ["May truong KHONG duyet y/c boong", capDuyetChoPhep(mayTruong, yeuCauBoong), null],
  ["Thuyen truong duyet y/c boong", capDuyetChoPhep(truong, yeuCauBoong), "TAU"],
  ["Thuyen truong duyet ca y/c buong may", capDuyetChoPhep(truong, yeuCauMay), "TAU"],
  ["Ky thuat cong ty KHONG duyet buoc tau", capDuyetChoPhep(kyThuat, yeuCauMay), null],
  ["Ky thuat cong ty duyet buoc cong ty", capDuyetChoPhep(kyThuat, choCongTy), "CONG_TY"],
  ["Thuyen truong KHONG duyet buoc cong ty", capDuyetChoPhep(truong, choCongTy), null],
  ["May truong KHONG duyet buoc cong ty", capDuyetChoPhep(mayTruong, choCongTy), null],
  [
    "Thuyen truong tau khac KHONG duyet",
    capDuyetChoPhep({ role: "MASTER", vesselId: 9 }, yeuCauMay),
    null,
  ],
];
for (const [ten, thuc, mong] of diem) {
  const ok = JSON.stringify(thuc) === JSON.stringify(mong);
  if (ok) dat++;
  else truot++;
  console.log(`  ${ok ? "OK  " : "TRUOT"} ${ten} -> ${JSON.stringify(thuc)}`);
}

// --- Duong di trang thai ---
console.log("\n=== DUONG DI TRANG THAI ===");
const duong: [string, string, boolean][] = [
  ["DRAFT", "PENDING_MASTER", true],
  ["PENDING_MASTER", "PENDING_OFFICE", true],
  ["PENDING_OFFICE", "APPROVED", true],
  ["APPROVED", "IN_PROCUREMENT", true],
  ["REJECTED", "PENDING_MASTER", true],
  ["PENDING_MASTER", "REJECTED", true],
  ["PENDING_OFFICE", "REJECTED", true],
  // Khong duoc phep: nhay coc buoc duyet cong ty
  ["PENDING_MASTER", "APPROVED", false],
  ["DRAFT", "APPROVED", false],
  ["DRAFT", "PENDING_OFFICE", false],
  ["APPROVED", "PENDING_OFFICE", false],
];
for (const [tu, den, choPhep] of duong) {
  const thuc = (REQUEST_ALLOWED_FROM[den] ?? []).includes(tu);
  const ok = thuc === choPhep;
  if (ok) dat++;
  else truot++;
  console.log(
    `  ${ok ? "OK  " : "TRUOT"} ${tu} -> ${den}: ${thuc ? "cho phep" : "chan"} (mong doi ${choPhep ? "cho phep" : "chan"})`
  );
}

// --- Nguoi chiu trach nhiem theo bo phan ---
console.log("\n=== NGUOI DUYET THEO BO PHAN ===");
for (const bp of BO_PHAN) {
  console.log(
    `  ${bp.padEnd(12)} -> ${nguoiDuyetCapTau(bp)}   (may truong duyet duoc: ${coDuyetCapTau("CHIEF_ENGINEER", bp)})`
  );
}

console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
process.exit(truot ? 1 : 0);
