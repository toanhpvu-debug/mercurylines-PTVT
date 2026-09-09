"use client";

import { useActionState, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { taoYeuCauSon } from "@/app/paint-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import {
  Button,
  Field,
  Input,
  Notice,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui";

export type PaintRequestLine = {
  productId: number;
  label: string;
  uom: string;
  /** Tồn hiện tại trên tàu. */
  ton: number;
  /** Định mức tối thiểu, 0 = chưa đặt. */
  minQty: number;
};

/**
 * Lập yêu cầu cấp sơn gửi lên phê duyệt.
 *
 * Đề xuất sẵn phần thiếu so với định mức (min − tồn) cho những loại đang dưới
 * mức, còn lại để trống. Đây là lý do thường gặp nhất để xin sơn, gõ lại từng
 * số vừa mất công vừa dễ sai.
 */
export default function PaintRequestForm({
  vesselId,
  lines,
}: {
  vesselId: number;
  lines: PaintRequestLine[];
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(taoYeuCauSon, {
    message: "",
  });

  const thieu = useMemo(
    () =>
      new Map(
        lines.map((l) => [
          l.productId,
          l.minQty > 0 && l.ton < l.minQty
            ? Math.round((l.minQty - l.ton) * 100) / 100
            : 0,
        ])
      ),
    [lines]
  );

  const [chiThieu, setChiThieu] = useState(true);
  const hienThi = chiThieu
    ? lines.filter((l) => (thieu.get(l.productId) ?? 0) > 0)
    : lines;

  if (lines.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">
        {t("paint.chuaCoLoaiTruoc")}{" "}
        <span className="font-medium text-[var(--text-primary)]">
          {t("paint.danhMucSon")}
        </span>{" "}
        {t("paint.chuaCoLoaiSau")}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vesselId" value={vesselId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--text-secondary)]">
          {t("paint.xinCap1")}{" "}
          <b className="text-[var(--text-primary)]">{t("paint.xinCapDam1")}</b>{" "}
          {t("paint.xinCap2")}{" "}
          <b className="text-[var(--text-primary)]">{t("paint.xinCapDam2")}</b>.
        </p>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={chiThieu}
            onChange={(e) => setChiThieu(e.target.checked)}
            className="size-4 accent-brand-600"
          />
          {t("paint.chiHienDuoiDinhMuc")}
        </label>
      </div>

      {hienThi.length === 0 ? (
        <Notice tone="success">{t("paint.khongCoLoaiDuoiDinhMuc")}</Notice>
      ) : (
        <TableWrap>
          <Table dense>
            <thead>
              <tr>
                <Th>{t("paint.loaiSon")}</Th>
                <Th>{t("chung.donVi")}</Th>
                <Th align="right">{t("paint.cotTon")}</Th>
                <Th align="right">{t("paint.cotDinhMuc")}</Th>
                <Th>{t("paint.cotSoLuongXin")}</Th>
              </tr>
            </thead>
            <tbody>
              {hienThi.map((l) => {
                const goiY = thieu.get(l.productId) ?? 0;
                return (
                  <Tr key={l.productId}>
                    <Td>{l.label}</Td>
                    <Td>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {l.uom}
                      </span>
                    </Td>
                    <Td align="right">
                      <span
                        className={
                          goiY > 0
                            ? "font-medium text-[var(--text-warning)]"
                            : undefined
                        }
                      >
                        {l.ton}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="text-[var(--text-muted)]">
                        {l.minQty > 0 ? l.minQty : "—"}
                      </span>
                    </Td>
                    <Td>
                      <div className="w-28">
                        <Input
                          name={`sl_${l.productId}`}
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={goiY > 0 ? goiY : ""}
                          placeholder="0"
                          className="tabular"
                        />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Field label={t("paint.lyDoMucDich")} className="md:col-span-2">
          <Input name="purpose" placeholder={t("paint.phLyDo")} />
        </Field>
        <Field label={t("paint.mucUuTien")}>
          <Select name="priority">
            <option value="NORMAL">{t("labels.priority_NORMAL")}</option>
            <option value="HIGH">{t("labels.priority_HIGH")}</option>
            <option value="URGENT">{t("labels.priority_URGENT")}</option>
            <option value="LOW">{t("labels.priority_LOW")}</option>
          </Select>
        </Field>
      </div>

      <Button
        variant="primary"
        disabled={hienThi.length === 0}
        loading={pending}
        icon={<Send className="size-4" />}
      >
        {pending ? t("paint.dangGui") : t("paint.nutGuiYeuCau")}
      </Button>

      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}
