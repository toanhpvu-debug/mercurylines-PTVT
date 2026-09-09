"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Droplets,
  FlaskConical,
  Fuel,
  Send,
  type LucideIcon,
} from "lucide-react";
import { taoYeuCauNhienLieu } from "@/app/consumable-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import {
  Button,
  EmptyState,
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

export type RequestLine = {
  productId: number;
  label: string;
  uom: string;
  category: string;
  ton: number;
  minQty: number;
  /** Tiêu thụ trung bình mỗi ngày, tính trên 30 ngày gần nhất. 0 = chưa có. */
  moiNgay: number;
};

/** Biểu tượng nhóm — thay cho emoji `icon` trong lib/consumables.ts. */
const CATEGORY_ICON: Record<string, LucideIcon> = {
  FUEL: Fuel,
  LUBE: Droplets,
  CHEMICAL: FlaskConical,
};

/** Số ngày dự trữ mặc định khi đề xuất số lượng xin cấp. */
const SO_NGAY_DU_TRU_MAC_DINH = 60;

/**
 * Xin cấp dầu · dầu nhờn · hóa chất, gửi vào đúng dây chuyền phê duyệt của
 * yêu cầu vật tư (tàu duyệt → công ty duyệt → mua sắm).
 *
 * Đề xuất sẵn phần thiếu so với định mức cho những mặt hàng đang dưới mức — đó
 * là lý do thường gặp nhất để xin cấp.
 */
export default function ConsumableRequestForm({
  vesselId,
  lines,
  nguoiDuyet,
}: {
  vesselId: number;
  lines: RequestLine[];
  /** Chức danh sẽ duyệt ở cấp tàu, hoặc null nếu đi thẳng lên công ty. */
  nguoiDuyet: string | null;
}) {
  const { t } = useNgonNgu();
  const [state, action, pending] = useActionState(taoYeuCauNhienLieu, {
    message: "",
  });

  const [soNgay, setSoNgay] = useState(SO_NGAY_DU_TRU_MAC_DINH);

  /**
   * Đề xuất số lượng xin cấp = phần LỚN HƠN giữa hai cách tính:
   *   - bù cho đủ định mức tối thiểu, và
   *   - đủ dùng cho <soNgay> ngày theo tốc độ tiêu thụ 30 ngày qua.
   *
   * Chỉ dựa vào định mức thì mặt hàng tiêu thụ nhanh vẫn hết trước khi hàng
   * về; chỉ dựa vào tốc độ thì mặt hàng chưa từng ghi tiêu thụ sẽ đề xuất 0.
   * Lấy số lớn hơn nên cách nào cũng không bỏ sót.
   */
  const deXuat = useMemo(() => {
    const m = new Map<number, { sl: number; vi: string }>();
    for (const l of lines) {
      const buDinhMuc =
        l.minQty > 0 && l.ton < l.minQty ? l.minQty - l.ton : 0;
      const duDung = l.moiNgay > 0 ? l.moiNgay * soNgay - l.ton : 0;
      const sl = Math.max(buDinhMuc, duDung, 0);
      const vi =
        sl === 0
          ? ""
          : duDung > buDinhMuc
            ? t("consumables.duDungNNgay", { n: soNgay })
            : t("consumables.buChoDuDinhMuc");
      m.set(l.productId, { sl: Math.ceil(sl * 1000) / 1000, vi });
    }
    return m;
  }, [lines, soNgay, t]);

  const [chiThieu, setChiThieu] = useState(true);
  const hienThi = chiThieu
    ? lines.filter((l) => (deXuat.get(l.productId)?.sl ?? 0) > 0)
    : lines;

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<Droplets className="size-5" />}
        title={t("consumables.chuaCoMatHangNhom")}
      />
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="vesselId" value={vesselId} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          {nguoiDuyet ? (
            <>
              {t("consumables.luongDuyetTruoc")}{" "}
              <b className="text-[var(--text-primary)]">{nguoiDuyet}</b>{" "}
              {t("consumables.luongDuyetGiua")}{" "}
              <b className="text-[var(--text-primary)]">
                {t("consumables.quanLyKyThuat")}
              </b>
              {t("consumables.luongDuyetSau")}{" "}
              <b className="text-[var(--text-primary)]">
                {t("consumables.muaSam")}
              </b>
              .
            </>
          ) : (
            <>
              {t("consumables.luongDuyetThangTruoc")}{" "}
              <b className="text-[var(--text-primary)]">
                {t("consumables.luongDuyetThangDam")}
              </b>
              {t("consumables.luongDuyetSau")}{" "}
              <b className="text-[var(--text-primary)]">
                {t("consumables.muaSam")}
              </b>
              .
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm whitespace-nowrap text-[var(--text-secondary)]">
            {t("consumables.duTruDuDung")}
            <span className="block w-28">
              <Select
                value={soNgay}
                onChange={(e) => setSoNgay(Number(e.target.value))}
              >
                {[30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {t("consumables.nNgay", { n })}
                  </option>
                ))}
              </Select>
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm whitespace-nowrap text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={chiThieu}
              onChange={(e) => setChiThieu(e.target.checked)}
              className="size-4 rounded accent-brand-600"
            />
            {t("consumables.chiHienCanCap")}
          </label>
        </div>
      </div>

      {hienThi.length === 0 ? (
        <Notice tone="success">
          {t("consumables.khongCanCap", { n: soNgay })}
        </Notice>
      ) : (
        <TableWrap>
          <Table dense>
            <thead>
              <tr>
                <Th>{t("consumables.matHang")}</Th>
                <Th>{t("chung.donVi")}</Th>
                <Th align="right">{t("consumables.ton")}</Th>
                <Th align="right">{t("consumables.dungMoiNgay")}</Th>
                <Th align="right">{t("consumables.conDungDuoc")}</Th>
                <Th align="right">{t("consumables.dinhMuc")}</Th>
                <Th>{t("consumables.cotSoLuongXinCap")}</Th>
              </tr>
            </thead>
            <tbody>
              {hienThi.map((l) => {
                const dx = deXuat.get(l.productId) ?? { sl: 0, vi: "" };
                const conDung =
                  l.moiNgay > 0 ? Math.floor(l.ton / l.moiNgay) : null;
                const Icon = CATEGORY_ICON[l.category];
                return (
                  <Tr key={l.productId}>
                    <Td>
                      <span className="inline-flex items-center gap-1.5">
                        {Icon && (
                          <Icon className="size-4 shrink-0 text-[var(--text-muted)]" />
                        )}
                        {l.label}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {l.uom}
                      </span>
                    </Td>
                    <Td align="right">
                      <span
                        className={cn(
                          dx.sl > 0 &&
                            "font-semibold text-[var(--text-warning)]"
                        )}
                      >
                        {l.ton}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="text-[var(--text-secondary)]">
                        {l.moiNgay > 0
                          ? Math.round(l.moiNgay * 100) / 100
                          : "—"}
                      </span>
                    </Td>
                    <Td align="right">
                      {conDung === null ? (
                        <span className="text-[var(--text-muted)]">—</span>
                      ) : (
                        <span
                          className={
                            conDung < soNgay
                              ? "font-semibold text-[var(--text-warning)]"
                              : "text-[var(--text-secondary)]"
                          }
                        >
                          {t("consumables.nNgay", { n: conDung })}
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="text-[var(--text-secondary)]">
                        {l.minQty > 0 ? l.minQty : "—"}
                      </span>
                    </Td>
                    <Td>
                      <div className="w-28">
                        <Input
                          name={`sl_${l.productId}`}
                          type="number"
                          step="0.001"
                          min="0"
                          key={`${l.productId}-${soNgay}`}
                          defaultValue={dx.sl > 0 ? dx.sl : ""}
                          placeholder="0"
                          className="tabular"
                        />
                      </div>
                      {dx.vi && (
                        <span className="mt-1 block text-xs text-[var(--text-muted)]">
                          {dx.vi}
                        </span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Field label={t("consumables.lyDoMucDich")} className="md:col-span-2">
          <Input
            name="purpose"
            placeholder={t("consumables.lyDoPlaceholder")}
          />
        </Field>
        <Field label={t("consumables.mucUuTien")}>
          <Select name="priority">
            <option value="NORMAL">{t("labels.priority_NORMAL")}</option>
            <option value="HIGH">{t("labels.priority_HIGH")}</option>
            <option value="URGENT">{t("labels.priority_URGENT")}</option>
            <option value="LOW">{t("labels.priority_LOW")}</option>
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          loading={pending}
          disabled={hienThi.length === 0}
          icon={<Send className="size-4" />}
        >
          {pending
            ? t("consumables.dangGui")
            : t("consumables.nutGuiYeuCau")}
        </Button>
      </div>

      {state.message && (
        <Notice tone={state.success ? "success" : "danger"}>
          {state.message}
        </Notice>
      )}
    </form>
  );
}
