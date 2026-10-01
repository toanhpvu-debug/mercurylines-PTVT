"use client";

import { useEffect, useState } from "react";
import { useNgonNgu } from "@/lib/i18n/client";
import type { LoaiGiaoDich1101 } from "@/lib/baoCao1101";

export type DongPhuLuc1101 = {
  id: number;
  ngay: string;
  ma: string;
  ten: string;
  donVi: string;
  loai: LoaiGiaoDich1101;
  /** Nhận / dùng: số dương; điều chỉnh kiểm kê: có dấu. */
  so: number;
  nguon: string;
  nguoi: string;
  kho: string;
};

const NHAN_LOAI: Record<LoaiGiaoDich1101, string> = {
  NHAN: "Nhận / Received",
  DUNG: "Dùng / Used",
  KIEM_KE: "Kiểm kê / Adjust",
};
const O = "border border-black p-1";

/**
 * Phụ lục của MLS-11-01: từng lần nhập / xuất / điều chỉnh kiểm kê trong tháng,
 * theo thời gian — nguồn nhận (PO / phiếu giao), ghi chú xuất dùng, người thực
 * hiện — để đối chiếu từng con số trên báo cáo. Có ô "In kèm": bật thì in ngay
 * sau báo cáo, sang trang mới; lựa chọn nhớ trên máy này.
 */
export default function PhuLuc1101({ dong, tenTau, thang }: { dong: DongPhuLuc1101[]; tenTau: string; thang: string }) {
  const { t } = useNgonNgu();
  const [inKem, setInKem] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        setInKem(window.localStorage.getItem("mercury.bao-cao-1101.in-phu-luc") === "1");
      } catch {
        /* localStorage bị chặn */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  const doiInKem = (v: boolean) => {
    setInKem(v);
    try {
      window.localStorage.setItem("mercury.bao-cao-1101.in-phu-luc", v ? "1" : "0");
    } catch {
      /* bỏ qua */
    }
  };

  return (
    <div className="space-y-2">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{t("inventory.phuLucTieuDe", { n: dong.length })}</p>
          <p className="text-xs text-[var(--text-muted)]">{t("inventory.phuLucMoTa")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" className="size-4 accent-brand-600" checked={inKem} onChange={(e) => doiInKem(e.target.checked)} />
          {t("inventory.inKemPhuLuc")}
        </label>
      </div>
      <div className={`print-area surface overflow-x-auto rounded-xl border p-6 shadow-sm print:break-before-page print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none ${inKem ? "" : "no-print"}`}>
        <p className="text-center text-sm font-bold">CHI TIẾT NHẬP / XUẤT TRONG THÁNG — TRANSACTIONS OF THE MONTH</p>
        <p className="mb-2 text-center text-xs">
          Tên tàu (Ships name): {tenTau} · Tháng (Month): {thang}
        </p>
        {dong.length === 0 ? (
          <p className="text-center text-sm">{t("inventory.phuLucTrong")}</p>
        ) : (
          <table className="w-full border-2 border-black text-xs">
            <thead>
              <tr className="text-center">
                <th className={O}>Ngày / Date</th>
                <th className={O}>Mã / Code</th>
                <th className={O}>Tên vật tư / Material</th>
                <th className={O}>Loại / Type</th>
                <th className={O}>S.Lượng / Q.ty</th>
                <th className={O}>Nguồn – ghi chú / Source – note</th>
                <th className={O}>Kho / Store</th>
                <th className={O}>Người thực hiện / By</th>
              </tr>
            </thead>
            <tbody>
              {dong.map((d) => (
                <tr key={d.id} className="align-top">
                  <td className={`${O} whitespace-nowrap text-center`}>{d.ngay}</td>
                  <td className={`${O} whitespace-nowrap`}>{d.ma}</td>
                  <td className={O}>{d.ten}</td>
                  <td className={`${O} whitespace-nowrap`}>{NHAN_LOAI[d.loai]}</td>
                  <td className={`${O} whitespace-nowrap text-right`}>
                    {d.loai === "KIEM_KE" && d.so > 0 ? "+" : ""}
                    {Math.round(d.so * 1000) / 1000} {d.donVi}
                  </td>
                  <td className={O}>{d.nguon}</td>
                  <td className={`${O} whitespace-nowrap`}>{d.kho}</td>
                  <td className={O}>{d.nguoi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
