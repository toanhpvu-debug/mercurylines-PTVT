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
  ROLES,
  ROLE_LABEL,
  SI_QUAN,
  boPhanCuaChucDanh,
  capDuyetChiTiet,
  capDuyetChoPhep,
  chonDuocTau,
  trangThaiUyQuyen,
  trongPhamVi,
  coDuyetCapTau,
  coQuanLyNhienLieu,
  coQuanLySon,
  coXinCapNhienLieu,
  nguoiDuyetCapTau,
  trinhThangLenCongTy,
  vesselScope,
} from "@/lib/roles";

type KetQua = "TAU" | "CONG_TY" | null;

// Toàn bộ vai trò trong hệ thống, kể cả các chức danh sĩ quan mới.
const VAI_TRO = ROLES;
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
    // Đại phó, Phó 2/3, Máy 2/3/4, thuyền viên: lập yêu cầu, KHÔNG duyệt.
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

// --- Chuc danh si quan: khong ai duyet duoc, va bo phan mac dinh dung ---
console.log("\n=== CHUC DANH SI QUAN ===");
for (const r of SI_QUAN) {
  const boong = capDuyetChoPhep(
    { role: r, vesselId: 1 },
    { vesselId: 1, status: "PENDING_MASTER", department: "DECK" }
  );
  const may = capDuyetChoPhep(
    { role: r, vesselId: 1 },
    { vesselId: 1, status: "PENDING_MASTER", department: "ENGINE" }
  );
  const congTy = capDuyetChoPhep(
    { role: r, vesselId: 1 },
    { vesselId: 1, status: "PENDING_OFFICE", department: "ENGINE" }
  );
  const ok = boong === null && may === null && congTy === null;
  if (ok) dat++;
  else truot++;
  console.log(
    `  ${ok ? "OK  " : "TRUOT"} ${(ROLE_LABEL[r] ?? r).padEnd(12)} khong duyet duoc buoc nao  | bo phan mac dinh khi lap: ${boPhanCuaChucDanh(r) ?? "(khong doan)"}`
  );
}

// --- Quyen phan SON ---
// Ky vong viet tay: son la viec cua bo phan boong (dai pho la truong bo phan),
// may truong giu phan son buong may; quan tri toan quyen; van phong khong thao
// tac tren tau; si quan cap duoi va thuyen vien khong sua.
console.log("\n=== QUYEN PHAN SON ===");
const MONG_SON: Record<string, boolean> = {
  ADMIN: true,
  MASTER: true,
  CHIEF_OFFICER: true,
  CHIEF_ENGINEER: true,
  TECH_MANAGER: false,
  SECOND_OFFICER: false,
  THIRD_OFFICER: false,
  SECOND_ENGINEER: false,
  THIRD_ENGINEER: false,
  FOURTH_ENGINEER: false,
  CREW: false,
};
for (const r of ROLES) {
  const vanPhong = r === "ADMIN" || r === "TECH_MANAGER";
  const user = { role: r, vesselId: vanPhong ? null : 1 };
  const tauMinh = coQuanLySon(user, 1);
  const tauKhac = coQuanLySon(user, 2);
  // Nguoi gan tau khong duoc dung sang tau khac; van phong thi toan doi.
  const mongTauMinh = MONG_SON[r];
  const mongTauKhac = MONG_SON[r] && vanPhong;
  const ok = tauMinh === mongTauMinh && tauKhac === mongTauKhac;
  if (ok) dat++;
  else truot++;
  console.log(
    `  ${ok ? "OK  " : "TRUOT"} ${(ROLE_LABEL[r] ?? r).padEnd(26)} tau minh: ${tauMinh ? "co" : "khong"}   tau khac: ${tauKhac ? "co" : "khong"}`
  );
}

// --- Quyen DAU / DAU NHON / HOA CHAT ---
// Ky vong viet tay: dau dot va dau nhon la viec buong may (may truong), dai pho
// khong dung vao. Hoa chat thi ca hai bo phan cung dung nen quyen rong hon mot
// bac. Van phong (TECH_MANAGER) xem chu khong thao tac tren tau.
console.log("\n=== QUYEN DAU / DAU NHON / HOA CHAT ===");
const MONG_NL: Record<string, [boolean, boolean, boolean]> = {
  // [FUEL, LUBE, CHEMICAL]
  ADMIN: [true, true, true],
  MASTER: [true, true, true],
  CHIEF_ENGINEER: [true, true, true],
  CHIEF_OFFICER: [false, false, true],
  TECH_MANAGER: [false, false, false],
  SECOND_OFFICER: [false, false, false],
  THIRD_OFFICER: [false, false, false],
  SECOND_ENGINEER: [false, false, false],
  THIRD_ENGINEER: [false, false, false],
  FOURTH_ENGINEER: [false, false, false],
  CREW: [false, false, false],
};
for (const r of ROLES) {
  const vanPhong = r === "ADMIN" || r === "TECH_MANAGER";
  const user = { role: r, vesselId: vanPhong ? null : 1 };
  const thuc: [boolean, boolean, boolean] = [
    coQuanLyNhienLieu(user, 1, "FUEL"),
    coQuanLyNhienLieu(user, 1, "LUBE"),
    coQuanLyNhienLieu(user, 1, "CHEMICAL"),
  ];
  const mong = MONG_NL[r];
  // Nguoi gan tau khong duoc dung sang tau khac.
  const tauKhac = coQuanLyNhienLieu(user, 2, "CHEMICAL");
  const mongTauKhac = mong[2] && vanPhong;
  const ok =
    thuc[0] === mong[0] &&
    thuc[1] === mong[1] &&
    thuc[2] === mong[2] &&
    tauKhac === mongTauKhac;
  if (ok) dat++;
  else truot++;
  const danh = (b: boolean) => (b ? "co   " : "khong");
  console.log(
    `  ${ok ? "OK  " : "TRUOT"} ${(ROLE_LABEL[r] ?? r).padEnd(26)} dau ${danh(thuc[0])} nhon ${danh(thuc[1])} hoa chat ${danh(thuc[2])} | tau khac ${danh(tauKhac)}`
  );
}

// --- CHAN TU DUYET YEU CAU CUA CHINH MINH ---
// May truong quan toan bo dau/nhon/hoa chat cua tau nhung khi chinh ong ay xin
// cap thi chu ky duyet phai la nguoi khac. Yeu cau cua May 2/3/4 thi may truong
// duyet; yeu cau cua may truong thi thuyen truong duyet.
console.log("\n=== CHAN TU DUYET ===");
const MAY_TRUONG = { id: 10, role: "CHIEF_ENGINEER", vesselId: 1 };
const THUYEN_TRUONG = { id: 11, role: "MASTER", vesselId: 1 };
const MAY_HAI = { id: 12, role: "SECOND_ENGINEER", vesselId: 1 };
const yc = (nguoiLap: number, boPhan = "ENGINE") => ({
  vesselId: 1,
  status: "PENDING_MASTER",
  department: boPhan,
  requestedById: nguoiLap,
});

const caTuDuyet: [string, unknown, unknown][] = [
  [
    "May truong duyet y/c cua May 2",
    capDuyetChoPhep(MAY_TRUONG, yc(MAY_HAI.id)),
    "TAU",
  ],
  [
    "May truong KHONG tu duyet y/c cua chinh minh",
    capDuyetChoPhep(MAY_TRUONG, yc(MAY_TRUONG.id)),
    null,
  ],
  [
    "Thuyen truong duyet y/c cua may truong",
    capDuyetChoPhep(THUYEN_TRUONG, yc(MAY_TRUONG.id)),
    "TAU",
  ],
  [
    "Thuyen truong KHONG tu duyet y/c cua chinh minh",
    capDuyetChoPhep(THUYEN_TRUONG, yc(THUYEN_TRUONG.id, "DECK")),
    null,
  ],
  [
    "May 2 KHONG duyet y/c cua chinh minh",
    capDuyetChoPhep(MAY_HAI, yc(MAY_HAI.id)),
    null,
  ],
  [
    "Yeu cau cu chua co nguoi lap -> van duyet duoc nhu truoc",
    capDuyetChoPhep(MAY_TRUONG, {
      vesselId: 1,
      status: "PENDING_MASTER",
      department: "ENGINE",
      requestedById: null,
    }),
    "TAU",
  ],
  [
    "Buoc cong ty khong dinh dang chan tu duyet",
    capDuyetChoPhep(
      { id: 20, role: "TECH_MANAGER", vesselId: null },
      { vesselId: 1, status: "PENDING_OFFICE", department: "ENGINE", requestedById: 20 }
    ),
    "CONG_TY",
  ],
];
for (const [ten, thuc, mong] of caTuDuyet) {
  const ok = JSON.stringify(thuc) === JSON.stringify(mong);
  if (ok) dat++;
  else truot++;
  console.log(`  ${ok ? "OK  " : "TRUOT"} ${ten} -> ${JSON.stringify(thuc)}`);
}

console.log("\n=== AI TRINH THANG LEN CONG TY ===");
for (const r of ROLES) {
  const thuc = trinhThangLenCongTy(r);
  const mong = r === "MASTER" || r === "ADMIN";
  const ok = thuc === mong;
  if (ok) dat++;
  else truot++;
  console.log(
    `  ${ok ? "OK  " : "TRUOT"} ${(ROLE_LABEL[r] ?? r).padEnd(26)} ${thuc ? "di thang len cong ty" : "qua buoc duyet cap tau"}`
  );
}

// --- QUYEN XIN CAP tach khoi QUYEN GHI ---
// Si quan may truc ca la nguoi biet sap het cai gi nen phai xin cap duoc, nhung
// khong vi the ma duoc ghi phieu bunker hay sua ton. Gop hai quyen lam mot thi
// hoac May 3 ghi duoc BDN, hoac May 3 khong xin duoc dau — ca hai deu sai.
console.log("\n=== XIN CAP vs GHI NGHIEP VU ===");
const MONG_XIN: Record<string, [boolean, boolean, boolean]> = {
  // [FUEL, LUBE, CHEMICAL]
  ADMIN: [true, true, true],
  MASTER: [true, true, true],
  CHIEF_ENGINEER: [true, true, true],
  SECOND_ENGINEER: [true, true, true],
  THIRD_ENGINEER: [true, true, true],
  FOURTH_ENGINEER: [true, true, true],
  CHIEF_OFFICER: [false, false, true],
  TECH_MANAGER: [false, false, false],
  SECOND_OFFICER: [false, false, false],
  THIRD_OFFICER: [false, false, false],
  CREW: [false, false, false],
};
for (const r of ROLES) {
  const vanPhong = r === "ADMIN" || r === "TECH_MANAGER";
  const user = { role: r, vesselId: vanPhong ? null : 1 };
  const xin: [boolean, boolean, boolean] = [
    coXinCapNhienLieu(user, 1, "FUEL"),
    coXinCapNhienLieu(user, 1, "LUBE"),
    coXinCapNhienLieu(user, 1, "CHEMICAL"),
  ];
  const ghi = coQuanLyNhienLieu(user, 1, "FUEL");
  const mong = MONG_XIN[r];
  // Tau khac thi khong dung toi, tru vai tro van phong.
  const tauKhac = coXinCapNhienLieu(user, 2, "FUEL");
  const ok =
    xin[0] === mong[0] &&
    xin[1] === mong[1] &&
    xin[2] === mong[2] &&
    tauKhac === (mong[0] && vanPhong);
  if (ok) dat++;
  else truot++;
  const d = (b: boolean) => (b ? "co   " : "khong");
  console.log(
    `  ${ok ? "OK  " : "TRUOT"} ${(ROLE_LABEL[r] ?? r).padEnd(26)} xin: dau ${d(xin[0])} nhon ${d(xin[1])} hoa chat ${d(xin[2])} | ghi nghiep vu dau: ${d(ghi)}`
  );
}

// Diem quan trong nhat cua lan nay: si quan may XIN duoc nhung KHONG GHI duoc.
const may3 = { role: "THIRD_ENGINEER", vesselId: 1 };
const caMay3: [string, unknown, unknown][] = [
  ["May 3 XIN CAP duoc dau", coXinCapNhienLieu(may3, 1, "FUEL"), true],
  ["May 3 KHONG ghi duoc nghiep vu dau", coQuanLyNhienLieu(may3, 1, "FUEL"), false],
  ["May 3 khong xin duoc cho tau khac", coXinCapNhienLieu(may3, 2, "FUEL"), false],
];
for (const [ten, thuc, mong] of caMay3) {
  const ok = JSON.stringify(thuc) === JSON.stringify(mong);
  if (ok) dat++;
  else truot++;
  console.log(`  ${ok ? "OK  " : "TRUOT"} ${ten} -> ${JSON.stringify(thuc)}`);
}


// ─── Phan cong doi tau cho quan ly ky thuat (FleetAssignment) ────────────────
//
// Quy dinh: khong phan cong tau nao thi van toan doi (giu nguyen cach dung cu);
// co phan cong thi CHI thay va CHI duyet duoc dung nhung tau do.
console.log("\n=== PHAN CONG DOI TAU (quan ly ky thuat) ===");
{
  const toanDoi = { id: 90, role: "TECH_MANAGER", vesselId: null };
  const phanCong = {
    id: 91,
    role: "TECH_MANAGER",
    vesselId: null,
    fleetVesselIds: [1, 2],
  };
  const ycTau = (vesselId: number) => ({
    vesselId,
    status: "PENDING_OFFICE",
    department: "ENGINE",
    requestedById: 5,
  });

  kiemTra("khong phan cong -> toan doi", vesselScope(toanDoi).all, true);
  kiemTra("co phan cong -> khong con toan doi", vesselScope(phanCong).all, false);
  kiemTra(
    "co phan cong -> dung danh sach tau",
    vesselScope(phanCong).vesselIds,
    [1, 2]
  );
  kiemTra("trong pham vi tau 1", trongPhamVi(vesselScope(phanCong), 1), true);
  kiemTra("ngoai pham vi tau 3", trongPhamVi(vesselScope(phanCong), 3), false);
  kiemTra(
    "khong phan cong: duyet duoc tau bat ky",
    capDuyetChoPhep(toanDoi, ycTau(7)),
    "CONG_TY"
  );
  kiemTra(
    "co phan cong: duyet duoc tau cua minh",
    capDuyetChoPhep(phanCong, ycTau(2)),
    "CONG_TY"
  );
  kiemTra(
    "co phan cong: KHONG duyet duoc tau nguoi khac",
    capDuyetChoPhep(phanCong, ycTau(3)),
    null
  );
  kiemTra(
    "quan tri khong bi thu hep boi phan cong",
    vesselScope({ id: 1, role: "ADMIN", vesselId: null, fleetVesselIds: [1] }).all,
    true
  );
  kiemTra("chon duoc tau khi co phan cong", chonDuocTau(vesselScope(phanCong)), true);
  kiemTra(
    "mot tau thi khong co o chon tau",
    chonDuocTau(vesselScope({ id: 3, role: "MASTER", vesselId: 1 })),
    false
  );
}

// ─── Uy quyen co thoi han (Delegation) ──────────────────────────────────────
//
// Nguoi nhan GIU NGUYEN chuc danh cua minh, chi muon them tham quyen cua nguoi
// uy quyen. Hai dieu tuyet doi khong duoc pha: khong tu duyet yeu cau cua minh,
// va khong duyet yeu cau cua CHINH NGUOI DA UY QUYEN.
console.log("\n=== UY QUYEN CO THOI HAN ===");
{
  const uyQuyenTuMayTruong = {
    delegatorId: 10,
    delegatorName: "May truong A",
    delegatorRole: "CHIEF_ENGINEER",
    delegatorVesselId: 1,
  };
  const may2 = { id: 11, role: "SECOND_ENGINEER", vesselId: 1 };
  const may2CoUyQuyen = { ...may2, uyQuyen: [uyQuyenTuMayTruong] };
  const yc = (over: Record<string, unknown> = {}) => ({
    vesselId: 1,
    status: "PENDING_MASTER",
    department: "ENGINE",
    requestedById: 12, // May 3 lap
    ...over,
  });

  kiemTra("May 2 chua co uy quyen: khong duyet", capDuyetChoPhep(may2, yc()), null);
  kiemTra(
    "May 2 co uy quyen: duyet duoc cap tau",
    capDuyetChoPhep(may2CoUyQuyen, yc()),
    "TAU"
  );
  kiemTra(
    "uy quyen duoc ghi nhan dung nguoi",
    capDuyetChiTiet(may2CoUyQuyen, yc()).uyQuyenTu?.delegatorId,
    10
  );
  kiemTra(
    "KHONG duyet yeu cau do chinh minh lap",
    capDuyetChoPhep(may2CoUyQuyen, yc({ requestedById: 11 })),
    null
  );
  kiemTra(
    "KHONG duyet yeu cau cua nguoi da uy quyen",
    capDuyetChoPhep(may2CoUyQuyen, yc({ requestedById: 10 })),
    null
  );
  kiemTra(
    "khong duyet duoc bo phan boong (may truong cung khong)",
    capDuyetChoPhep(may2CoUyQuyen, yc({ department: "DECK" })),
    null
  );
  kiemTra(
    "khong duyet duoc tau khac",
    capDuyetChoPhep(may2CoUyQuyen, yc({ vesselId: 2 })),
    null
  );
  kiemTra(
    "uy quyen mo ca quyen ghi nghiep vu dau",
    coQuanLyNhienLieu(may2CoUyQuyen, 1, "FUEL"),
    true
  );
  kiemTra(
    "khong uy quyen thi van khong ghi duoc dau",
    coQuanLyNhienLieu(may2, 1, "FUEL"),
    false
  );
  kiemTra(
    "uy quyen khong lan sang tau khac",
    coQuanLyNhienLieu(may2CoUyQuyen, 2, "FUEL"),
    false
  );

  // Uy quyen tu quan ly ky thuat co phan cong tau: nguoi nhan chi duyet duoc
  // dung nhung tau cua nguoi kia.
  const nhanTuQuanLy = {
    id: 20,
    role: "CREW",
    vesselId: null,
    uyQuyen: [
      {
        delegatorId: 21,
        delegatorName: "Quan ly B",
        delegatorRole: "TECH_MANAGER",
        delegatorVesselId: null,
        delegatorFleetVesselIds: [4, 5],
      },
    ],
  };
  const ycCongTy = (vesselId: number) => ({
    vesselId,
    status: "PENDING_OFFICE",
    department: "ENGINE",
    requestedById: 30,
  });
  kiemTra(
    "nhan uy quyen quan ly: duyet duoc tau 4",
    capDuyetChoPhep(nhanTuQuanLy, ycCongTy(4)),
    "CONG_TY"
  );
  kiemTra(
    "nhan uy quyen quan ly: khong duyet tau 6",
    capDuyetChoPhep(nhanTuQuanLy, ycCongTy(6)),
    null
  );
}

// ─── Trang thai uy quyen theo thoi gian ─────────────────────────────────────
console.log("\n=== TRANG THAI UY QUYEN ===");
{
  const d = (s: string) => new Date(s);
  const bayGio = d("2026-08-22T12:00:00");
  const goc = { startAt: d("2026-08-20T00:00:00"), endAt: d("2026-08-25T23:59:59") };
  kiemTra(
    "dang hieu luc",
    trangThaiUyQuyen({ ...goc, revokedAt: null }, bayGio),
    "HIEU_LUC"
  );
  kiemTra(
    "da thu hoi thi het hieu luc du con han",
    trangThaiUyQuyen({ ...goc, revokedAt: d("2026-08-21T09:00:00") }, bayGio),
    "DA_THU_HOI"
  );
  kiemTra(
    "het han",
    trangThaiUyQuyen(
      { startAt: d("2026-08-01"), endAt: d("2026-08-10"), revokedAt: null },
      bayGio
    ),
    "HET_HAN"
  );
  kiemTra(
    "chua toi han",
    trangThaiUyQuyen(
      { startAt: d("2026-09-01"), endAt: d("2026-09-10"), revokedAt: null },
      bayGio
    ),
    "CHUA_TOI"
  );
}

console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
process.exit(truot ? 1 : 0);
