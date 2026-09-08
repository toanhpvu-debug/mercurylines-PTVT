import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  danhTinhHieuLuc,
  requireScopedUser,
  vesselIdWhere,
  vesselScopeDayDu,
} from "@/lib/auth";
import { VAN_HANH_HOA_CHAT, nhomNhienLieuChoPhep } from "@/lib/roles";
import {
  CONSUMABLE_CATEGORIES,
  NGUONG_CANH_BAO_HAN_DUNG,
  soNgayToi,
} from "@/lib/consumables";
import { layT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ConsumablesPage() {
  const user = await requireScopedUser();
  const { t, tTuDo, ngay } = await layT();
  const scope = vesselScopeDayDu(user);
  // Nút này dẫn sang TRANG /consumables/products nên phải khớp ĐÚNG cổng của
  // trang đó — cả nhóm vai trò (VAN_HANH_HOA_CHAT) lẫn cách tính danh tính
  // (danhTinhHieuLuc). Liệt kê tay ở đây bỏ sót MÁY TRƯỞNG và đại phó nên họ
  // không thấy lối vào danh mục dù gõ URL thì server vẫn cho vào; ngược lại
  // nếu chỗ này tính vai trò mượn mà trang đích đọc user.role thô thì người
  // nhận ủy quyền thấy nút, bấm vào bị đá ngược về đây, không một dòng báo.
  // Đổi một phía là tạo lại đúng lỗi đó ở chiều kia, nên hai phía sửa cùng lúc.
  const canManageCatalog = danhTinhHieuLuc(user).some((d) =>
    VAN_HANH_HOA_CHAT.includes(d.role)
  );

  const [vessels, products, stocks, receipts] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
    }),
    prisma.consumableProduct.findMany({ where: { isActive: true } }),
    prisma.consumableStock.findMany({ include: { product: true } }),
    prisma.consumableReceipt.findMany({
      include: { product: true },
      orderBy: { receivedAt: "desc" },
    }),
  ]);

  const idTau = new Set(vessels.map((v) => v.id));
  const stocksTrongPhamVi = stocks.filter((s) => idTau.has(s.vesselId));
  const receiptsTrongPhamVi = receipts.filter((r) => idTau.has(r.vesselId));

  const duoiDinhMuc = stocksTrongPhamVi.filter(
    (s) => s.minQty > 0 && s.quantity < s.minQty
  );
  const sapHetHan = receiptsTrongPhamVi.filter((r) => {
    const con = soNgayToi(r.expiryDate);
    return con !== null && con <= NGUONG_CANH_BAO_HAN_DUNG;
  });

  // Lô dầu vượt giới hạn ECA — số này cho biết còn bao nhiêu lô không dùng được
  // trong vùng kiểm soát khí thải.
  const loVuotEca = receiptsTrongPhamVi.filter(
    (r) => r.sulphur !== null && r.sulphur > 0.1
  );

  const theoTau = vessels.map((v) => {
    const st = stocksTrongPhamVi.filter((s) => s.vesselId === v.id);
    return {
      v,
      soMatHang: st.length,
      thieu: st.filter((s) => s.minQty > 0 && s.quantity < s.minQty).length,
      soPhieu: receiptsTrongPhamVi.filter((r) => r.vesselId === v.id).length,
      ganNhat: receiptsTrongPhamVi.find((r) => r.vesselId === v.id)?.receivedAt,
      nhomGhiDuoc: nhomNhienLieuChoPhep(user, v.id).length,
    };
  });

  const soTheoNhom = CONSUMABLE_CATEGORIES.map((c) => ({
    ...c,
    soMatHang: products.filter((p) => p.category === c.value).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-blue-950">
            {t("consumables.tieuDe")}
          </h2>
          <p className="text-slate-600">{t("consumables.moTa")}</p>
        </div>
        {canManageCatalog && (
          <Link
            href="/consumables/products"
            className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800"
          >
            {t("consumables.nutDanhMuc", { n: products.length })}
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {soTheoNhom.map((c) => (
          <div
            key={c.value}
            className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100"
          >
            <p className="text-xs font-medium uppercase text-slate-500">
              {c.icon} {tTuDo(`consumables.nhom_${c.value}`)}
            </p>
            <p className="text-2xl font-bold text-blue-950">{c.soMatHang}</p>
            <p className="text-xs text-slate-500">
              {t("consumables.matHangTrongDanhMuc")}
            </p>
          </div>
        ))}
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          <p className="text-xs font-medium uppercase text-slate-500">
            {t("consumables.canChuY")}
          </p>
          <p className="text-2xl font-bold text-blue-950">
            {duoiDinhMuc.length + sapHetHan.length}
          </p>
          <p className="text-xs text-slate-500">
            {t("consumables.tomTatCanChuY", {
              duoi: duoiDinhMuc.length,
              han: sapHetHan.length,
            })}
          </p>
        </div>
      </div>

      {loVuotEca.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <b>{t("consumables.ecaDam", { n: loVuotEca.length })}</b>{" "}
          {t("consumables.ecaSau")}
        </div>
      )}

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-3 text-lg font-semibold text-blue-950">
          {t("consumables.theoTau")}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                <th className="p-2">{t("consumables.cotMaTau")}</th>
                <th className="p-2">{t("consumables.cotTenTau")}</th>
                <th className="p-2 text-right">
                  {t("consumables.cotMatHangCoTon")}
                </th>
                <th className="p-2 text-right">
                  {t("consumables.cotDuoiDinhMuc")}
                </th>
                <th className="p-2 text-right">
                  {t("consumables.cotPhieuNhan")}
                </th>
                <th className="p-2">{t("consumables.cotNhanGanNhat")}</th>
                <th className="p-2">{t("consumables.cotQuyenCuaBan")}</th>
              </tr>
            </thead>
            <tbody>
              {theoTau.map((dong) => (
                <tr key={dong.v.id} className="border-b">
                  <td className="p-2 font-medium">
                    <Link
                      href={`/consumables/${dong.v.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {dong.v.code}
                    </Link>
                  </td>
                  <td className="p-2">
                    <Link
                      href={`/consumables/${dong.v.id}`}
                      className="font-medium text-blue-900 hover:underline"
                    >
                      {dong.v.name}
                    </Link>
                  </td>
                  <td className="p-2 text-right">{dong.soMatHang}</td>
                  <td className="p-2 text-right">
                    {dong.thieu > 0 ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                        {dong.thieu}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 text-right">{dong.soPhieu}</td>
                  <td className="p-2 text-slate-600">
                    {dong.ganNhat ? ngay(dong.ganNhat) : "—"}
                  </td>
                  <td className="p-2 text-xs text-slate-600">
                    {dong.nhomGhiDuoc > 0
                      ? t("consumables.ghiDuocNNhom", { n: dong.nhomGhiDuoc })
                      : t("consumables.chiXem")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {t("consumables.chuThichQuyenGhi")}
      </p>
    </div>
  );
}
