import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireActiveRole, trongPhamVi, vesselScopeDayDu } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { LAP_YEU_CAU } from "@/lib/roles";
import { QUY_LA_MA, mocQuy, quyCua } from "@/lib/kyQuy";
import { cacQuyThongKe, canhBaoThongKe, thongKeNhieuQuy } from "@/lib/tonKhoQuy";
import { HAU_TO_KHO, soHieuHang, taiDuLieuTonKy } from "@/lib/tonKhoQuyServer";

export const dynamic = "force-dynamic";

/**
 * Xuất Excel THỐNG KÊ XUẤT NHẬP TỒN THEO QUÝ của một tàu — cùng số và cùng bộ lọc
 * với trang /inventory/thong-ke (lib/tonKhoQuy.ts thongKeNhieuQuy): mỗi mặt hàng một
 * dòng, mỗi quý hai cột Nhận / Tiêu thụ, tổng, trung bình tiêu thụ một quý, đủ dùng.
 */
export async function GET(request: Request) {
  const { t } = await layT();
  const user = await requireActiveRole([...LAP_YEU_CAU, "TECH_MANAGER", "PURCHASER"]);
  if (!user) return NextResponse.json({ error: t("actionsModule.chuaDangNhap") }, { status: 401 });
  const url = new URL(request.url);
  const vesselId = Number(url.searchParams.get("vessel"));
  if (!Number.isInteger(vesselId) || vesselId <= 0) return NextResponse.json({ error: t("actionsModule.taiLieu_thieuTau") }, { status: 400 });
  if (!trongPhamVi(vesselScopeDayDu(user), vesselId)) return NextResponse.json({ error: t("chung.khongTimThay") }, { status: 404 });
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId }, select: { code: true, name: true } });
  if (!vessel) return NextResponse.json({ error: t("chung.khongTimThay") }, { status: 404 });

  const bayGio = new Date();
  const hienTai = quyCua(bayGio);
  const namChon = Number(url.searchParams.get("nam"));
  const nam = Number.isInteger(namChon) && namChon >= 2000 && namChon <= hienTai.nam ? namChon : null;
  const deptRaw = String(url.searchParams.get("dept") || "ALL");
  const dept = Object.hasOwn(HAU_TO_KHO, deptRaw) ? deptRaw : "ALL";
  const loaiRaw = String(url.searchParams.get("type") || "ALL");
  const loai = loaiRaw === "STORE" || loaiRaw === "SPARE" ? loaiRaw : "ALL";
  const loc = String(url.searchParams.get("loc") || "TAT_CA");
  const sx = String(url.searchParams.get("sx") || "TIEU_THU");
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();

  const cacQuy = cacQuyThongKe(bayGio, nam);
  const du = await taiDuLieuTonKy({ vesselId, boPhan: dept, loai, tuNgay: mocQuy(cacQuy[0]).batDau });
  const dong = thongKeNhieuQuy(du.tonHienTai, du.giaoDich, cacQuy, bayGio)
    .map((x) => ({ x, m: du.vatTu.get(x.materialId)! }))
    .filter(({ m }) => Boolean(m))
    .filter(({ m }) => !q || [m.nameVn, m.nameEn, m.code, m.impa, m.partNumber].some((v) => (v ?? "").toLowerCase().includes(q)))
    .filter(({ x, m }) => {
      const n = canhBaoThongKe(x, m.minStock);
      if (loc === "THIEU") return n.thieu;
      if (loc === "SAP_HET") return n.sapHet;
      if (loc === "KHONG_DONG") return n.khongDong;
      if (loc === "CO_DONG") return x.tongNhan !== 0 || x.tongTieuThu !== 0;
      return true;
    })
    .sort((a, b) => {
      if (sx === "TEN") return a.m.nameVn.localeCompare(b.m.nameVn, "vi");
      if (sx === "MA") return a.m.code.localeCompare(b.m.code);
      if (sx === "DU_DUNG") return (a.x.duDungQuy ?? Infinity) - (b.x.duDungQuy ?? Infinity) || b.x.tongTieuThu - a.x.tongTieuThu;
      return b.x.tongTieuThu - a.x.tongTieuThu || a.m.nameVn.localeCompare(b.m.nameVn, "vi");
    });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Thong ke", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const tenQuy = cacQuy.map((k) => `Q${QUY_LA_MA[k.quy - 1]}/${k.nam}`);
  const soCot = 6 + tenQuy.length * 2 + 4;
  ws.mergeCells(1, 1, 1, soCot);
  ws.getCell(1, 1).value = `THỐNG KÊ XUẤT NHẬP TỒN THEO QUÝ — ${vessel.code} ${vessel.name}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.mergeCells(2, 1, 2, soCot);
  ws.getCell(2, 1).value = `Các quý: ${tenQuy.join(", ")} · Bộ phận: ${dept} · Loại: ${loai} · Lập lúc ${bayGio.toISOString().slice(0, 16).replace("T", " ")} UTC · TB tiêu thụ chỉ tính quý đã hết`;
  ws.getCell(2, 1).font = { italic: true, size: 9 };
  const dau1 = ["Mã", "Mô tả", "IMPA / Part No.", "ĐVT", "Tối thiểu", "Tồn hiện tại", ...tenQuy.flatMap((x) => [x, ""]), "Tổng nhận", "Tổng tiêu thụ", "TB tiêu thụ / quý", "Đủ dùng (quý)"];
  const dau2 = ["", "", "", "", "", "", ...tenQuy.flatMap(() => ["Nhận", "Tiêu thụ"]), "", "", "", ""];
  ws.addRow([]);
  const r1 = ws.addRow(dau1);
  const r2 = ws.addRow(dau2);
  for (let i = 0; i < tenQuy.length; i++) ws.mergeCells(r1.number, 7 + i * 2, r1.number, 8 + i * 2);
  for (const c of [1, 2, 3, 4, 5, 6, soCot - 3, soCot - 2, soCot - 1, soCot]) ws.mergeCells(r1.number, c, r2.number, c);
  for (const r of [r1, r2]) {
    r.font = { bold: true };
    r.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  const tron = (n: number) => Math.round(n * 1000) / 1000;
  for (const { x, m } of dong) {
    const r = ws.addRow([
      m.code,
      m.nameVn,
      soHieuHang(m),
      m.uom,
      m.minStock || null,
      tron(x.tonHienTai),
      ...x.theoQuy.flatMap((s) => [s.nhan ? tron(s.nhan) : null, s.tieuThu ? tron(s.tieuThu) : null]),
      x.tongNhan ? tron(x.tongNhan) : null,
      x.tongTieuThu ? tron(x.tongTieuThu) : null,
      x.tbTieuThuQuy ?? null,
      x.duDungQuy ?? null,
    ]);
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }
  ws.getColumn(1).width = 16;
  ws.getColumn(2).width = 42;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 8;
  for (let c = 5; c <= soCot; c++) ws.getColumn(c).width = 11;
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: r2.number }];

  const buffer = await wb.xlsx.writeBuffer();
  const tenTep = `Thong-ke-ton_${vessel.code}_${nam ?? `${hienTai.nam}-Q${hienTai.quy}`}.xlsx`;
  const ascii = tenTep.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(tenTep)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
