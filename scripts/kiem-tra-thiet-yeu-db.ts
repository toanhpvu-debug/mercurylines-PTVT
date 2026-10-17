/**
 * Kiểm phần database của Phụ tùng thiết yếu MLS-11-04, KHÔNG để lại dữ liệu.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-thiet-yeu-db.ts
 * (cờ react-server để nạp được lib/thietYeuServer.ts có "server-only"; bộ
 * kiem-chung-nhanh.ps1 chạy mọi script theo cách này).
 *
 * Trong một giao dịch: tạo danh mục thử cho tàu đầu tiên (đọc từ tệp MLS-11-04
 * thật trên Desktop nếu có), một mục đã lưu tháng này, một mục chỉ có tháng
 * trước, một mục gắn mặt hàng đang có tồn kho trên tàu — rồi so bảng
 * layBangThietYeu dựng ra với số mong đợi, thử xóa-thay (số tháng xóa theo), và
 * cố ý ném lỗi để PostgreSQL cuộn ngược.
 */
import os from "node:os";
import path from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { moTepWord } from "@/lib/docWord";
import { docBangThietYeu, ghepHangWord, soTuToiThieu, thangHopLe, type MucThietYeuDoc } from "@/lib/thietYeu";
import { apDungNhapThietYeu, layBangThietYeu, layLichSuThietYeu, luuBangThietYeu, tongQuanDoiThietYeu, type DongHieuChinh } from "@/lib/thietYeuServer";

const prisma = new PrismaClient();
let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) {
    dat++;
    console.log(`  OK    ${ten}`);
  } else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}
class CuonNguoc extends Error {}

async function mucThu(): Promise<MucThietYeuDoc[]> {
  const desktop = path.join(os.homedir(), "Desktop");
  const tep = existsSync(desktop) ? readdirSync(desktop).find((f) => /^MLS-11-04 DM.*\.doc$/i.test(f)) : undefined;
  if (tep) {
    const kq = docBangThietYeu(ghepHangWord((await moTepWord(readFileSync(path.join(desktop, tep)))).than()));
    console.log(`  Doc ${tep}: ${kq.muc.length} muc`);
    return kq.muc;
  }
  const m = (stt: string, moTa: string): MucThietYeuDoc => ({ nhom: "A. Thu", stt, moTa, partNo: null, toiThieu: "01 set", toiThieuSo: 1, tonDau: null, nhan: null, tieuThu: null, hienCo: null, viTri: null });
  return [m("1", "Muc 1"), m("2", "Muc 2"), m("3", "Muc 3"), m("4", "Muc 4")];
}

async function main() {
  const tau = await prisma.vessel.findFirst({ orderBy: { code: "asc" }, select: { id: true, code: true } });
  if (!tau) {
    console.log("Chua co tau nao — bo qua (khong phai loi).");
    return;
  }
  // Mặt hàng đang có tồn trong kho của tàu này (để thử nguồn KHO).
  const ton = await prisma.inventory.findFirst({
    where: { warehouse: { vesselId: tau.id }, quantity: { gt: 0 } },
    select: { materialId: true },
  });
  const muc = await mucThu();
  const thang = thangHopLe(null);
  const [y, mo] = thang.split("-").map(Number);
  const thangTruoc = `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, "0")}`;
  console.log(`  Tau ${tau.code}, thang ${thang}, thang truoc ${thangTruoc}, ton kho thu: ${ton ? `material #${ton.materialId}` : "khong co"}`);

  try {
    await prisma.$transaction(
      async (tx) => {
        const truocDo = await tx.phuTungThietYeu.count({ where: { vesselId: tau.id } });
        const ids: number[] = [];
        for (let i = 0; i < muc.length; i++) {
          const m = muc[i];
          const moi = await tx.phuTungThietYeu.create({
            data: {
              vesselId: tau.id,
              nhom: m.nhom,
              thuTu: 100000 + i,
              stt: m.stt,
              moTa: m.moTa,
              partNo: m.partNo,
              toiThieu: m.toiThieu,
              toiThieuSo: m.toiThieuSo,
              hienCo: i === 3 ? 7 : null,
              materialId: i === 2 && ton ? ton.materialId : null,
            },
            select: { id: true },
          });
          ids.push(moi.id);
        }
        await tx.phuTungThietYeuThang.create({ data: { itemId: ids[0], thang, tonDau: 2, nhan: 1, tieuThu: 1, hienCo: 2, viTri: "Kho may" } });
        await tx.phuTungThietYeuThang.create({ data: { itemId: ids[1], thang: thangTruoc, hienCo: 4, viTri: "Ke A" } });

        const bang = (await layBangThietYeu(tau.id, thang, tx)).filter((d) => ids.includes(d.id));
        kiemTra("so dong = so muc da tao", bang.length, muc.length);
        kiemTra("giu thu tu nhap", bang.map((d) => d.id), ids);
        const [d0, d1, d2, d3] = bang;
        kiemTra("muc 1: DA_LUU dung so", [d0.nguon, d0.tonDau, d0.nhan, d0.tieuThu, d0.hienCo, d0.viTri], ["DA_LUU", 2, 1, 1, 2, "Kho may"]);
        kiemTra("muc 2: UOC theo thang truoc", [d1.nguon, d1.tonDau, d1.nhan, d1.tieuThu, d1.hienCo, d1.viTri], ["UOC", 4, null, null, 4, "Ke A"]);
        if (ton) {
          const tong = await tx.inventory.aggregate({ where: { warehouse: { vesselId: tau.id }, materialId: ton.materialId }, _sum: { quantity: true } });
          const sauThang = await tx.inventoryTransaction.count({ where: { vesselId: tau.id, materialId: ton.materialId, occurredAt: { gte: new Date(y, mo, 1) } } });
          kiemTra("muc 3: nguon KHO", d2.nguon, "KHO");
          if (sauThang === 0) kiemTra("muc 3: hien co = ton kho hien tai", d2.hienCo, Math.round((tong._sum.quantity ?? 0) * 100) / 100);
          kiemTra("muc 3: ban dau = cuoi - nhan + dung", d2.tonDau, Math.round(((d2.hienCo ?? 0) - (d2.nhan ?? 0) + (d2.tieuThu ?? 0)) * 100) / 100);
          kiemTra("muc 3: ma vat tu gan kho", typeof d2.maVatTu, "string");
        }
        kiemTra("muc 4: UOC tu so luc nhap", [d3.nguon, d3.tonDau, d3.hienCo], ["UOC", 7, 7]);
        kiemTra("toi thieu quy doi", bang.every((d) => d.toiThieuSo === soTuToiThieu(d.toiThieu)), true);

        // Truy vấn của Dashboard.
        const dash = await tx.phuTungThietYeu.count({ where: { vesselId: tau.id, toiThieuSo: { gt: 0 }, id: { in: ids } } });
        kiemTra("dashboard dem muc co toi thieu", dash, muc.filter((m) => m.toiThieuSo > 0).length);

        // Upsert tháng (lưu lại lần hai không tạo bản trùng).
        await tx.phuTungThietYeuThang.upsert({
          where: { itemId_thang: { itemId: ids[0], thang } },
          update: { hienCo: 1 },
          create: { itemId: ids[0], thang, hienCo: 1 },
        });
        kiemTra("upsert thang khong trung", await tx.phuTungThietYeuThang.count({ where: { itemId: ids[0] } }), 1);

        // Thay danh mục: xóa mục thì số tháng xóa theo (FK cascade).
        await tx.phuTungThietYeu.deleteMany({ where: { id: { in: ids } } });
        kiemTra("xoa muc → xoa so thang", await tx.phuTungThietYeuThang.count({ where: { itemId: { in: ids } } }), 0);
        kiemTra("danh muc cu cua tau con nguyen", await tx.phuTungThietYeu.count({ where: { vesselId: tau.id } }), truocDo);
        throw new CuonNguoc();
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }
  kiemTra(
    "da cuon nguoc (khong con muc thu)",
    await prisma.phuTungThietYeu.count({ where: { vesselId: tau.id, thuTu: { gte: 100000 } } }),
    0
  );
}

/**
 * Nhập tệp (apDungNhapThietYeu) trên một tàu tạm tạo trong giao dịch: lần đầu tạo hết; tệp
 * tháng sau "cập nhật" giữ số các tháng đã lưu, thêm mục mới vào đúng nhóm, giữ mục không có
 * trong tệp; "đồng bộ" xóa mục không còn trong tệp; tệp tháng cũ không đè số hiện có mới hơn.
 */
async function kiemNhapTep() {
  console.log("\n=== Nhap tep vao danh muc (tau tam, cuon nguoc) ===");
  const m = (nhom: string, stt: string, moTa: string, toiThieu: string, hienCo: number | null, partNo: string | null = null): MucThietYeuDoc => ({
    nhom,
    stt,
    moTa,
    partNo,
    toiThieu,
    toiThieuSo: soTuToiThieu(toiThieu),
    tonDau: hienCo,
    nhan: hienCo === null ? null : 0,
    tieuThu: hienCo === null ? null : 0,
    hienCo,
    viTri: "E/R",
  });
  const A = "A. Phụ tùng cho Máy chính (Spare Parts for Main Engine)";
  const B = "B. Phụ tùng cho Máy phát (Spare parts for Generator)";
  const tep1 = [m(A, "1", "Main Bearing (Bạc trục)", "2 set", 1, "P-001"), m(A, "2", "Thrust bearing", "1 set", 0), m(A, "3", "Exh. valve spindle", "2 pcs", 2), m(B, "1", "Main Bearing (Bạc trục)", "6 set", 0), m(B, "2", "Cylinder head", "3 pcs", 1)];
  const ten = (ids: { moTa: string; nhom: string }[]) => ids.map((x) => `${x.nhom.slice(0, 1)}:${x.moTa}`);
  try {
    await prisma.$transaction(
      async (tx) => {
        const tau = await tx.vessel.create({ data: { code: `THU-TY-${Date.now()}`, name: "TAU THU MLS-11-04" }, select: { id: true } });
        const danhMuc = () => tx.phuTungThietYeu.findMany({ where: { vesselId: tau.id }, orderBy: { thuTu: "asc" }, select: { id: true, nhom: true, moTa: true, hienCo: true } });
        const nhap = (muc: MucThietYeuDoc[], cheDo: "capNhat" | "dongBo", thang: string) =>
          apDungNhapThietYeu(tx, { vesselId: tau.id, muc, ganKho: muc.map(() => null), cheDo, thang, nguoi: "Kiem thu" });

        const k1 = await nhap(tep1, "capNhat", "2026-09");
        kiemTra("lan dau: tao het, so ghi vao thang cua tep", k1, { taoMoi: 5, capNhat: 0, xoa: 0, soThang: 5 });
        const ds1 = await danhMuc();
        kiemTra("lan dau: thu tu theo tep", ten(ds1), ["A:Main Bearing (Bạc trục)", "A:Thrust bearing", "A:Exh. valve spindle", "B:Main Bearing (Bạc trục)", "B:Cylinder head"]);
        kiemTra("lan dau: so thang 2026-09", await tx.phuTungThietYeuThang.count({ where: { item: { vesselId: tau.id }, thang: "2026-09" } }), 5);

        // Tệp tháng 10: A1 đổi số, A2 vẫn có, A4 mới, B2 vẫn có; A3, B1 không còn trong tệp.
        const tep2 = [m(A, "1", "Main Bearing (Bạc trục):", "2 set", 2, "P-001"), m(A, "2", "Thrust bearing", "1 set", 1), m(A, "4", "Piston crown", "1 pce", 1), m(B, "2", "Cylinder head", "3 pcs", 3)];
        const k2 = await nhap(tep2, "capNhat", "2026-10");
        kiemTra("cap nhat: 1 moi, 3 cap nhat, khong xoa", k2, { taoMoi: 1, capNhat: 3, xoa: 0, soThang: 4 });
        const ds2 = await danhMuc();
        kiemTra("cap nhat: giu muc khong co trong tep, muc moi vao cuoi nhom A", ten(ds2), [
          "A:Main Bearing (Bạc trục)",
          "A:Thrust bearing",
          "A:Exh. valve spindle",
          "A:Piston crown",
          "B:Main Bearing (Bạc trục)",
          "B:Cylinder head",
        ]);
        kiemTra("cap nhat: cung id (giu lich su) va so hien co moi", [ds2[0].id === ds1[0].id, ds2[0].hienCo], [true, 2]);
        kiemTra("cap nhat: so thang 09 cua muc cu van con", await tx.phuTungThietYeuThang.count({ where: { itemId: ds1[0].id } }), 2);

        // Tệp tháng 8 (cũ hơn tháng đã lưu): ghi số tháng 8, không đè số hiện có của tháng 10.
        await nhap([m(A, "1", "Main Bearing (Bạc trục)", "2 set", 9, "P-001")], "capNhat", "2026-08");
        kiemTra("tep thang cu: khong de so hien co moi hon", (await danhMuc())[0].hienCo, 2);

        const ls = await layLichSuThietYeu(tau.id, "2026-10", 3, tx);
        kiemTra("lich su 3 thang: thang, so da luu, hien co muc A1", [ls.thang, ls.daLuu, ls.muc[0].hienCo, ls.muc[0].soThangThieu], [["2026-08", "2026-09", "2026-10"], [1, 5, 4], [9, 1, 2], 1]);
        const tq = (await tongQuanDoiThietYeu([tau.id], "2026-10", tx)).get(tau.id);
        kiemTra("toan doi: so muc, thieu, da luu thang, thang gan nhat", tq && [tq.soMuc, tq.daLuuThang, tq.thangGanNhat], [6, 4, "2026-10"]);

        // Đồng bộ: thứ tự theo tệp, xóa mục không còn trong tệp (cả số tháng).
        const k3 = await nhap(tep2, "dongBo", "2026-10");
        kiemTra("dong bo: xoa 2 muc khong con trong tep", [k3.taoMoi, k3.capNhat, k3.xoa], [0, 4, 2]);
        kiemTra("dong bo: danh muc dung theo tep", ten(await danhMuc()), ["A:Main Bearing (Bạc trục)", "A:Thrust bearing", "A:Piston crown", "B:Cylinder head"]);
        throw new CuonNguoc();
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }
  kiemTra("da cuon nguoc (khong con tau tam)", await prisma.vessel.count({ where: { name: "TAU THU MLS-11-04" } }), 0);
}

/**
 * Hiệu chỉnh danh mục & số lượng (luuBangThietYeu) trên tàu tạm trong giao dịch: "chỉ lưu danh
 * mục" đổi tên nhóm / chuyển nhóm / số thứ tự / thứ tự / tối thiểu / vị trí mà KHÔNG tạo số tháng
 * (vị trí của tháng đã lưu đổi theo); lưu kèm số tháng thì chốt số mọi dòng; tháng cũ không đè số
 * hiện có mới hơn; id của tàu khác bị bỏ qua; bản trình duyệt cũ không gửi nhóm thì giữ nhóm.
 */
async function kiemHieuChinh() {
  console.log("\n=== Hieu chinh danh muc & so luong (tau tam, cuon nguoc) ===");
  const A = "A. Phụ tùng cho Máy chính (Spare Parts for Main Engine)";
  const B = "B. Phụ tùng cho Máy phát (Spare parts for Generator)";
  try {
    await prisma.$transaction(
      async (tx) => {
        const tau = await tx.vessel.create({ data: { code: `THU-HC-${Date.now()}`, name: "TAU THU HIEU CHINH 1104" }, select: { id: true } });
        const tauKhac = await tx.vessel.create({ data: { code: `THU-HC2-${Date.now()}`, name: "TAU THU HIEU CHINH 1104" }, select: { id: true } });
        const tao = (vesselId: number, nhom: string, thuTu: number, stt: string, moTa: string, hienCo: number) =>
          tx.phuTungThietYeu.create({ data: { vesselId, nhom, thuTu, stt, moTa, toiThieu: "2 set", toiThieuSo: 2, viTri: "E/R", hienCo }, select: { id: true } }).then((x) => x.id);
        const a1 = await tao(tau.id, A, 1, "1", "Main bearing", 1);
        const a2 = await tao(tau.id, A, 2, "2", "Thrust bearing", 0);
        const a3 = await tao(tau.id, A, 3, "3", "Exh. valve", 2);
        const b1 = await tao(tau.id, B, 4, "1", "Cylinder head", 1);
        const b2 = await tao(tau.id, B, 5, "2", "Fuel pump", 3);
        const la = await tao(tauKhac.id, A, 1, "1", "Muc tau khac", 7);
        await tx.phuTungThietYeuThang.create({ data: { itemId: a1, thang: "2026-10", hienCo: 1, viTri: "E/R" } });
        const dong = (id: number, nhom: string, stt: string, moTa: string, x: { toiThieu?: string; viTri?: string; hienCo?: number | null } = {}): DongHieuChinh => ({
          id,
          nhom,
          stt,
          moTa,
          partNo: null,
          toiThieu: x.toiThieu ?? "2 set",
          viTri: x.viTri ?? "E/R",
          tonDau: null,
          nhan: null,
          tieuThu: null,
          hienCo: x.hienCo ?? null,
        });
        const A2 = "A. Đổi tên nhóm máy chính";
        // Bảng sau khi sửa: đổi tên nhóm A, A2 chuyển sang cuối nhóm B (số 3), A3 thành số 2, B đổi
        // chỗ (số đứng yên ở vị trí), A1 tối thiểu 1 set + vị trí mới, A3 gõ số 5 (không được lưu).
        const bang = [
          dong(a1, A2, "1", "Main bearing", { toiThieu: "1 set", viTri: "E/R store", hienCo: 1 }),
          dong(a3, A2, "2", "Exh. valve", { hienCo: 5 }),
          dong(b2, B, "1", "Fuel pump", { hienCo: 3 }),
          dong(b1, B, "2", "Cylinder head", { hienCo: 1 }),
          dong(a2, B, "3", "Thrust bearing", { hienCo: 0 }),
          dong(la, A2, "9", "Sua tau khac", { hienCo: 99 }),
        ];
        const danhMuc = () =>
          tx.phuTungThietYeu.findMany({
            where: { vesselId: tau.id },
            orderBy: [{ thuTu: "asc" }, { id: "asc" }],
            select: { id: true, nhom: true, stt: true, toiThieu: true, toiThieuSo: true, viTri: true, hienCo: true },
          });
        const nhin = (ds: { id: number; nhom: string; stt: string | null }[]) => ds.map((d) => `${d.nhom.slice(0, 1)}${d.nhom === A2 ? "'" : ""}:${[a1, a2, a3, b1, b2].indexOf(d.id)}#${d.stt}`);

        const k1 = await luuBangThietYeu(tx, { vesselId: tau.id, thang: "2026-10", dong: bang, chiDanhMuc: true, nguoi: "Kiem thu" });
        kiemTra("chi danh muc: 5 muc (bo id tau khac), 5 doi, 3 doi nhom, doi thu tu, 0 so thang", k1, { soMuc: 5, doiDanhMuc: 5, doiNhom: 3, doiThuTu: true, soThang: 0 });
        const ds1 = await danhMuc();
        kiemTra("chi danh muc: thu tu + nhom + so thu tu dung nhu bang", nhin(ds1), ["A':0#1", "A':2#2", "B:4#1", "B:3#2", "B:1#3"]);
        kiemTra("chi danh muc: toi thieu 1 set (so quy doi 1), vi tri moi", [ds1[0].toiThieu, ds1[0].toiThieuSo, ds1[0].viTri], ["1 set", 1, "E/R store"]);
        kiemTra("chi danh muc: khong tao so thang, khong doi hien co", [await tx.phuTungThietYeuThang.count({ where: { item: { vesselId: tau.id } } }), ds1[1].hienCo], [1, 2]);
        kiemTra("chi danh muc: vi tri cua thang da luu doi theo", (await tx.phuTungThietYeuThang.findUnique({ where: { itemId_thang: { itemId: a1, thang: "2026-10" } } }))?.viTri, "E/R store");
        kiemTra("muc cua tau khac khong bi dong toi", await tx.phuTungThietYeu.findUnique({ where: { id: la }, select: { nhom: true, stt: true, hienCo: true } }), { nhom: A, stt: "1", hienCo: 7 });

        const k2 = await luuBangThietYeu(tx, { vesselId: tau.id, thang: "2026-10", dong: bang, chiDanhMuc: false, nguoi: "Kiem thu" });
        kiemTra("luu kem so thang: khong doi danh muc nua, chot so 5 muc", k2, { soMuc: 5, doiDanhMuc: 0, doiNhom: 0, doiThuTu: false, soThang: 5 });
        kiemTra("luu kem so thang: hien co cua muc theo so moi (A3 = 5)", (await danhMuc()).find((d) => d.id === a3)?.hienCo, 5);

        await tx.phuTungThietYeuThang.create({ data: { itemId: a3, thang: "2026-11", hienCo: 4 } });
        await luuBangThietYeu(tx, { vesselId: tau.id, thang: "2026-10", dong: [dong(a3, A2, "2", "Exh. valve", { hienCo: 8 })], chiDanhMuc: false, nguoi: "Kiem thu" });
        kiemTra("thang cu: ghi so thang 10, khong de hien co (da co thang 11)", [(await tx.phuTungThietYeuThang.findUnique({ where: { itemId_thang: { itemId: a3, thang: "2026-10" } } }))?.hienCo, (await danhMuc()).find((d) => d.id === a3)?.hienCo], [8, 5]);
        kiemTra("chi gui mot dong: muc khong gui giu nguyen thu tu sau no", nhin(await danhMuc()), ["A':2#2", "A':0#1", "B:4#1", "B:3#2", "B:1#3"]);

        const cu = dong(b1, B, "2", "Cylinder head (sua)");
        delete cu.nhom;
        delete cu.stt;
        await luuBangThietYeu(tx, { vesselId: tau.id, thang: "2026-10", dong: [cu], chiDanhMuc: true, nguoi: "Kiem thu" });
        kiemTra("ban trinh duyet cu (khong gui nhom / so thu tu): giu nhom, doi mo ta", await tx.phuTungThietYeu.findUnique({ where: { id: b1 }, select: { nhom: true, stt: true, moTa: true } }), { nhom: B, stt: "2", moTa: "Cylinder head (sua)" });
        throw new CuonNguoc();
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }
  kiemTra("da cuon nguoc (khong con tau tam hieu chinh)", await prisma.vessel.count({ where: { name: "TAU THU HIEU CHINH 1104" } }), 0);
}

main()
  .then(kiemNhapTep)
  .then(kiemHieuChinh)
  .catch((e) => {
    truot++;
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
    process.exit(truot ? 1 : 0);
  });
