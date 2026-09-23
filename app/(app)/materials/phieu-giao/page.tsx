import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireScopedUser, vesselIdWhere, vesselScopeDayDu, vesselWhere } from "@/lib/auth";
import { NGUOI_TAI_PHIEU_GIAO, dangDocAi } from "@/lib/phieuGiao";
import { layCauHinhAi } from "@/lib/cauHinhAi";
import { TEN_NHA_CUNG_CAP } from "@/lib/docPhieuBangAi";
import PhieuGiaoUploadForm from "@/components/PhieuGiaoUploadForm";
import GoPhieuGiaoButton from "@/components/GoPhieuGiaoButton";
import { laBanTau } from "@/lib/banCai";
import { layT } from "@/lib/i18n/server";
import { Badge, Card, CardHeader, Notice, PageHeader, Table, TableWrap, Td, Th, Tr } from "@/components/ui";

export const dynamic = "force-dynamic";

const TONE: Record<string, "warning" | "success" | "danger"> = {
  CHO_DUYET: "warning",
  DA_DUYET: "success",
  TU_CHOI: "danger",
};

function ngayGio(d: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function PhieuGiaoPage() {
  const user = await requireScopedUser();
  const { t, tTuDo } = await layT();
  const scope = vesselScopeDayDu(user);
  const [vessels, phieus] = await Promise.all([
    prisma.vessel.findMany({
      where: vesselIdWhere(scope),
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.phieuGiaoNhan.findMany({
      where: vesselWhere(scope),
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        fileName: true,
        soPhieu: true,
        nhaCungCap: true,
        status: true,
        nguonChu: true,
        createdAt: true,
        aiDangDocTu: true,
        vessel: { select: { code: true } },
        uploadedBy: { select: { name: true } },
        _count: { select: { dong: true } },
      },
    }),
  ]);
  const duocTai = NGUOI_TAI_PHIEU_GIAO.includes(user.role);
  const cauHinhAi = await layCauHinhAi();
  const aiBat = cauHinhAi !== null;
  // Gỡ bỏ phiếu (kể cả đã duyệt, có hoàn tác): chỉ quản trị tại văn phòng.
  const goDuoc = user.role === "ADMIN" && !(await laBanTau());

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/materials/import"
          className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <ArrowLeft className="size-4" />
          {t("materials.nhapDanhMucTuFile")}
        </Link>
        <PageHeader title={t("phieuGiao.tieuDe")} subtitle={t("phieuGiao.moTa")} />
      </div>

      {duocTai && (
        <Card>
          <CardHeader title={t("phieuGiao.theTaiLen")} />
          {/* Bộ đọc AI: bật thì ai cũng cần biết bản scan sẽ được đọc; chưa bật
              thì chỉ quản trị (người đặt được biến môi trường) cần thấy lời nhắc. */}
          {aiBat && cauHinhAi ? (
            <Notice tone="info" className="mb-4">
              {t("phieuGiao.aiBat", { ncc: TEN_NHA_CUNG_CAP[cauHinhAi.nhaCungCap], model: cauHinhAi.model })}
            </Notice>
          ) : user.role === "ADMIN" ? (
            <Notice tone="warning" className="mb-4">
              {t("phieuGiao.aiChuaCauHinh")}{" "}
              <Link href="/cai-dat/ai" className="font-medium underline">
                {t("cauHinhAi.tieuDe")} →
              </Link>
            </Notice>
          ) : null}
          <PhieuGiaoUploadForm vessels={vessels.map((v) => ({ id: v.id, label: `${v.code} — ${v.name}` }))} />
        </Card>
      )}

      <Card>
        <CardHeader title={t("phieuGiao.danhSachTieuDe")} />
        {phieus.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t("phieuGiao.chuaCoPhieu")}</p>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t("phieuGiao.cotPhieu")}</Th>
                  <Th>{t("phieuGiao.cotTau")}</Th>
                  <Th>{t("phieuGiao.cotNguoiTai")}</Th>
                  <Th align="right">{t("phieuGiao.cotSoDong")}</Th>
                  <Th>{t("chung.trangThai")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {phieus.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <Link href={`/materials/phieu-giao/${p.id}`} className="font-medium text-[var(--text-primary)] hover:underline">
                        {p.soPhieu || p.fileName}
                      </Link>
                      <div className="text-xs text-[var(--text-muted)]">
                        {p.nhaCungCap ? `${p.nhaCungCap} · ` : ""}
                        {ngayGio(p.createdAt)} · {tTuDo(`phieuGiao.nguon_${p.nguonChu}`)}
                      </div>
                    </Td>
                    <Td>{p.vessel.code}</Td>
                    <Td>{p.uploadedBy.name}</Td>
                    <Td align="right">{p._count.dong}</Td>
                    <Td>
                      <Badge tone={TONE[p.status] ?? "neutral"} dot>
                        {tTuDo(`phieuGiao.trangThai_${p.status}`)}
                      </Badge>
                      {p.status === "CHO_DUYET" && dangDocAi(p.aiDangDocTu) && (
                        <Badge tone="info" className="ml-1">
                          {t("phieuGiao.badgeDangDoc")}
                        </Badge>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="inline-flex flex-wrap items-center justify-end gap-2">
                        {goDuoc && <GoPhieuGiaoButton phieuId={p.id} tenPhieu={p.soPhieu || p.fileName} trangThai={p.status} />}
                        <Link
                          href={`/materials/phieu-giao/${p.id}`}
                          className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300"
                        >
                          {t("phieuGiao.nutMo")}
                          <ArrowRight className="size-4" />
                        </Link>
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
