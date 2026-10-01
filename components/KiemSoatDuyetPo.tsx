"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CornerUpLeft, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { duyetDonMua } from "@/app/don-mua-actions";
import { chiDinhLanhDaoDuyet, taoUyQuyenDuyetPo } from "@/app/duyet-po-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Field, Input, Notice, Select } from "@/components/ui";

type NguoiChon = { id: number; name: string; role: string };

/**
 * Duyệt nhanh một PO ngay trong danh sách chờ duyệt: Duyệt (xác nhận một lần)
 * hoặc Trả lại (mở ô lý do — bắt buộc). Muốn xem kỹ dòng hàng thì mở PO.
 */
export function DuyetNhanhPo({ poId, poNo }: { poId: number; poNo: string }) {
  const { t } = useNgonNgu();
  const router = useRouter();
  const [moTraLai, setMoTraLai] = useState(false);
  const [lyDo, setLyDo] = useState("");
  const [loi, setLoi] = useState("");
  const [dang, startT] = useTransition();
  const goi = (dongY: boolean) =>
    startT(async () => {
      const r = await duyetDonMua(poId, dongY, dongY ? "" : lyDo);
      if (r.success) {
        setMoTraLai(false);
        setLyDo("");
        setLoi("");
        router.refresh();
      } else setLoi(r.message);
    });
  return (
    <div className="flex min-w-[13rem] flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="primary"
          loading={dang && !moTraLai}
          disabled={dang}
          icon={<Check className="size-4" />}
          onClick={() => {
            if (window.confirm(t("purchasing.xacNhanDuyetNhanh", { po: poNo }))) goi(true);
          }}
        >
          {t("purchasing.nutDuyetDon")}
        </Button>
        <Button type="button" size="sm" variant="danger" disabled={dang} icon={<CornerUpLeft className="size-4" />} onClick={() => setMoTraLai((x) => !x)}>
          {t("purchasing.nutTraLai")}
        </Button>
      </div>
      {moTraLai && (
        <div className="flex gap-1.5">
          <Input value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder={t("purchasing.lyDoTraLaiGoiY")} aria-label={t("purchasing.ghiChuDuyet")} />
          <Button type="button" size="sm" variant="danger" loading={dang} disabled={!lyDo.trim()} onClick={() => goi(false)}>
            {t("purchasing.guiTraLai")}
          </Button>
        </div>
      )}
      {loi && <span className="text-xs text-[var(--text-danger)]">{loi}</span>}
    </div>
  );
}

/** Lãnh đạo phòng KT-VT ủy quyền duyệt PO (quản trị lập hộ được, chọn lãnh đạo giao quyền). */
export function LapUyQuyenDuyetPo({ lanhDao, nguoiNhan, laAdmin }: { lanhDao: NguoiChon[]; nguoiNhan: NguoiChon[]; laAdmin: boolean }) {
  const { t, tTuDo } = useNgonNgu();
  const [state, formAction, pending] = useActionState(taoUyQuyenDuyetPo, { message: "" });
  const homNay = new Date().toISOString().slice(0, 10);
  return (
    <form action={formAction} className="space-y-3">
      {laAdmin && (
        <Field label={`${t("purchasing.uqLanhDaoGiao")} *`}>
          <Select name="delegatorId" required defaultValue="">
            <option value="" disabled>
              {t("purchasing.uqChonLanhDao")}
            </option>
            {lanhDao.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={`${t("vessels.cotNguoiNhan")} *`}>
        <Select name="delegateId" required defaultValue="">
          <option value="" disabled>
            {t("vessels.chonNguoiNhan")}
          </option>
          {nguoiNhan.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {tTuDo(`labels.role_${u.role}`)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`${t("vessels.tuNgay")} *`}>
          <Input type="date" name="startAt" required defaultValue={homNay} />
        </Field>
        <Field label={`${t("vessels.denHetNgay")} *`}>
          <Input type="date" name="endAt" required />
        </Field>
      </div>
      <Field label={t("vessels.cotLyDo")}>
        <Input name="reason" placeholder={t("purchasing.uqLyDoGoiY")} />
      </Field>
      <Button type="submit" variant="primary" loading={pending} icon={<ShieldCheck className="size-4" />}>
        {t("purchasing.nutUyQuyenDuyetPo")}
      </Button>
      {state.message && <Notice tone={state.success ? "success" : "danger"}>{state.message}</Notice>}
    </form>
  );
}

/** Quản trị chỉ định thêm một lãnh đạo phòng KT-VT (người duyệt PO). */
export function ChiDinhLanhDaoForm({ ungVien }: { ungVien: NguoiChon[] }) {
  const { t, tTuDo } = useNgonNgu();
  const [state, formAction, pending] = useActionState(chiDinhLanhDaoDuyet, { message: "" });
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="bat" value="1" />
      <div className="flex flex-wrap gap-2">
        <div className="min-w-0 flex-1">
          <Select name="userId" required defaultValue="" aria-label={t("purchasing.chonNguoiChiDinh")}>
            <option value="" disabled>
              {t("purchasing.chonNguoiChiDinh")}
            </option>
            {ungVien.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {tTuDo(`labels.role_${u.role}`)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="primary" loading={pending} icon={<UserPlus className="size-4" />}>
          {t("purchasing.nutChiDinh")}
        </Button>
      </div>
      {state.message && <Notice tone={state.success ? "success" : "danger"}>{state.message}</Notice>}
    </form>
  );
}

/** Bỏ chỉ định một lãnh đạo phòng KT-VT. */
export function BoChiDinhLanhDao({ userId, ten }: { userId: number; ten: string }) {
  const { t } = useNgonNgu();
  const [state, formAction, pending] = useActionState(chiDinhLanhDaoDuyet, { message: "" });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(t("purchasing.xacNhanBoChiDinh", { ten }))) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="bat" value="0" />
      <Button type="submit" size="sm" variant="danger" loading={pending} icon={<UserMinus className="size-4" />}>
        {t("purchasing.nutBoChiDinh")}
      </Button>
      {state.message && !state.success && <span className="ml-2 text-xs text-[var(--text-danger)]">{state.message}</span>}
    </form>
  );
}
