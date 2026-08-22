import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselIdWhere, vesselScope } from "@/lib/auth";
import { nhomNhienLieuChoPhep } from "@/lib/roles";
import {
  CATEGORY_ICON,
  CONSUMABLE_CATEGORIES,
  NGUONG_CANH_BAO_HAN_DUNG,
  soNgayToi,
} from "@/lib/consumables";

export const dynamic = "force-dynamic";

export default async function ConsumablesPage() {
  const user = await requireScopedUser();
  const scope = vesselScope(user);
  const canManageCatalog = ["ADMIN", "MASTER"].includes(user.role);

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
            Dầu · Dầu nhờn · Hóa chất
          </h2>
          <p className="text-slate-600">
            Nhận theo BDN / phiếu giao · tồn từng tàu · tiêu thụ theo M/E, A/E,
            nồi hơi · lưu huỳnh MARPOL · mẫu dầu · hạn dùng hóa chất
          </p>
        </div>
        {canManageCatalog && (
          <Link
            href="/consumables/products"
            className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800"
          >
            Danh mục dầu &amp; hóa chất ({products.length})
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
              {c.icon} {c.label}
            </p>
            <p className="text-2xl font-bold text-blue-950">{c.soMatHang}</p>
            <p className="text-xs text-slate-500">mặt hàng trong danh mục</p>
          </div>
        ))}
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
          <p className="text-xs font-medium uppercase text-slate-500">
            ⚠️ Cần chú ý
          </p>
          <p className="text-2xl font-bold text-blue-950">
            {duoiDinhMuc.length + sapHetHan.length}
          </p>
          <p className="text-xs text-slate-500">
            {duoiDinhMuc.length} dưới định mức · {sapHetHan.length} sắp/đã hết hạn
          </p>
        </div>
      </div>

      {loVuotEca.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <b>{loVuotEca.length} lô dầu có lưu huỳnh trên 0,10%</b> — không dùng
          được trong vùng kiểm soát khí thải (ECA) nếu tàu không có hệ thống lọc
          khí thải. MARPOL Annex VI Reg 14.
        </div>
      )}

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-blue-100">
        <h3 className="mb-3 text-lg font-semibold text-blue-950">Theo tàu</h3>
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="border-b border-blue-200 bg-blue-50 text-left text-blue-950">
                <th className="p-2">Mã tàu</th>
                <th className="p-2">Tên tàu</th>
                <th className="p-2 text-right">Mặt hàng có tồn</th>
                <th className="p-2 text-right">Dưới định mức</th>
                <th className="p-2 text-right">Phiếu nhận</th>
                <th className="p-2">Nhận gần nhất</th>
                <th className="p-2">Quyền của bạn</th>
              </tr>
            </thead>
            <tbody>
              {theoTau.map((t) => (
                <tr key={t.v.id} className="border-b">
                  <td className="p-2 font-medium">
                    <Link
                      href={`/consumables/${t.v.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {t.v.code}
                    </Link>
                  </td>
                  <td className="p-2">{t.v.name}</td>
                  <td className="p-2 text-right">{t.soMatHang}</td>
                  <td className="p-2 text-right">
                    {t.thieu > 0 ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                        {t.thieu}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 text-right">{t.soPhieu}</td>
                  <td className="p-2 text-slate-600">
                    {t.ganNhat ? t.ganNhat.toLocaleDateString("vi-VN") : "—"}
                  </td>
                  <td className="p-2 text-xs text-slate-600">
                    {t.nhomGhiDuoc > 0
                      ? `ghi được ${t.nhomGhiDuoc}/3 nhóm`
                      : "chỉ xem"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {CATEGORY_ICON.FUEL} Dầu đốt và {CATEGORY_ICON.LUBE} dầu nhờn thuộc buồng
        máy — máy trưởng ghi. {CATEGORY_ICON.CHEMICAL} Hóa chất thì cả máy trưởng
        (nồi hơi, nước làm mát, xử lý dầu) và đại phó (tẩy rửa, vệ sinh hầm hàng)
        cùng ghi được.
      </p>
    </div>
  );
}
