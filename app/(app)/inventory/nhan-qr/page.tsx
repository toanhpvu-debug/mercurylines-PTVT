import Form from "next/form";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, Filter, Tag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { chonDuocTau, requireScopedUser, vesselIdWhere, vesselScopeDayDu } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import { noiDungQr } from "@/lib/qr";
import { taoQrSvg } from "@/lib/qrSvg";
import PrintButton from "@/components/PrintButton";
import { Button, Card, CardHeader, EmptyState, Field, Input, Notice, PageHeader, Select, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Trần một lượt in: hơn nữa thì lọc theo nhóm để in theo đợt. */
const TRAN_MOT_LUOT = 300;

/**
 * /inventory/nhan-qr — tờ nhãn QR để dán lên mặt hàng.
 *
 * Mỗi nhãn: mã QR (SVG sinh trên máy chủ), mã mặt hàng, tên, IMPA hoặc Part No.,
 * đơn vị, mã tàu. Lưới 4 cột trên A4 dọc, mỗi nhãn ~45 mm, đủ đọc bằng mắt và
 * đủ to cho camera điện thoại bắt ở cách một gang tay.
 *
 * ?material=<id> → in đúng một nhãn (từ thẻ kho). Không có → toàn bộ mặt hàng
 * của một tàu, lọc được theo loại / nhóm / tìm kiếm.
 *
 * Địa chỉ ghi trong mã lấy từ header của chính yêu cầu này (qua Traefik thì là
 * x-forwarded-host/proto), tức là địa chỉ mà người in đang dùng để mở app —
 * xem lib/qr.ts vì sao phải là địa chỉ chứ không phải mã trần.
 */
export default async function NhanQrPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string; type?: string; nhom?: string; q?: string; material?: string }>;
}) {
  const user = await requireScopedUser();
  const { t, tTuDo } = await layT();
  const scope = vesselScopeDayDu(user);
  const params = await searchParams;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const goc = `${proto}://${host}`;

  const vessels = await prisma.vessel.findMany({
    where: vesselIdWhere(scope),
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  // ── Một nhãn cho một mặt hàng (từ thẻ kho) ────────────────────────────────
  const materialId = Number(params.material);
  if (Number.isInteger(materialId) && materialId > 0) {
    const m = await prisma.material.findUnique({
      where: { id: materialId },
      select: { id: true, code: true, nameVn: true, impa: true, partNumber: true, uom: true, materialType: true },
    });
    const svg = m ? await taoQrSvg(noiDungQr(goc, m.code)) : "";
    return (
      <div className="space-y-5">
        <PageHeader
          title={t("qr.nhanTieuDe")}
          subtitle={t("qr.nhanDiaChiGhiTrongMa", { goc })}
          action={
            <>
              <Link href="/inventory" className={buttonClass("secondary")}>
                <ArrowLeft className="size-4" />
                {t("inventory.quayLaiTonKho")}
              </Link>
              <PrintButton label={t("qr.nhanInNut")} />
            </>
          }
        />
        {!m ? (
          <Notice tone="warning">{t("chung.khongTimThay")}</Notice>
        ) : (
          <div className="print-area rounded-xl border p-4 print:border-0 print:p-0">
            <KieuNhan />
            <div className="nhan-qr-luoi grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              <Nhan svg={svg} code={m.code} ten={m.nameVn} phu={m.materialType === "SPARE" ? m.partNumber : m.impa} uom={m.uom} tau="" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Tờ nhãn của một tàu ───────────────────────────────────────────────────
  const vesselRaw = Number(params.vessel);
  const vesselId = chonDuocTau(scope)
    ? vessels.find((v) => v.id === vesselRaw)?.id ?? vessels[0]?.id ?? null
    : (scope.vesselId ?? null);
  const vessel = vessels.find((v) => v.id === vesselId) ?? null;
  const type = ["STORE", "SPARE"].includes(String(params.type)) ? String(params.type) : "ALL";
  const nhomId = Number(params.nhom) || 0;
  const q = String(params.q ?? "").trim();

  const dieuKien = vessel
    ? {
        isActive: true,
        vesselMaterials: { some: { vesselId: vessel.id } },
        ...(type === "ALL" ? {} : { materialType: type }),
        ...(nhomId ? { categoryId: nhomId } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" as const } },
                { nameVn: { contains: q, mode: "insensitive" as const } },
                { impa: { contains: q, mode: "insensitive" as const } },
                { partNumber: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      }
    : null;

  const [nhom, tong, materials] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    dieuKien ? prisma.material.count({ where: dieuKien }) : 0,
    dieuKien
      ? prisma.material.findMany({
          where: dieuKien,
          orderBy: { code: "asc" },
          take: TRAN_MOT_LUOT,
          select: { id: true, code: true, nameVn: true, impa: true, partNumber: true, uom: true, materialType: true },
        })
      : [],
  ]);
  const svgs = await Promise.all(materials.map((m) => taoQrSvg(noiDungQr(goc, m.code))));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("qr.nhanTieuDe")}
        subtitle={t("qr.nhanMoTa")}
        action={
          <>
            <Link href="/inventory" className={buttonClass("secondary")}>
              <ArrowLeft className="size-4" />
              {t("inventory.quayLaiTonKho")}
            </Link>
            <PrintButton label={t("qr.nhanInNut")} />
          </>
        }
      />

      <Card className="no-print">
        <CardHeader icon={<Filter className="size-4" />} title={t("qr.nhanBoLoc")} subtitle={t("qr.nhanGiaiThichDiaChi")} />
        <Form action="/inventory/nhan-qr" className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {chonDuocTau(scope) && (
            <Field label={t("chung.tau")}>
              <Select name="vessel" defaultValue={vessel?.id ?? ""}>
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} - {v.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={t("inventory.loai")}>
            <Select name="type" defaultValue={type}>
              <option value="ALL">{t("chung.tatCa")}</option>
              <option value="STORE">{tTuDo("labels.type_STORE")}</option>
              <option value="SPARE">{tTuDo("labels.type_SPARE")}</option>
            </Select>
          </Field>
          <Field label={t("chung.nhom")}>
            <Select name="nhom" defaultValue={nhomId || ""}>
              <option value="">{t("qr.nhanTatCaNhom")}</option>
              {nhom.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("chung.tim")}>
            <Input name="q" defaultValue={q} placeholder={t("qr.nhanTimGoiY")} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" variant="primary" icon={<Filter className="size-4" />}>
              {t("chung.loc")}
            </Button>
          </div>
        </Form>
        <p className="mt-3 text-xs text-[var(--text-muted)]">{t("qr.nhanDiaChiGhiTrongMa", { goc })}</p>
      </Card>

      {tong > TRAN_MOT_LUOT && (
        <Notice tone="warning" className="no-print">
          {t("qr.nhanQuaNhieu", { n: String(materials.length), tong: String(tong) })}
        </Notice>
      )}

      {materials.length === 0 ? (
        <Card>
          <EmptyState icon={<Tag className="size-8" />} title={t("qr.nhanKhongCo")} />
        </Card>
      ) : (
        <div className="print-area rounded-xl border p-4 print:border-0 print:p-0">
          <KieuNhan />
          <p className="no-print mb-3 text-sm text-[var(--text-secondary)]">
            {t("qr.nhanSoLuong", { n: String(materials.length) })}
            {vessel ? ` · ${vessel.code} ${vessel.name}` : ""}
          </p>
          <div className="nhan-qr-luoi grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {materials.map((m, i) => (
              <Nhan
                key={m.id}
                svg={svgs[i]}
                code={m.code}
                ten={m.nameVn}
                phu={m.materialType === "SPARE" ? m.partNumber : m.impa}
                uom={m.uom}
                tau={vessel?.code ?? ""}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Kiểu in riêng cho tờ nhãn: A4 DỌC (khác @page chung của app là ngang), lưới
 * cố định 4 cột, mỗi nhãn không bị cắt ngang trang. Cỡ chữ trên nhãn tính bằng
 * pt vì đây là vật in dán lên đồ vật, không phải chữ đọc trên màn hình — quy
 * tắc 13px tối thiểu của giao diện không áp cho nhãn.
 */
function KieuNhan() {
  return (
    <style>{`
      @media print {
        @page { size: A4 portrait; margin: 8mm; }
        .nhan-qr-luoi { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 3mm !important; }
        .nhan-qr { break-inside: avoid; page-break-inside: avoid; border: 0.3pt solid #999 !important; }
        .nhan-qr .nhan-ma { font-size: 9pt; }
        .nhan-qr .nhan-ten { font-size: 7.5pt; line-height: 1.2; }
        .nhan-qr .nhan-phu { font-size: 7pt; }
      }
    `}</style>
  );
}

function Nhan({ svg, code, ten, phu, uom, tau }: { svg: string; code: string; ten: string; phu: string | null; uom: string; tau: string }) {
  return (
    <div className="nhan-qr flex flex-col items-center rounded-lg border border-[var(--border-subtle)] bg-white p-2 text-center text-black">
      <div className="w-[30mm] max-w-full [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="nhan-ma mt-1 font-display text-xs tracking-wide">{code}</p>
      <p className="nhan-ten line-clamp-2 text-xs leading-tight">{ten}</p>
      <p className="nhan-phu text-xs text-neutral-600">
        {[phu, uom, tau].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}
