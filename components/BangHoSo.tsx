"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2, X } from "lucide-react";
import { goHoSo } from "@/app/ho-so-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { Badge, Button, Notice, Table, TableWrap, Td, Th, Tr, buttonClass } from "@/components/ui";

export type DongHoSo = {
  id: number;
  ngay: string;
  vesselId: number;
  vesselCode: string;
  reportType: string;
  period: string | null;
  title: string;
  fileName: string;
  note: string | null;
  co: string;
  sha256: string;
  nguoiTai: string;
};

const O_TICK = "size-4 cursor-pointer accent-brand-600";

/**
 * Bảng "Hồ sơ đã lưu" ở /documents. Quản trị văn phòng (goDuoc) có ô tick từng
 * dòng + "chọn tất cả", nút gỡ nhanh ngay trên dòng và thanh "Gỡ N hồ sơ đã
 * chọn". Cỡ tệp và SHA-256 gộp vào dòng phụ dưới tên tệp để bảng đủ hẹp — nút
 * thao tác không bị đẩy khuất sang phải phải cuộn ngang mới thấy.
 */
export default function BangHoSo({ dong, goDuoc }: { dong: DongHoSo[]; goDuoc: boolean }) {
  const { t } = useNgonNgu();
  const router = useRouter();
  const [chon, setChon] = useState<Set<number>>(() => new Set());
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dangGo, startTransition] = useTransition();

  // Hồ sơ đã gỡ (hoặc không còn trong danh sách) thì tự rơi khỏi lựa chọn.
  const conChon = dong.filter((d) => chon.has(d.id));
  const tatCa = dong.length > 0 && conChon.length === dong.length;
  const doi = (id: number) =>
    setChon((c) => {
      const m = new Set(c);
      if (m.has(id)) m.delete(id);
      else m.add(id);
      return m;
    });

  const go = (ds: DongHoSo[]) => {
    if (!ds.length) return;
    const hoi =
      ds.length === 1
        ? t("inventory.xacNhanXoaHoSo", { ten: ds[0].fileName })
        : t("inventory.xacNhanGoNhieuHoSo", { n: ds.length });
    if (!window.confirm(hoi)) return;
    setThongBao(null);
    startTransition(async () => {
      const r = await goHoSo(ds.map((d) => d.id));
      setThongBao({ ok: Boolean(r.success), chu: r.message });
      if (r.success) {
        setChon((c) => {
          const m = new Set(c);
          for (const d of ds) m.delete(d.id);
          return m;
        });
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      {goDuoc && conChon.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">{t("inventory.daChonHoSo", { n: conChon.length })}</span>
          <Button type="button" variant="danger" size="sm" loading={dangGo} onClick={() => go(conChon)} icon={<Trash2 className="size-4" />}>
            {t("inventory.goHoSoDaChon", { n: conChon.length })}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={dangGo} onClick={() => setChon(new Set())} icon={<X className="size-4" />}>
            {t("inventory.boChonHoSo")}
          </Button>
        </div>
      )}
      {thongBao && <Notice tone={thongBao.ok ? "success" : "danger"}>{thongBao.chu}</Notice>}

      <TableWrap>
        <Table dense>
          <thead>
            <tr>
              {goDuoc && (
                <Th className="w-8">
                  <input
                    type="checkbox"
                    className={O_TICK}
                    checked={tatCa}
                    ref={(el) => {
                      if (el) el.indeterminate = conChon.length > 0 && !tatCa;
                    }}
                    onChange={() => setChon(tatCa ? new Set() : new Set(dong.map((d) => d.id)))}
                    aria-label={t("inventory.chonTatCaHoSo")}
                    title={t("inventory.chonTatCaHoSo")}
                  />
                </Th>
              )}
              <Th>{t("inventory.cotNgayTai")}</Th>
              <Th>{t("chung.tau")}</Th>
              <Th>{t("inventory.loai")}</Th>
              <Th>{t("inventory.cotKy")}</Th>
              <Th>{t("inventory.cotTieuDeFile")}</Th>
              <Th>{t("inventory.cotNguoiTai")}</Th>
              <Th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {dong.map((doc) => {
              const daChon = chon.has(doc.id);
              return (
                <Tr
                  key={doc.id}
                  className={`align-top transition-colors hover:bg-[var(--surface-sunken)]/50 ${daChon ? "bg-rose-500/5" : ""}`}
                >
                  {goDuoc && (
                    <Td>
                      <input
                        type="checkbox"
                        className={O_TICK}
                        checked={daChon}
                        onChange={() => doi(doc.id)}
                        aria-label={t("inventory.chonHoSo", { ten: doc.fileName })}
                      />
                    </Td>
                  )}
                  <Td className="whitespace-nowrap">{doc.ngay}</Td>
                  <Td className="whitespace-nowrap">
                    <Link
                      href={`/vessels/${doc.vesselId}`}
                      className="font-display text-xs tracking-wide text-brand-700 hover:underline dark:text-brand-300"
                    >
                      {doc.vesselCode}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone="neutral">{doc.reportType}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">{doc.period}</Td>
                  <Td>
                    <p className="font-medium break-words">{doc.title}</p>
                    {doc.title !== doc.fileName && <p className="text-xs break-all text-[var(--text-muted)]">{doc.fileName}</p>}
                    {doc.note && (
                      <p className="text-xs text-[var(--text-muted)]">
                        {t("chung.ghiChu")}: {doc.note}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      <span className="tabular">{doc.co}</span> ·{" "}
                      <span className="font-mono" title={doc.sha256}>
                        SHA-256 {doc.sha256.slice(0, 12)}…
                      </span>
                    </p>
                  </Td>
                  <Td>{doc.nguoiTai}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`/api/documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClass("secondary", "sm")}
                        title={t("inventory.xemTai")}
                      >
                        <ExternalLink className="size-4" />
                        <span className="hidden 2xl:inline">{t("inventory.xemTai")}</span>
                      </a>
                      {goDuoc && (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={dangGo}
                          onClick={() => go([doc])}
                          icon={<Trash2 className="size-4" />}
                          title={t("inventory.goHoSoNay")}
                          aria-label={t("inventory.goHoSoNay")}
                        >
                          <span className="hidden 2xl:inline">{t("inventory.go")}</span>
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
