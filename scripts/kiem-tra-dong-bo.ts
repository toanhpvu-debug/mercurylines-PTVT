/**
 * Kiểm tra gói đồng bộ có bỏ sót bảng nào không.
 *
 * Chạy:  kiem-tra-dong-bo.cmd
 *
 * Vì sao cần bài kiểm tra này: mỗi module mới (sơn, chằng buộc, dầu · dầu nhờn
 * · hóa chất...) thêm vài bảng vào schema, mà danh sách bảng đồng bộ thì nằm ở
 * lib/sync.ts. Quên thêm vào đó thì app vẫn chạy, giao diện vẫn đủ, chỉ có điều
 * dữ liệu tàu ghi khi mất mạng KHÔNG BAO GIỜ về tới văn phòng — hỏng âm thầm,
 * không có thông báo lỗi nào, và chỉ lộ ra khi người ta đi tìm số liệu đã mất.
 *
 * Nguồn đối chiếu là chính schema Prisma (Prisma.dmmf), không phải một danh
 * sách chép tay: thêm model mới vào schema là bài kiểm tra này trượt ngay cho
 * tới khi model đó được xếp vào một nhóm.
 *
 * Không đụng vào database nên chạy lúc nào cũng được, kể cả khi app đang chạy.
 */
import { Prisma } from "@prisma/client";

import {
  BANG_CON,
  BANG_CUA_TAU,
  BANG_DUNG_CHUNG,
  BANG_KHONG_DONG_BO,
  TEN_BANG_DB,
} from "@/lib/sync";

const MODEL = Prisma.dmmf.datamodel.models;
const theoTen = new Map(MODEL.map((m) => [m.name, m]));

let dat = 0;
let truot = 0;

function kiemTra(ten: string, ok: boolean, chiTiet = "") {
  if (ok) {
    dat++;
  } else {
    truot++;
    console.log(`  TRUOT ${ten}${chiTiet ? ": " + chiTiet : ""}`);
  }
}

function coCot(model: string, cot: string): boolean {
  return !!theoTen.get(model)?.fields.some((f) => f.name === cot);
}

/** Khóa ngoại của một model: [tên cột, model đích]. */
function khoaNgoai(model: string): { cot: string; dich: string }[] {
  const m = theoTen.get(model);
  if (!m) return [];
  const kq: { cot: string; dich: string }[] = [];
  for (const f of m.fields) {
    if (f.kind !== "object") continue;
    for (const cot of f.relationFromFields ?? []) {
      kq.push({ cot, dich: f.type });
    }
  }
  return kq;
}

// Thứ tự thật lúc nhập gói của tàu: danh mục → bảng của tàu → bảng con.
const THU_TU = [
  ...BANG_DUNG_CHUNG.map((x) => x.ten),
  ...BANG_CUA_TAU.map((x) => x.ten),
  ...BANG_CON.map((x) => x.ten),
];
const viTri = new Map(THU_TU.map((ten, i) => [TEN_BANG_DB[ten], i]));

console.log("=== KIEM TRA GOI DONG BO ===\n");

// 1. Mọi model trong schema phải được xếp nhóm — đây là cái bẫy bắt module mới.
console.log("1. Moi bang trong schema deu duoc xep nhom");
const daXep = new Set<string>([
  ...THU_TU.map((ten) => TEN_BANG_DB[ten]).filter(Boolean),
  ...BANG_KHONG_DONG_BO,
]);
for (const m of MODEL) {
  kiemTra(
    m.name,
    daXep.has(m.name),
    "chua co trong lib/sync.ts — them vao BANG_CUA_TAU / BANG_CON / " +
      "BANG_DUNG_CHUNG, hoac BANG_KHONG_DONG_BO neu co y khong dong bo"
  );
}
console.log(`   ${MODEL.length} bang trong schema, ${daXep.size} bang da xep.\n`);

// 2. Bảng nào có cột vesselId thì phải đi lên văn phòng — đó là dữ liệu của tàu.
console.log("2. Bang co cot vesselId deu nam trong BANG_CUA_TAU");
const tenBangCuaTau = new Set(BANG_CUA_TAU.map((x) => TEN_BANG_DB[x.ten]));
const boQua = new Set<string>(BANG_KHONG_DONG_BO);
for (const m of MODEL) {
  if (!m.fields.some((f) => f.name === "vesselId")) continue;
  if (boQua.has(m.name)) continue;
  kiemTra(
    m.name,
    tenBangCuaTau.has(m.name),
    "gan voi mot tau nhung khong duoc xuat len van phong"
  );
}
console.log("");

// 3. Tên bảng trong TEN_BANG_DB phải đúng tên model, và cột mốc phải có thật.
console.log("3. Ten bang va cot moc khop voi schema");
for (const { ten, moc } of [...BANG_CUA_TAU, ...BANG_DUNG_CHUNG]) {
  const db = TEN_BANG_DB[ten];
  kiemTra(`${ten} -> ten bang`, !!db && theoTen.has(db), `khong thay model "${db}"`);
  if (db && theoTen.has(db)) {
    kiemTra(`${ten}.${moc}`, coCot(db, moc), "khong co cot moc nay");
  }
}
for (const { ten } of BANG_CUA_TAU) {
  const db = TEN_BANG_DB[ten];
  if (db && theoTen.has(db)) {
    kiemTra(`${ten}.vesselId`, coCot(db, "vesselId"), "loc theo vesselId se hong");
  }
}
console.log("");

// 4. Bảng con phải trỏ đúng cột về bảng cha đã khai.
console.log("4. Bang con tro dung ve bang cha");
for (const { ten, cha, khoa } of BANG_CON) {
  const db = TEN_BANG_DB[ten];
  const dbCha = TEN_BANG_DB[cha];
  kiemTra(`${ten} -> ten bang`, !!db && theoTen.has(db), `khong thay model "${db}"`);
  if (!db || !theoTen.has(db)) continue;
  kiemTra(`${ten}.${khoa}`, coCot(db, khoa), "khong co cot nay");
  const fk = khoaNgoai(db).find((k) => k.cot === khoa);
  kiemTra(
    `${ten}.${khoa} -> ${cha}`,
    !!fk && fk.dich === dbCha,
    `cot "${khoa}" tro toi ${fk?.dich ?? "khong dau"}, khong phai ${dbCha}`
  );
}
console.log("");

// 5. Thứ tự nhập phải tôn trọng khóa ngoại: bảng cha nhập trước bảng con.
//    Sai thứ tự thì bản ghi con bị từ chối vì cha chưa có.
console.log("5. Thu tu nhap ton trong khoa ngoai");
for (const [db, i] of viTri) {
  for (const { cot, dich } of khoaNgoai(db)) {
    if (dich === db) continue; // tự trỏ về chính mình
    const j = viTri.get(dich);
    if (j === undefined) continue; // trỏ tới bảng không đồng bộ (Vessel, User)
    kiemTra(
      `${db}.${cot} -> ${dich}`,
      j < i,
      `${dich} nhap sau ${db} nen ban ghi con bi tu choi`
    );
  }
}
console.log("");

console.log(`=== TONG: ${dat} dat / ${truot} truot ===`);
if (truot) {
  console.log(
    "\nSua lib/sync.ts roi chay lai. Neu mot bang CO Y khong dong bo thi ghi vao\n" +
      "BANG_KHONG_DONG_BO kem ly do — de nguoi sau khong phai doan."
  );
}
process.exit(truot ? 1 : 0);
