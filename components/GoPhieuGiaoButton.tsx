"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { goPhieuGiaoDaDuyet, xoaPhieuGiao } from "@/app/phieu-giao-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Notice } from "@/components/ui";

/**
 * Nút "Gỡ bỏ phiếu" cho quản trị tại văn phòng (trang chỉ hiện khi đúng quyền;
 * server kiểm lại). Phiếu ĐÃ DUYỆT: hỏi server kế hoạch hoàn tác trước (bao
 * nhiêu dòng nhập kho bị trừ lại, bao nhiêu mặt hàng mới bị xóa, bao nhiêu
 * giữ) rồi mới hỏi xác nhận bằng đúng con số ấy; phiếu chưa duyệt: xóa thẳng
 * như nút Xóa phiếu.
 */
export default function GoPhieuGiaoButton({
  phieuId,
  tenPhieu,
  trangThai,
  size = "sm",
  veDanhSach = false,
}: {
  phieuId: number;
  tenPhieu: string;
  trangThai: string;
  size?: "sm" | "md";
  /** Sau khi gỡ xong chuyển về danh sách (dùng ở trang chi tiết). */
  veDanhSach?: boolean;
}) {
  const { t } = useNgonNgu();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [thongBao, setThongBao] = useState<{ tone: "success" | "danger" | "info"; text: string } | null>(null);

  const go = () => {
    if (trangThai !== "DA_DUYET") {
      if (!window.confirm(t("phieuGiao.xacNhanXoaPhieu", { phieu: tenPhieu }))) return;
      startTransition(async () => {
        try {
          const r = await xoaPhieuGiao(phieuId);
          setThongBao({ tone: r.success ? "success" : "danger", text: r.message });
        } catch (e) {
          if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) throw e;
          setThongBao({ tone: "danger", text: String((e as Error)?.message ?? e) });
        }
      });
      return;
    }
    startTransition(async () => {
      setThongBao({ tone: "info", text: t("phieuGiao.goDangTinh") });
      const kh = await goPhieuGiaoDaDuyet(phieuId, false);
      if (!kh.success || !kh.tomTat) {
        setThongBao({ tone: "danger", text: kh.message });
        return;
      }
      const ok = window.confirm(
        t("phieuGiao.xacNhanGoDaDuyet", { phieu: tenPhieu, tx: kh.tomTat.soDongNhap, moi: kh.tomTat.soVatTuXoa, giu: kh.tomTat.soVatTuGiu })
      );
      if (!ok) {
        setThongBao(null);
        return;
      }
      const r = await goPhieuGiaoDaDuyet(phieuId, true);
      setThongBao({ tone: r.success ? "success" : "danger", text: r.message });
      if (r.success) {
        if (veDanhSach) router.push("/materials/phieu-giao");
        router.refresh();
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button type="button" size={size} variant="danger" onClick={go} loading={pending} icon={<Trash2 className="size-4" />} title={t("phieuGiao.goChiVanPhong")}>
        {t("phieuGiao.nutGoPhieu")}
      </Button>
      {thongBao && (
        <Notice tone={thongBao.tone} className="max-w-md text-left">
          {thongBao.text}
        </Notice>
      )}
    </span>
  );
}
