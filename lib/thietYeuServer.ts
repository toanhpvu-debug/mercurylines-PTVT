import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { congThang, doiChieuThietYeu, khoaNhom, khoangThang, laThieu, soTuToiThieu, type DongThietYeu, type MucThietYeuDoc } from "@/lib/thietYeu";

/**
 * Dựng bảng báo cáo phụ tùng thiết yếu (MLS-11-04) của một tàu cho một tháng —
 * dùng chung cho trang, bản in và tệp Word nên ba nơi luôn ra cùng một số.
 *
 * Số của từng mục, theo thứ tự ưu tiên:
 *   1. ĐÃ LƯU: tàu đã lưu số kiểm tra tháng này → dùng nguyên.
 *   2. KHO: mục gắn với mặt hàng trong danh mục kho → tính từ phiếu nhập / xuất
 *      của tàu trong tháng (ban đầu = cuối tháng − nhận + dùng), như MLS-11-01.
 *   3. ƯỚC: chưa lưu, không gắn kho → ban đầu = số hiện có của tháng gần nhất
 *      đã lưu trước đó (hoặc số lúc nhập file), nhận / tiêu thụ để trống.
 */
export async function layBangThietYeu(
  vesselId: number,
  thang: string,
  /** Kiểm thử truyền giao dịch để cuộn ngược (scripts/kiem-tra-thiet-yeu-db.ts). */
  db: Prisma.TransactionClient = prisma
): Promise<DongThietYeu[]> {
  const muc = await db.phuTungThietYeu.findMany({
    where: { vesselId },
    orderBy: [{ thuTu: "asc" }, { id: "asc" }],
    include: { material: { select: { code: true } } },
  });
  if (!muc.length) return [];
  const ids = muc.map((m) => m.id);
  const [daLuu, truocDo] = await Promise.all([
    db.phuTungThietYeuThang.findMany({ where: { itemId: { in: ids }, thang } }),
    db.phuTungThietYeuThang.findMany({
      where: { itemId: { in: ids }, thang: { lt: thang } },
      orderBy: { thang: "desc" },
      select: { itemId: true, hienCo: true, viTri: true },
    }),
  ]);
  const luuTheoMuc = new Map(daLuu.map((r) => [r.itemId, r]));
  const truocTheoMuc = new Map<number, { hienCo: number | null; viTri: string | null }>();
  for (const r of truocDo) if (!truocTheoMuc.has(r.itemId)) truocTheoMuc.set(r.itemId, r);

  // Số từ kho cho các mục có gắn mặt hàng mà chưa lưu tháng này.
  const canKho = [...new Set(muc.filter((m) => m.materialId && !luuTheoMuc.has(m.id)).map((m) => m.materialId as number))];
  const soKho = new Map<number, { tonDau: number; nhan: number; tieuThu: number; hienCo: number }>();
  if (canKho.length) {
    const { dau, cuoi } = khoangThang(thang);
    const kho = await db.warehouse.findMany({ where: { vesselId }, select: { id: true } });
    const khoIds = kho.map((k) => k.id);
    const [ton, gd] = await Promise.all([
      db.inventory.findMany({ where: { warehouseId: { in: khoIds }, materialId: { in: canKho } }, select: { materialId: true, quantity: true } }),
      db.inventoryTransaction.findMany({
        where: { warehouseId: { in: khoIds }, materialId: { in: canKho }, occurredAt: { gte: dau } },
        select: { materialId: true, type: true, quantity: true, occurredAt: true },
      }),
    ]);
    const hienTai = new Map<number, number>();
    for (const r of ton) hienTai.set(r.materialId, (hienTai.get(r.materialId) ?? 0) + r.quantity);
    const sauThang = new Map<number, number>();
    const nhan = new Map<number, number>();
    const dung = new Map<number, number>();
    for (const g of gd) {
      const co = g.type === "IN" ? g.quantity : -g.quantity;
      if (g.occurredAt >= cuoi) sauThang.set(g.materialId, (sauThang.get(g.materialId) ?? 0) + co);
      else if (g.type === "IN") nhan.set(g.materialId, (nhan.get(g.materialId) ?? 0) + g.quantity);
      else dung.set(g.materialId, (dung.get(g.materialId) ?? 0) + g.quantity);
    }
    const tron = (n: number) => Math.round(n * 100) / 100;
    for (const id of canKho) {
      const cuoiThang = (hienTai.get(id) ?? 0) - (sauThang.get(id) ?? 0);
      const n = nhan.get(id) ?? 0;
      const d = dung.get(id) ?? 0;
      soKho.set(id, { tonDau: tron(cuoiThang - n + d), nhan: tron(n), tieuThu: tron(d), hienCo: tron(cuoiThang) });
    }
  }

  return muc.map((m): DongThietYeu => {
    const chung = {
      id: m.id,
      nhom: m.nhom,
      stt: m.stt ?? "",
      moTa: m.moTa,
      partNo: m.partNo,
      toiThieu: m.toiThieu,
      toiThieuSo: m.toiThieuSo,
      maVatTu: m.material?.code ?? null,
    };
    const luu = luuTheoMuc.get(m.id);
    if (luu) {
      return { ...chung, tonDau: luu.tonDau, nhan: luu.nhan, tieuThu: luu.tieuThu, hienCo: luu.hienCo, viTri: luu.viTri ?? m.viTri, nguon: "DA_LUU" };
    }
    const k = m.materialId ? soKho.get(m.materialId) : undefined;
    if (k) return { ...chung, ...k, viTri: m.viTri, nguon: "KHO" };
    const truoc = truocTheoMuc.get(m.id);
    const tonDau = truoc?.hienCo ?? m.hienCo ?? null;
    return { ...chung, tonDau, nhan: null, tieuThu: null, hienCo: tonDau, viTri: truoc?.viTri ?? m.viTri, nguon: "UOC" };
  });
}

// ─── Nhập tệp vào danh mục ──────────────────────────────────────────────────

export type CheDoNhapThietYeu = "capNhat" | "dongBo";

/**
 * Ghi kết quả đọc tệp MLS-11-04 vào danh mục của tàu (trong giao dịch của nơi gọi):
 *   - danh mục đang trống → tạo hết theo thứ tự tệp;
 *   - "capNhat": mục trùng (lib/thietYeu.ts doiChieuThietYeu) lấy nhóm / số thứ tự / số phụ
 *     tùng / tối thiểu / vị trí theo tệp (ô trống trong tệp thì giữ cái cũ) và GIỮ số các
 *     tháng đã lưu; mục mới chèn sau mục cuối cùng nhóm; mục không có trong tệp giữ nguyên;
 *   - "dongBo": như trên nhưng thứ tự theo tệp, mục không còn trong tệp bị xóa (cả số tháng).
 * Số trong tệp (ban đầu / nhận / tiêu thụ / hiện có) ghi vào tháng `thang`; số hiện có của
 * mục chỉ đổi khi `thang` không cũ hơn tháng mới nhất tàu đã lưu.
 */
export async function apDungNhapThietYeu(
  db: Prisma.TransactionClient,
  x: { vesselId: number; muc: MucThietYeuDoc[]; ganKho: (number | null)[]; cheDo: CheDoNhapThietYeu; thang: string; nguoi: string }
): Promise<{ taoMoi: number; capNhat: number; xoa: number; soThang: number }> {
  const coSan = await db.phuTungThietYeu.findMany({
    where: { vesselId: x.vesselId },
    orderBy: [{ thuTu: "asc" }, { id: "asc" }],
    select: { id: true, nhom: true, stt: true, moTa: true, partNo: true, toiThieu: true, viTri: true, materialId: true, thuTu: true },
  });
  const theoId = new Map(coSan.map((c) => [c.id, c]));
  const { khop, khongTrongTep } = doiChieuThietYeu(x.muc, coSan);
  const coThangSau = await db.phuTungThietYeuThang.findFirst({ where: { item: { vesselId: x.vesselId }, thang: { gt: x.thang } }, select: { id: true } });
  let taoMoi = 0;
  let capNhat = 0;
  let soThang = 0;
  const idTheoTep: number[] = [];
  for (let i = 0; i < x.muc.length; i++) {
    const m = x.muc[i];
    const cu = khop[i] === null ? undefined : theoId.get(khop[i]!);
    const toiThieu = m.toiThieu?.slice(0, 60) ?? cu?.toiThieu ?? null;
    const chung = {
      nhom: m.nhom.slice(0, 200),
      stt: m.stt,
      partNo: m.partNo?.slice(0, 80) ?? cu?.partNo ?? null,
      toiThieu,
      toiThieuSo: soTuToiThieu(toiThieu),
      viTri: m.viTri?.slice(0, 120) ?? cu?.viTri ?? null,
    };
    let id: number;
    if (cu) {
      await db.phuTungThietYeu.update({
        where: { id: cu.id },
        data: { ...chung, materialId: cu.materialId ?? x.ganKho[i], ...(!coThangSau && m.hienCo !== null ? { hienCo: m.hienCo } : {}) },
      });
      id = cu.id;
      capNhat++;
    } else {
      id = (
        await db.phuTungThietYeu.create({
          data: { vesselId: x.vesselId, thuTu: 0, moTa: m.moTa.slice(0, 300), hienCo: m.hienCo, materialId: x.ganKho[i], ...chung },
          select: { id: true },
        })
      ).id;
      taoMoi++;
    }
    idTheoTep.push(id);
    if ([m.tonDau, m.nhan, m.tieuThu, m.hienCo].some((v) => v !== null)) {
      const so = { tonDau: m.tonDau, nhan: m.nhan, tieuThu: m.tieuThu, hienCo: m.hienCo, viTri: chung.viTri, nguoiLuu: x.nguoi };
      await db.phuTungThietYeuThang.upsert({ where: { itemId_thang: { itemId: id, thang: x.thang } }, update: so, create: { itemId: id, thang: x.thang, ...so } });
      soThang++;
    }
  }
  const xoa =
    x.cheDo === "dongBo" && khongTrongTep.length
      ? (await db.phuTungThietYeu.deleteMany({ where: { vesselId: x.vesselId, id: { in: khongTrongTep } } })).count
      : 0;

  // Thứ tự: theo tệp (danh mục mới / đồng bộ), hoặc giữ thứ tự cũ và chèn mục mới sau mục
  // cuối cùng nhóm của nó (cập nhật).
  let thuTu: number[] = idTheoTep;
  if (coSan.length && x.cheDo === "capNhat") {
    const ds = coSan.map((c) => ({ id: c.id, nhom: khoaNhom(c.nhom) }));
    x.muc.forEach((m, i) => {
      if (khop[i] !== null) return;
      const k = khoaNhom(m.nhom);
      let vt = -1;
      ds.forEach((d, j) => {
        if (d.nhom === k) vt = j;
      });
      ds.splice(vt < 0 ? ds.length : vt + 1, 0, { id: idTheoTep[i], nhom: k });
    });
    thuTu = ds.map((d) => d.id);
  }
  for (let i = 0; i < thuTu.length; i++) {
    if (theoId.get(thuTu[i])?.thuTu === i + 1) continue;
    await db.phuTungThietYeu.update({ where: { id: thuTu[i] }, data: { thuTu: i + 1 } });
  }
  return { taoMoi, capNhat, xoa, soThang };
}

// ─── Theo dõi nhiều tháng ───────────────────────────────────────────────────

export type LichSuThietYeu = {
  /** Các tháng "YYYY-MM", cũ → mới, tháng cuối = tháng đang xem. */
  thang: string[];
  /** Số mục tàu đã lưu số trong từng tháng (cùng thứ tự `thang`). */
  daLuu: number[];
  muc: {
    id: number;
    nhom: string;
    stt: string;
    moTa: string;
    toiThieu: string | null;
    toiThieuSo: number;
    /** Số hiện có cuối từng tháng ĐÃ LƯU; null = tháng đó chưa lưu. */
    hienCo: (number | null)[];
    tieuThu: number;
    soThangThieu: number;
  }[];
};

/**
 * Số hiện có / tiêu thụ đã lưu của từng mục qua `soThang` tháng tới tháng `thangCuoi` — để
 * thấy mục nào thiếu kéo dài, mục nào dùng nhiều, tháng nào tàu chưa báo cáo.
 */
export async function layLichSuThietYeu(vesselId: number, thangCuoi: string, soThang = 6, db: Prisma.TransactionClient = prisma): Promise<LichSuThietYeu> {
  const thang = Array.from({ length: soThang }, (_, i) => congThang(thangCuoi, i - soThang + 1));
  const muc = await db.phuTungThietYeu.findMany({
    where: { vesselId },
    orderBy: [{ thuTu: "asc" }, { id: "asc" }],
    select: { id: true, nhom: true, stt: true, moTa: true, toiThieu: true, toiThieuSo: true },
  });
  const so = muc.length
    ? await db.phuTungThietYeuThang.findMany({
        where: { itemId: { in: muc.map((m) => m.id) }, thang: { gte: thang[0], lte: thangCuoi } },
        select: { itemId: true, thang: true, hienCo: true, tieuThu: true },
      })
    : [];
  const theo = new Map(so.map((r) => [`${r.itemId}|${r.thang}`, r]));
  return {
    thang,
    daLuu: thang.map((t) => so.filter((r) => r.thang === t).length),
    muc: muc.map((m) => {
      const hang = thang.map((t) => theo.get(`${m.id}|${t}`));
      const hienCo = hang.map((r) => r?.hienCo ?? null);
      return {
        id: m.id,
        nhom: m.nhom,
        stt: m.stt ?? "",
        moTa: m.moTa,
        toiThieu: m.toiThieu,
        toiThieuSo: m.toiThieuSo,
        hienCo,
        tieuThu: Math.round(hang.reduce((s, r) => s + (r?.tieuThu ?? 0), 0) * 100) / 100,
        soThangThieu: hienCo.filter((h) => laThieu({ toiThieuSo: m.toiThieuSo, hienCo: h })).length,
      };
    }),
  };
}

// ─── Toàn đội ───────────────────────────────────────────────────────────────

export type TongQuanTauThietYeu = {
  vesselId: number;
  soMuc: number;
  /** Theo số hiện có mới nhất của từng mục. */
  soThieu: number;
  soChuaCoSo: number;
  /** Số mục đã lưu số của tháng đang xem. */
  daLuuThang: number;
  /** Tháng gần nhất tàu đã lưu số ("YYYY-MM"); null = chưa lưu tháng nào. */
  thangGanNhat: string | null;
};

/** Mỗi tàu một dòng: danh mục bao nhiêu mục, thiếu bao nhiêu, đã báo cáo tháng `thang` chưa. */
export async function tongQuanDoiThietYeu(vesselIds: number[], thang: string, db: Prisma.TransactionClient = prisma): Promise<Map<number, TongQuanTauThietYeu>> {
  const [muc, so] = await Promise.all([
    db.phuTungThietYeu.findMany({ where: { vesselId: { in: vesselIds } }, select: { id: true, vesselId: true, toiThieuSo: true, hienCo: true } }),
    db.phuTungThietYeuThang.findMany({ where: { item: { vesselId: { in: vesselIds } } }, select: { thang: true, item: { select: { vesselId: true } } } }),
  ]);
  const ra = new Map<number, TongQuanTauThietYeu>();
  const lay = (vesselId: number) => {
    let x = ra.get(vesselId);
    if (!x) {
      x = { vesselId, soMuc: 0, soThieu: 0, soChuaCoSo: 0, daLuuThang: 0, thangGanNhat: null };
      ra.set(vesselId, x);
    }
    return x;
  };
  for (const m of muc) {
    const x = lay(m.vesselId);
    x.soMuc++;
    if (laThieu(m)) x.soThieu++;
    if (m.hienCo === null) x.soChuaCoSo++;
  }
  for (const r of so) {
    const x = lay(r.item.vesselId);
    if (r.thang === thang) x.daLuuThang++;
    if (!x.thangGanNhat || r.thang > x.thangGanNhat) x.thangGanNhat = r.thang;
  }
  return ra;
}
