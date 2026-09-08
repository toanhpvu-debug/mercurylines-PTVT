"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { khaiVatTuMoiChoTau } from "@/app/actions";
import { BO_PHAN, CHUC_DANH, type BoPhan } from "@/lib/maVatTu";
import { chucDanhTheoNhomThietBi } from "@/lib/chucDanhChiuTrachNhiem";
import { boPhanCuaChucDanh } from "@/lib/vatTuMoiChoTau";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";

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

  // Mục gập, mặc định đóng: đa số lần vào trang chỉ chọn từ danh mục gốc.
  // Không cần tự mở khi có thông báo — form nằm trong mục nên chỉ gửi được
  // khi mục đang mở, và thông báo hiện ngay tại chỗ vừa bấm.
  return (
    <details className="surface mt-4 overflow-hidden rounded-xl border">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-brand-700 hover:bg-[var(--surface-sunken)] dark:text-brand-300">
        <span className="inline-flex items-center gap-2">
          <Plus className="size-4" />
          {t("materials.khaiMoiTieuDe", { tau: vesselName })}
        </span>
      </summary>
      <form
        action={formAction}
        className="space-y-4 border-t border-[var(--border-subtle)] p-4"
      >
        <input type="hidden" name="vesselId" value={vesselId} />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label={`${t("materials.chucDanhGiuKiemKe")} *`}>
            <Select
              name="rankCode"
              value={rank}
              onChange={(e) => doiChucDanh(e.target.value)}
              required
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
            </Select>
          </Field>
          <Field label={t("materials.boPhanTheoChucDanh")}>
            <Select
              name="boPhan"
              value={boPhan}
              onChange={(e) => setBoPhan(e.target.value)}
              disabled={boPhanChoPhep.length <= 1}
            >
              {boPhanChoPhep.length === 0 && <option value="">—</option>}
              {boPhanChoPhep.map((bp, i) => (
                <option key={bp} value={bp}>
                  {tenBoPhan(bp)} ({bp})
                  {i > 0 ? ` — ${t("materials.kiemNhiem")}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("materials.loai")}>
            <Select
              name="materialType"
              value={loai}
              onChange={(e) => setLoai(e.target.value)}
            >
              <option value="STORE">{t("materials.loaiStoreImpa")}</option>
              <option value="SPARE">{t("materials.loaiSpareSpr")}</option>
            </Select>
          </Field>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          {t("materials.maTuDongTheoKhuon")}{" "}
          <span className="font-display text-xs tracking-wide text-[var(--text-primary)]">
            {khuonMa}
          </span>
          {t("materials.maTuDongSoThuTu")}
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={`${t("materials.tenMatHangVi")} *`}>
            <Input
              name="nameVn"
              defaultValue={v.nameVn ?? ""}
              required
              placeholder={
                laPhuTung
                  ? t("materials.vdVoiPhun")
                  : t("materials.vdGangTay")
              }
            />
          </Field>
          <Field label={t("materials.tenTiengAnh")}>
            <Input
              name="nameEn"
              defaultValue={v.nameEn ?? ""}
              placeholder={laPhuTung ? "Fuel injector nozzle" : "Welding leather gloves"}
            />
          </Field>
        </div>

        {laPhuTung ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label={`${t("materials.thietBiMay")} *`}>
              <Input
                name="equipment"
                defaultValue={v.equipment ?? ""}
                required
                placeholder={t("materials.vdMayDen")}
              />
            </Field>
            <Field label="Part No.">
              <Input name="partNumber" defaultValue={v.partNumber ?? ""} />
            </Field>
            <Field label="Maker">
              <Input name="manufacturer" defaultValue={v.manufacturer ?? ""} />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={t("materials.maImpaNeuCo")}>
              <Input
                name="impa"
                defaultValue={v.impa ?? ""}
                placeholder={t("materials.phSauChuSo")}
              />
            </Field>
            <Field label={t("materials.makerHang")}>
              <Input name="manufacturer" defaultValue={v.manufacturer ?? ""} />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field
            className="col-span-2"
            label={t("materials.nhomThietBi")}
            hint={
              lechGoiY ? (
                <span className="text-[var(--text-warning)]">
                  {t("materials.nhomThuongDo")}{" "}
                  <b>
                    {tenChucDanh(goiY)} ({goiY})
                  </b>{" "}
                  {t("materials.nhomThuongDoDuoi", { ten: tenChucDanh(rank) })}
                </span>
              ) : undefined
            }
          >
            <Select
              name="categoryId"
              value={nhom}
              onChange={(e) => setNhom(e.target.value)}
            >
              <option value="">{t("materials.optChuaXepNhom")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("chung.donVi")}>
            <Input name="uom" defaultValue={v.uom ?? "PCS"} />
          </Field>
          <Field label={t("materials.tonToiThieu")}>
            <Input
              name="minStock"
              type="number"
              step="0.01"
              min="0"
              defaultValue={v.minStock ?? "0"}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              name="isCritical"
              defaultChecked={v.isCritical === "on"}
              className="size-4 accent-brand-600"
            />
            {t("materials.thietYeuCritical")}
          </label>
          <Button
            type="submit"
            variant="primary"
            loading={pending}
            disabled={!rank}
            icon={<Plus className="size-4" />}
          >
            {pending ? t("chung.dangLuu") : t("materials.nutKhaiMoi")}
          </Button>
        </div>

        {state.message && (
          <Notice tone={state.success ? "success" : "danger"}>
            {state.message}
          </Notice>
        )}
      </form>
    </details>
  );
}
