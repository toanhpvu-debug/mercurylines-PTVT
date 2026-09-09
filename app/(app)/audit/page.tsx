import { redirect } from "next/navigation";
import { Filter, History } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireScopedUser } from "@/lib/auth";
import { layT } from "@/lib/i18n/server";
import type { HamDich, HamDichTuDo } from "@/lib/i18n";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  type Tone,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const SO_DONG = 200;

// Tên nghiệp vụ do server action tự ghi → chữ cho người đọc, tra ở từ điển.
// Mã server action của Next là chuỗi băm nên để nguyên, chỉ rút ngắn lại.
const KHOA_VIEC: Record<string, string> = {
  "dang-nhap": "viecDangNhap",
  "chua-dang-nhap": "viecChuaDangNhap",
  "khong-du-quyen": "viecKhongDuQuyen",
  request: "viecGuiBieuMau",
  "phan-cong-doi-tau": "viecPhanCongDoiTau",
  "tao-uy-quyen": "viecTaoUyQuyen",
  "thu-hoi-uy-quyen": "viecThuHoiUyQuyen",
  "duyet-yeu-cau": "viecDuyetYeuCau",
  "tu-choi-yeu-cau": "viecTuChoiYeuCau",
  "xoa-yeu-cau": "viecXoaYeuCau",
  "doi-tai-khoan": "viecDoiTaiKhoan",
  "xoa-tai-khoan": "viecXoaTaiKhoan",
  "doi-ma-phu-tung": "viecDoiMaPhuTung",
};

/** Kết quả một dòng nhật ký → tone nhãn. */
const TONE_KET_QUA: Record<string, Tone> = {
  OK: "success",
  TU_CHOI: "danger",
  LOI: "warning",
};

function nhan(
  action: string | null,
  t: HamDich,
  tTuDo: HamDichTuDo
): string {
  if (!action) return "—";
  const khoa = KHOA_VIEC[action];
  if (khoa) return tTuDo(`vessels.${khoa}`);
  // Mã server action: dài, không có nghĩa với người đọc.
  return action.length > 12
    ? t("vessels.thaoTacMa", { ma: action.slice(0, 8) })
    : action;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ nguoi?: string; viec?: string }>;
}) {
  const me = await requireScopedUser();
  // Nhật ký là hồ sơ kiểm soát nội bộ: chỉ quản trị đọc. proxy.ts cũng chặn
  // đường dẫn này một lần nữa để gõ thẳng URL không lọt.
  if (me.role !== "ADMIN") {
    redirect("/dashboard");
  }
  const { t, tTuDo, ngayGio, so } = await layT();
  const sp = await searchParams;
  const nguoi = (sp.nguoi ?? "").trim();
  const viec = (sp.viec ?? "").trim();

  const where = {
    ...(nguoi ? { email: { contains: nguoi, mode: "insensitive" as const } } : {}),
    ...(viec ? { action: { contains: viec } } : {}),
  };

  const [dong, tong, nguoiDung] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      take: SO_DONG,
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
    }),
  ]);
  const tenTheoId = new Map(nguoiDung.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("vessels.auditTieuDe")}
        subtitle={t("vessels.auditMoTa")}
      />

      <Card>
        <CardHeader
          icon={<History className="size-4" />}
          title={t("vessels.nDongKhop", { n: so(tong) })}
          subtitle={
            tong > SO_DONG
              ? t("vessels.dangHienMoiNhat", { n: SO_DONG })
              : undefined
          }
          action={
            <form className="flex flex-wrap items-end gap-2">
              <Field label={t("vessels.nhanEmailNguoi")} className="w-48">
                <Input
                  name="nguoi"
                  defaultValue={nguoi}
                  placeholder={t("vessels.phEmailNguoi")}
                />
              </Field>
              <Field label={t("vessels.nhanNghiepVu")} className="w-48">
                <Input
                  name="viec"
                  defaultValue={viec}
                  placeholder={t("vessels.phNghiepVu")}
                />
              </Field>
              <Button
                type="submit"
                variant="primary"
                icon={<Filter className="size-4" />}
              >
                {t("chung.loc")}
              </Button>
            </form>
          }
        />
        {dong.length === 0 ? (
          <EmptyState
            icon={<History className="size-5" />}
            title={t("vessels.chuaCoNhatKy")}
          />
        ) : (
          <TableWrap>
            <Table dense>
              <thead>
                <tr>
                  <Th>{t("vessels.cotThoiDiem")}</Th>
                  <Th>{t("vessels.cotNguoiThaoTac")}</Th>
                  <Th>{t("vessels.cotViec")}</Th>
                  <Th>{t("vessels.cotDuongDan")}</Th>
                  <Th>{t("vessels.cotChiTiet")}</Th>
                  <Th>{t("vessels.cotKetQua")}</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody>
                {dong.map((d) => (
                  <Tr
                    key={d.id}
                    className="align-top transition-colors hover:bg-[var(--surface-sunken)]/50"
                  >
                    <Td className="tabular whitespace-nowrap text-[var(--text-secondary)]">
                      {ngayGio(d.at)}
                    </Td>
                    <Td>
                      {d.email ?? "—"}
                      {d.role && (
                        <span className="block text-xs text-[var(--text-muted)]">
                          {tTuDo(`labels.role_${d.role}`)}
                        </span>
                      )}
                      {d.onBehalfOfId && (
                        <span className="block text-xs text-[var(--text-warning)]">
                          {t("vessels.kyThay", {
                            ten:
                              tenTheoId.get(d.onBehalfOfId) ??
                              `#${d.onBehalfOfId}`,
                          })}
                        </span>
                      )}
                    </Td>
                    <Td>{nhan(d.action, t, tTuDo)}</Td>
                    <Td className="font-mono text-xs text-[var(--text-secondary)]">
                      {d.method} {d.path}
                    </Td>
                    <Td className="text-[var(--text-secondary)]">
                      {d.detail ?? "—"}
                    </Td>
                    <Td>
                      {/* Giá trị lạ vẫn phải nổi lên như một trục trặc — nhãn
                          chữ của nó cũng là "Lỗi", nên tone mặc định là warning. */}
                      <Badge tone={TONE_KET_QUA[d.ketQua] ?? "warning"}>
                        {d.ketQua === "OK"
                          ? "OK"
                          : d.ketQua === "TU_CHOI"
                            ? t("vessels.biTuChoi")
                            : t("vessels.ketQuaLoi")}
                      </Badge>
                    </Td>
                    <Td className="font-mono text-xs text-[var(--text-muted)]">
                      {d.ip ?? "—"}
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
