"use client";

import { useActionState, useState } from "react";
import { khaiVatTuMoiChoTau } from "@/app/actions";
import { BO_PHAN, CHUC_DANH, type BoPhan } from "@/lib/maVatTu";
import { chucDanhTheoNhomThietBi } from "@/lib/chucDanhChiuTrachNhiem";
import { boPhanCuaChucDanh } from "@/lib/vatTuMoiChoTau";
import { useNgonNgu } from "@/lib/i18n/client";

type NhomOption = { id: number; name: string; code: string };

/**
 * Khai một mặt hàng MỚI (chưa có trong danh mục gốc) ngay tại danh mục của một
 * tàu — xem lib/vatTuMoiChoTau.ts về lý do và quy tắc.
 *
 * Thứ tự ô trên form đi theo cách người ta nghĩ về một món hàng mới trên tàu:
 * AI giữ → thuộc BỘ PHẬN nào (tự theo chức danh, chỉ mở ra bộ phận kiêm nhiệm
 * khi có) → là vật tư hay phụ tùng → rồi mới tới tên và các mã. Mã vật tư KHÔNG
 * nhập tay: hệ thống cấp theo khuôn `[bộ phận]-IMPA/SPR-####` — form chỉ cho
 * xem trước phần khuôn để người khai biết mã sẽ ra dạng gì.
 */
export default function VatTuMoiChoTauForm({
  vesselId,
  vesselName,
  categories,
  chucDanhMacDinh,
}: {
  vesselId: number;
  vesselName: string;
  categories: NhomOption[];
  /** Chức danh của chính người đang đăng nhập — điền sẵn, đổi được. */
  chucDanhMacDinh: string | null;
}) {
  const { t, tenChucDanh, tenBoPhan } = useNgonNgu();
  const [state, formAction, pending] = useActionState(khaiVatTuMoiChoTau, {
    message: "",
  });
  // Sau khi action chạy xong React tự reset form: các ô gõ tay lấy lại giá trị
  // từ state.values (có khi lỗi, không có khi thành công → ô trống sẵn cho món
  // kế tiếp). Ba ô chọn ở đầu là state React nên giữ nguyên qua nhiều lần khai
  // — máy hai khai 5 phụ tùng máy đèn liền nhau không phải chọn lại 5 lần.
  const v = state.values ?? {};
  const [rank, setRank] = useState(v.rankCode || chucDanhMacDinh || "");
  const boPhanChoPhep = boPhanCuaChucDanh(rank);
  const [boPhan, setBoPhan] = useState<string>(
    v.boPhan || boPhanChoPhep[0] || ""
  );
  const [loai, setLoai] = useState(
    v.materialType === "SPARE" ? "SPARE" : "STORE"
  );
  const [nhom, setNhom] = useState(v.categoryId ?? "");

  const doiChucDanh = (ma: string) => {
    setRank(ma);
    const duoc = boPhanCuaChucDanh(ma);
    if (!duoc.includes(boPhan as BoPhan)) setBoPhan(duoc[0] ?? "");
  };
  const laPhuTung = loai === "SPARE";
  const nhomDangChon = categories.find((c) => String(c.id) === String(nhom));
  const goiY = chucDanhTheoNhomThietBi(nhomDangChon?.code);
  const lechGoiY = goiY && rank && goiY !== rank;
  const khuonMa = `${boPhan || "?"}-${laPhuTung ? "SPR" : "IMPA"}-####`;

  const o = "w-full rounded border border-slate-300 p-2 text-sm";
  const nhan = "mb-1 block text-xs font-medium text-slate-600";

  // Mục gập, mặc định đóng: đa số lần vào trang chỉ chọn từ danh mục gốc.
  // Không cần tự mở khi có thông báo — form nằm trong mục nên chỉ gửi được
  // khi mục đang mở, và thông báo hiện ngay tại chỗ vừa bấm.
  return (
    <details className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/60">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-blue-800 hover:text-blue-950">
        ＋ {t("materials.khaiMoiTieuDe", { tau: vesselName })}
      </summary>
      <form action={formAction} className="space-y-3 border-t border-slate-200 p-4">
        <input type="hidden" name="vesselId" value={vesselId} />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className={nhan}>
              {t("materials.chucDanhGiuKiemKe")} *
            </label>
            <select
              name="rankCode"
              value={rank}
              onChange={(e) => doiChucDanh(e.target.value)}
              required
              className={o}
            >
              <option value="">{t("materials.optChonChucDanh")}</option>
              {(Object.keys(BO_PHAN) as BoPhan[]).map((bp) => (
                <optgroup key={bp} label={tenBoPhan(bp)}>
                  {Object.entries(CHUC_DANH)
                    .filter(([, cd]) => cd.boPhan === bp)
                    .map(([ma]) => (
                      <option key={ma} value={ma}>
                        {tenChucDanh(ma)} ({ma})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className={nhan}>{t("materials.boPhanTheoChucDanh")}</label>
            <select
              name="boPhan"
              value={boPhan}
              onChange={(e) => setBoPhan(e.target.value)}
              disabled={boPhanChoPhep.length <= 1}
              className={`${o} disabled:bg-slate-100 disabled:text-slate-500`}
            >
              {boPhanChoPhep.length === 0 && <option value="">—</option>}
              {boPhanChoPhep.map((bp, i) => (
                <option key={bp} value={bp}>
                  {tenBoPhan(bp)} ({bp})
                  {i > 0 ? ` — ${t("materials.kiemNhiem")}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={nhan}>{t("materials.loai")}</label>
            <select
              name="materialType"
              value={loai}
              onChange={(e) => setLoai(e.target.value)}
              className={o}
            >
              <option value="STORE">{t("materials.loaiStoreImpa")}</option>
              <option value="SPARE">{t("materials.loaiSpareSpr")}</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          {t("materials.maTuDongTheoKhuon")}{" "}
          <span className="font-mono font-medium text-slate-700">{khuonMa}</span>
          {t("materials.maTuDongSoThuTu")}
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className={nhan}>{t("materials.tenMatHangVi")} *</label>
            <input
              name="nameVn"
              defaultValue={v.nameVn ?? ""}
              required
              className={o}
              placeholder={
                laPhuTung
                  ? t("materials.vdVoiPhun")
                  : t("materials.vdGangTay")
              }
            />
          </div>
          <div>
            <label className={nhan}>{t("materials.tenTiengAnh")}</label>
            <input
              name="nameEn"
              defaultValue={v.nameEn ?? ""}
              className={o}
              placeholder={laPhuTung ? "Fuel injector nozzle" : "Welding leather gloves"}
            />
          </div>
        </div>

        {laPhuTung ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className={nhan}>{t("materials.thietBiMay")} *</label>
              <input
                name="equipment"
                defaultValue={v.equipment ?? ""}
                required
                className={o}
                placeholder={t("materials.vdMayDen")}
              />
            </div>
            <div>
              <label className={nhan}>Part No.</label>
              <input name="partNumber" defaultValue={v.partNumber ?? ""} className={o} />
            </div>
            <div>
              <label className={nhan}>Maker</label>
              <input name="manufacturer" defaultValue={v.manufacturer ?? ""} className={o} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={nhan}>{t("materials.maImpaNeuCo")}</label>
              <input
                name="impa"
                defaultValue={v.impa ?? ""}
                className={o}
                placeholder={t("materials.phSauChuSo")}
              />
            </div>
            <div>
              <label className={nhan}>{t("materials.makerHang")}</label>
              <input name="manufacturer" defaultValue={v.manufacturer ?? ""} className={o} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="col-span-2">
            <label className={nhan}>{t("materials.nhomThietBi")}</label>
            <select
              name="categoryId"
              value={nhom}
              onChange={(e) => setNhom(e.target.value)}
              className={o}
            >
              <option value="">{t("materials.optChuaXepNhom")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {lechGoiY && (
              <p className="mt-1 text-xs text-amber-700">
                {t("materials.nhomThuongDo")}{" "}
                <b>
                  {tenChucDanh(goiY)} ({goiY})
                </b>{" "}
                {t("materials.nhomThuongDoDuoi", { ten: tenChucDanh(rank) })}
              </p>
            )}
          </div>
          <div>
            <label className={nhan}>{t("chung.donVi")}</label>
            <input name="uom" defaultValue={v.uom ?? "PCS"} className={o} />
          </div>
          <div>
            <label className={nhan}>{t("materials.tonToiThieu")}</label>
            <input
              name="minStock"
              type="number"
              step="0.01"
              min="0"
              defaultValue={v.minStock ?? "0"}
              className={o}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isCritical"
              defaultChecked={v.isCritical === "on"}
            />
            {t("materials.thietYeuCritical")}
          </label>
          <button
            disabled={pending || !rank}
            className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {pending ? t("chung.dangLuu") : t("materials.nutKhaiMoi")}
          </button>
        </div>

        {state.message && (
          <p
            className={`rounded px-3 py-2 text-sm ${
              state.success
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-700"
            }`}
          >
            {state.message}
          </p>
        )}
      </form>
    </details>
  );
}
