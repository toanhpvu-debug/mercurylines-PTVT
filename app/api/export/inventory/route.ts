import path from "path";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  requireActiveRole,
  trongPhamVi,
  vesselScopeDayDu,
} from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { MA_BIEU_MAU_KIEM_KE } from "@/lib/bieuMau";
import {
  dienDongKiemKe,
  dungBieuMauKiemKe,
  ghiChuBanTuDung,
} from "@/lib/bieuMauKiemKe";
import { LAP_YEU_CAU } from "@/lib/roles";
import { kyThang, ngayCuaVN, quyCua, type ThangNam } from "@/lib/kyQuy";
import { soLieuKyVatTu, tenKyThang, thangCuaQuy } from "@/lib/tonKhoQuy";

/** Bộ phận theo hậu tố mã kho (như báo cáo MLS-11-01): ENG = Máy, DECK = Boong, STORE = Kho tiêu hao. */
const BO_PHAN: Record<string, { hauTo: string | null; nhan: string }> = {
  ALL: { hauTo: null, nhan: "" },
  ENG: { hauTo: "-ENG", nhan: "Máy" },
  DECK: { hauTo: "-DECK", nhan: "Boong" },
  STORE: { hauTo: "-STORE", nhan: "Kho tiêu hao" },
};

/**
 * Kỳ xuất: ?quy=3&nam=2026 (quý), ?thang=2026-08 (một tháng), mặc định quý hiện
 * tại (giờ Việt Nam). Quý / tháng chưa tới thì lùi về hiện tại.
 */
function kyXuat(url: URL, bayGio: Date): { tu: ThangNam; den: ThangNam } {
  const hienTai = ngayCuaVN(bayGio);
  const chuaToi = (x: ThangNam) => x.nam > hienTai.nam || (x.nam === hienTai.nam && x.thang > hienTai.thang);
  const m = /^(\d{4})-(\d{2})$/.exec(url.searchParams.get("thang") ?? "");
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    const x = { nam: Number(m[1]), thang: Number(m[2]) };
    if (!chuaToi(x)) return { tu: x, den: x };
  }
  const q = Number(url.searchParams.get("quy"));
  const n = Number(url.searchParams.get("nam"));
  if (Number.isInteger(q) && q >= 1 && q <= 4 && Number.isInteger(n) && n >= 2000) {
    const k = thangCuaQuy({ nam: n, quy: q as 1 | 2 | 3 | 4 });
    if (!chuaToi(k.tu)) return k;
  }
  return thangCuaQuy(quyCua(bayGio));
}

export const dynamic = "force-dynamic";

// Xuất kiểm kê vật tư & phụ tùng của một tàu theo đúng form công ty MLS-11-06:
// điền dữ liệu thật (danh mục tàu + tồn kho + Còn tồn đợt trước / Nhận / Tiêu thụ
// trong KỲ — quý hoặc tháng, lib/tonKhoQuy.ts) vào template gốc. Cùng số với trang
// Báo cáo tồn kho theo quý (/inventory/bao-cao-quy).
export async function GET(request: Request) {
  // Danh sách vai trò cứng ["ADMIN","MASTER","CREW"] là di sản từ thời hệ
  // thống chỉ có 3 vai trò. Nay có 11 chức danh: máy trưởng, đại phó, phó 2/3,
  // máy 2/3/4 đều TẢI LÊN / xem được ở giao diện, và quản lý kỹ thuật là người
  // soát chứng từ toàn đội. Chống xem chéo tàu vẫn do trongPhamVi() lo.
  const { t } = await layT();
  const user = await requireActiveRole([...LAP_YEU_CAU, "TECH_MANAGER", "PURCHASER"]);
  if (!user) {
    return NextResponse.json(
      { error: t("actionsModule.chuaDangNhap") },
      { status: 401 }
    );
  }
  const scope = vesselScopeDayDu(user);
  const url = new URL(request.url);
  const vesselId = Number(url.searchParams.get("vessel"));
  const typeRaw = String(url.searchParams.get("type") || "ALL");
  const type = ["ALL", "STORE", "SPARE"].includes(typeRaw) ? typeRaw : "ALL";
  const deptRaw = String(url.searchParams.get("dept") || "ALL");
  const dept = Object.hasOwn(BO_PHAN, deptRaw) ? deptRaw : "ALL";
  if (!Number.isInteger(vesselId) || vesselId <= 0) {
    return NextResponse.json(
      { error: t("actionsModule.taiLieu_thieuTau") },
      { status: 400 }
    );
  }
  if (!trongPhamVi(scope, vesselId)) {
    return NextResponse.json(
      { error: t("chung.khongTimThay") },
      { status: 404 }
    );
  }
  const vessel = await prisma.vessel.findUnique({ where: { id: vesselId } });
  if (!vessel) {
    return NextResponse.json(
      { error: t("chung.khongTimThay") },
      { status: 404 }
    );
  }

  const now = new Date();
  const kyChon = kyXuat(url, now);
  const ky = kyThang(kyChon.tu, kyChon.den);
  const khoTau = await prisma.warehouse.findMany({ where: { vesselId }, select: { id: true, code: true } });
  const hauTo = BO_PHAN[dept].hauTo;
  const khoIds = khoTau.filter((w) => !hauTo || w.code.endsWith(hauTo)).map((w) => w.id);
  const [links, inventoryGroup, kyTx] = await Promise.all([
    prisma.vesselMaterial.findMany({
      where: {
        vesselId,
        material: {
          isActive: true,
          ...(type === "ALL" ? {} : { materialType: type }),
        },
      },
      include: { material: { include: { category: true } } },
    }),
    prisma.inventory.groupBy({
      by: ["materialId"],
      where: { vesselId, warehouseId: { in: khoIds } },
      _sum: { quantity: true },
    }),
    prisma.inventoryTransaction.findMany({
      where: { vesselId, warehouseId: { in: khoIds }, occurredAt: { gte: ky.batDau } },
      select: { materialId: true, type: true, quantity: true, note: true, occurredAt: true, cotBaoCao: true },
    }),
  ]);

  const stockByMat = new Map(
    inventoryGroup.map((r) => [r.materialId, Number(r._sum.quantity ?? 0)])
  );
  // Bốn cột của kỳ, neo vào tồn hiện tại; điều chỉnh kiểm kê gộp vào Còn tồn đợt
  // trước để bốn cột vẫn cân (trước đây mọi dòng NHẬP / XUẤT trong tháng, kể cả
  // kiểm kê, đều thành Nhận / Tiêu thụ).
  const soKy = new Map(soLieuKyVatTu(stockByMat, kyTx, ky).map((x) => [x.materialId, x.cot]));

  // Bổ sung vật tư CÒN TỒN/CÓ GIAO DỊCH nhưng đã gỡ khỏi danh mục tàu —
  // bản kiểm kê phải phản ánh đủ hàng thực trên tàu.
  const linkedIds = new Set(links.map((l) => l.material.id));
  const extraIds = [
    ...new Set([
      ...inventoryGroup
        .filter((r) => Number(r._sum.quantity ?? 0) !== 0)
        .map((r) => r.materialId),
      ...kyTx.map((t) => t.materialId),
    ]),
  ].filter((id) => !linkedIds.has(id));
  const extraMaterials = extraIds.length
    ? await prisma.material.findMany({
        where: {
          id: { in: extraIds },
          ...(type === "ALL" ? {} : { materialType: type }),
        },
        include: { category: true },
      })
    : [];

  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Lọc một bộ phận (kho máy / boong / tiêu hao): chỉ mặt hàng có tồn hoặc có phát sinh
  // ở kho của bộ phận đó. Liệt kê cả danh mục tàu thì hàng của kho khác hiện tồn 0 —
  // tàu điền / tải lại file đó lên kiểm kê là đưa tồn của chúng ở kho khác về 0.
  const coOKho = new Set([...inventoryGroup.filter((r) => Number(r._sum.quantity ?? 0) !== 0).map((r) => r.materialId), ...kyTx.map((x) => x.materialId)]);
  const rows = [...links.map((l) => l.material), ...extraMaterials]
    .filter((m) => dept === "ALL" || coOKho.has(m.id))
    .map((m) => {
      const c = soKy.get(m.id);
      return {
        group: m.category?.name ?? m.equipment ?? (m.materialType === "SPARE" ? "Spare" : "Store"),
        name: m.nameVn,
        impa: m.impa ?? m.partNumber ?? "",
        uom: m.uom,
        lastRob: round2(c?.tonDau ?? 0),
        received: round2(c?.nhan ?? 0),
        consumed: round2(c?.tieuThu ?? 0),
        rob: round2(c?.tonCuoi ?? 0),
      };
    })
    .sort(
      (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)
    );

  // Điền vào biểu mẫu gốc MLS-11-06 (giữ nguyên định dạng, logo và khối chữ ký
  // của công ty).
  //
  // Tìm ở DATABASE trước, đĩa sau. Biểu mẫu là tài liệu nội bộ nên nằm trong
  // .gitignore, nghĩa là nó KHÔNG BAO GIỜ đi vào bản dựng Docker — trên máy văn
  // phòng nút này chạy tốt còn trên bản chạy thật thì luôn báo thiếu biểu mẫu,
  // đúng kiểu lỗi chỉ xảy ra ở một nơi nên khó lần ra nhất. Bản trong database
  // (quản trị tải lên ở Mua sắm → Biểu mẫu) sống qua mỗi lần dựng lại container
  // và nằm trong bản sao lưu hằng ngày. Đường đĩa giữ lại làm lối lùi cho máy
  // văn phòng đã có sẵn tệp trong templates/.
  const banTrongDb = await prisma.bieuMauTep.findUnique({
    where: { code: MA_BIEU_MAU_KIEM_KE },
    select: { data: true },
  });
  let templateBuffer: Buffer | null = banTrongDb
    ? Buffer.from(banTrongDb.data)
    : null;
  if (!templateBuffer) {
    try {
      templateBuffer = await readFile(
        path.join(process.cwd(), "templates", "MLS-11-06.xlsx")
      );
    } catch {
      templateBuffer = null;
    }
  }
  let workbook: ExcelJS.Workbook;
  if (templateBuffer) {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer as unknown as ArrayBuffer);
  } else {
    // KHÔNG còn báo lỗi ở đây nữa. Trước đây thiếu tệp là trả về một trang trắng
    // in mỗi dòng chữ lỗi — mà "thiếu tệp" lại là trạng thái MẶC ĐỊNH của mọi
    // bản cài mới, vì tệp biểu mẫu là tài liệu nội bộ nên không đi theo mã nguồn.
    // Nay tự dựng bảng có cùng bố cục để người dùng vẫn lấy được số liệu ngay;
    // nạp tệp gốc ở Mua sắm → Biểu mẫu thì bản in trở lại đúng form chính thức.
    const chuan = await prisma.formStandard.findUnique({
      where: { code: vessel.formStandard },
      select: { companyName: true },
    });
    workbook = dungBieuMauKiemKe({
      companyName: chuan?.companyName ?? "",
      maBieuMau: MA_BIEU_MAU_KIEM_KE,
    });
  }
  const laBanTuDung = !templateBuffer;
  const ws = workbook.worksheets[0];

  const typeLabels: Record<string, string> = {
    ALL: "Tất cả (Store & Spare)",
    STORE: "Vật tư (Store)",
    SPARE: "Phụ tùng (Spare)",
  };
  // A7:B7 là nhãn "Vsl./Tàu:" (merge) — tên tàu điền vào vùng C7:D7.
  ws.getCell("C7").value = vessel.name;
  // Ngày của tờ kiểm kê = hết kỳ (kỳ đang chạy: hôm nay), giờ Việt Nam. exceljs quy
  // đổi Date theo UTC — dùng nửa đêm UTC của đúng ngày đó để Excel hiện đúng ngày.
  const ngayTo = ngayCuaVN(new Date(Math.min(ky.ketThuc.getTime() - 1, now.getTime())));
  ws.getCell("H7").value = new Date(Date.UTC(ngayTo.nam, ngayTo.thang - 1, ngayTo.ngay));
  ws.getCell("C8").value = BO_PHAN[dept].nhan ? `${BO_PHAN[dept].nhan} · ${typeLabels[type]}` : typeLabels[type];
  ws.getCell("H8").value = tenKyThang(kyChon.tu, kyChon.den);

  // Điền dòng bằng hàm dùng chung với bản tự dựng (lib/bieuMauKiemKe.ts): nó
  // biết biểu mẫu chừa sẵn 24 dòng, tự dời khối chữ ký khi bảng dài hơn, và ép
  // mọi dòng — kể cả dòng thêm — về cùng một kiểu viền/phông lấy từ dòng mẫu.
  // Cách cũ dùng insertRows cho ra dòng thêm không viền và ô gộp chữ ký đứng
  // nguyên chỗ cũ.
  const { dongChuKyCuoi } = dienDongKiemKe(ws, rows);
  if (laBanTuDung) ghiChuBanTuDung(ws, dongChuKyCuoi);

  const buffer = await workbook.xlsx.writeBuffer();
  const dateStr = kyChon.tu.nam === kyChon.den.nam && kyChon.tu.thang === kyChon.den.thang
    ? `${kyChon.tu.nam}-${String(kyChon.tu.thang).padStart(2, "0")}`
    : `${kyChon.tu.nam}-${String(kyChon.tu.thang).padStart(2, "0")}_${kyChon.den.nam}-${String(kyChon.den.thang).padStart(2, "0")}`;
  // Mã tàu là chữ tự do (có thể chứa ký tự Việt) — phải làm sạch cho header ASCII,
  // kèm filename* RFC 5987 giữ tên đầy đủ (như route tải tài liệu).
  const safeCode =
    vessel.code.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") ||
    String(vessel.id);
  const asciiName = `MLS-11-06_${safeCode}_${dateStr}.xlsx`;
  const utf8Name = encodeURIComponent(
    `MLS-11-06_${vessel.code}_${dateStr}.xlsx`
  );
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
