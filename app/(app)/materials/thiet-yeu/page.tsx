import { Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselIdWhere } from "@/lib/auth";
import { coQuanLyThietYeu, vesselScopeDayDu } from "@/lib/roles";
import { layBangThietYeu } from "@/lib/thietYeuServer";
import { laThieu, ngayBaoCao, thangHopLe } from "@/lib/thietYeu";
import { laBanTau } from "@/lib/banCai";
import { layT } from "@/lib/i18n/server";
import BangThietYeu from "@/components/BangThietYeu";
import NhapThietYeuForm from "@/components/NhapThietYeuForm";
import { Button, Card, CardHeader, EmptyState, Field, Input, Notice, PageHeader, Select, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Phụ tùng thiết yếu MLS-11-04 — danh mục RIÊNG của từng tàu (không lẫn vào
 * danh mục vật tư chung): nhập từ tệp Word của tàu, điền số hằng tháng, in hoặc
 * xuất Word đúng mẫu công ty để Máy trưởng / Thuyền trưởng ký gửi văn phòng.
 */
export default async function ThietYeuPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string; thang?: string; daGo?: string }>;
}) {
  const user = await requireScopedUser();
  const { t } = await layT();
  const scope = vesselScopeDayDu(user);
  const params = await searchParams;
  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
  const tau = vessels.find((v) => v.id === Number(params.vessel)) ?? vessels[0] ?? null;
  const thang = thangHopLe(params.thang);

  if (scope.unassigned || !tau) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("thietYeu.tieuDe")} subtitle={t("thietYeu.moTa")} />
        <Notice tone="warning">{t("chung.chuaGanTau")}</Notice>
      </div>
    );
  }

  const dong = await layBangThietYeu(tau.id, thang);
  const coQuyen = coQuanLyThietYeu(user, tau.id);
  // Gỡ cả danh mục: quản trị ở bản cài văn phòng (như mọi chức năng gỡ / xóa khác).
  const goDuoc = user.role === "ADMIN" && !(await laBanTau());
  // Vừa gỡ danh mục (goDanhMucThietYeu → URL ?daGo=<số mục>): báo lại ở đầu trang.
  const daGo = dong.length === 0 && /^\d{1,4}$/.test(params.daGo ?? "") ? Number(params.daGo) : 0;
  const soThieu = dong.filter(laThieu).length;
  const soChuaCoSo = dong.filter((d) => d.hienCo === null).length;
  const soDaLuu = dong.filter((d) => d.nguon === "DA_LUU").length;

  return (
    <div className="space-y-5">
      <div className="no-print">
        <PageHeader title={t("thietYeu.tieuDe")} subtitle={t("thietYeu.moTa")} />
      </div>

      <Card className="no-print">
        <form className="flex flex-wrap items-end gap-3">
          {vessels.length > 1 ? (
            <Field label={t("chung.tau")} className="w-64">
              <Select name="vessel" defaultValue={tau.id}>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} - {v.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="vessel" value={tau.id} />
          )}
          <Field label={t("inventory.thang")} className="w-44">
            <Input name="thang" type="month" defaultValue={thang} />
          </Field>
          <Button type="submit" variant="primary" icon={<Eye className="size-4" />}>
            {t("thietYeu.xem")}
          </Button>
        </form>
      </Card>

      {daGo > 0 && (
        <Notice tone="success" className="no-print">
          {t("thietYeu.daGoDanhMucNgan", { tau: tau.name, n: daGo })}
        </Notice>
      )}

      {dong.length === 0 ? (
        <Card className="no-print">
          <EmptyState title={t("thietYeu.chuaCoDanhMuc")} hint={coQuyen ? t("thietYeu.chuaCoDanhMucGoiY") : t("thietYeu.chiXem")} />
          {coQuyen && (
            <div className="border-t border-[var(--border-subtle)] pt-4">
              <CardHeader title={t("thietYeu.nhapTieuDe")} />
              <NhapThietYeuForm vesselId={tau.id} soMucHienCo={0} />
            </div>
          )}
        </Card>
      ) : (
        <>
          <div className="no-print grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t("thietYeu.tongMuc")} value={dong.length} />
            <Stat label={t("thietYeu.soThieu")} value={soThieu} tone={soThieu > 0 ? "danger" : "success"} />
            <Stat label={t("thietYeu.soChuaCoSo")} value={soChuaCoSo} tone={soChuaCoSo > 0 ? "warning" : "neutral"} />
            <Stat label={t("thietYeu.soDaLuu")} value={`${soDaLuu}/${dong.length}`} tone={soDaLuu === dong.length ? "success" : "neutral"} />
          </div>
          <Notice tone={soDaLuu === dong.length ? "success" : "info"} className="no-print">
            {soDaLuu === dong.length ? t("thietYeu.thangDaLuu", { thang }) : t("thietYeu.thangChuaLuu", { thang })}{" "}
            <span className="text-xs text-[var(--text-secondary)]">{t("thietYeu.nguonGiaiThich")}</span>
          </Notice>
          {!coQuyen && <Notice tone="muted" className="no-print">{t("thietYeu.chiXem")}</Notice>}

          <BangThietYeu
            key={`${tau.id}-${thang}`}
            vesselId={tau.id}
            maTau={tau.code}
            thang={thang}
            tenTau={tau.name}
            ngay={ngayBaoCao(thang)}
            dongGoc={dong}
            coQuyen={coQuyen}
            goDuoc={goDuoc}
          />

          {coQuyen && (
            <details className="no-print surface rounded-xl border p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">{t("thietYeu.nhapLai")}</summary>
              <div className="mt-3">
                <NhapThietYeuForm vesselId={tau.id} soMucHienCo={dong.length} />
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
