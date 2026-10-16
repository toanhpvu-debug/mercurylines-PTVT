"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { FileSearch, FileText, Upload, X } from "lucide-react";
import { nhapThietYeuTuTep, xemTruocThietYeu, type XemTruocThietYeu } from "@/app/thiet-yeu-actions";
import { gomNhom, soIn } from "@/lib/thietYeu";
import { useNgonNgu } from "@/lib/i18n/client";
import { Badge, Button, Field, Input, Notice, Select, Table, TableWrap, Td, Th, Tr, TrNhom } from "@/components/ui";

const tenThang = (t: string | null) => (t ? `${t.slice(5)}/${t.slice(0, 4)}` : "");

/**
 * Nhập danh mục phụ tùng thiết yếu của một tàu từ tệp MLS-11-04 (Word / Excel), hai bước:
 * Đọc tệp (máy chủ đọc thử, chưa ghi gì) → xem trước nhóm, mục, tên tàu và ngày trên tệp,
 * mục nào trùng danh mục đang có → chọn tháng của số trong tệp (mặc định theo ô Ngày) và
 * cách nhập → Nhập (máy chủ đọc lại tệp rồi mới ghi).
 */
export default function NhapThietYeuForm({ vesselId, soMucHienCo, thangHienTai }: { vesselId: number; soMucHienCo: number; thangHienTai: string }) {
  const { t } = useNgonNgu();
  const formRef = useRef<HTMLFormElement>(null);
  const [xem, xemAction, dangXem] = useActionState(xemTruocThietYeu, { message: "" } as XemTruocThietYeu);
  const [kq, nhapAction, dangNhap] = useActionState(nhapThietYeuTuTep, { message: "" });
  // Bản xem trước chỉ đúng với tệp vừa đọc: chọn tệp khác / nhập xong thì ẩn.
  const [anXem, setAnXem] = useState(true);
  const [thangSua, setThangSua] = useState<string | null>(null);
  const [cheDo, setCheDo] = useState<"capNhat" | "dongBo">("capNhat");
  // Nhập xong máy chủ chuyển trang (?daNhap=) — trang báo kết quả và bỏ bản in sửa tay cũ
  // (XoaBanInSauNhap); ở đây chỉ còn báo lỗi.

  const tep = !anXem && xem.success ? xem.tep : undefined;
  const thang = thangSua ?? tep?.thang ?? thangHienTai;
  const guiForm = (action: (fd: FormData) => void, them: Record<string, string> = {}) => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    for (const [k, v] of Object.entries(them)) fd.set(k, v);
    // Gửi qua startTransition (không dùng action của <form>) để React không xóa tệp đã chọn.
    startTransition(() => action(fd));
  };
  const docTep = () => {
    setThangSua(null);
    setAnXem(false);
    guiForm(xemAction);
  };
  const nhap = () => {
    if (!tep) return;
    if (tep.khopTau === false && !window.confirm(t("thietYeu.xacNhanTauKhac", { tep: tep.tenTau ?? "", tau: tep.tauDangChon }))) return;
    if (cheDo === "dongBo" && tep.soKhongTrongTep > 0 && !window.confirm(t("thietYeu.xacNhanDongBo", { n: tep.soKhongTrongTep }))) return;
    guiForm(nhapAction, { thang, cheDo: soMucHienCo > 0 ? cheDo : "capNhat" });
    setAnXem(true);
  };

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        docTep();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="vesselId" value={vesselId} />
      <p className="text-xs text-[var(--text-secondary)]">{t("thietYeu.nhapMoTa")}</p>
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
        <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <FileText className="size-4 text-[var(--text-muted)]" />
          {t("thietYeu.tepWord")}
        </p>
        <input
          type="file"
          name="file"
          accept=".doc,.docx,.xlsx,.xls"
          required
          onChange={() => setAnXem(true)}
          className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-brand-600"
        />
      </div>
      {!tep && (
        <Button type="submit" variant="primary" loading={dangXem} icon={<FileSearch className="size-4" />}>
          {dangXem ? t("thietYeu.dangDocTep") : t("thietYeu.nutDocTep")}
        </Button>
      )}
      {!anXem && !dangXem && xem.message && !xem.success && <Notice tone="danger">{xem.message}</Notice>}
      {kq.message && !kq.success && anXem && <Notice tone="danger">{kq.message}</Notice>}

      {tep && (
        <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{t("thietYeu.xtTieuDe", { ten: tep.ten })}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
            <li>
              {tep.tenTau ? (
                <>
                  {t("thietYeu.xtTau", { ten: tep.tenTau })} —{" "}
                  {tep.khopTau === false ? (
                    <span className="font-semibold text-[var(--text-danger)]">{t("thietYeu.xtTauKhac", { tau: tep.tauDangChon })}</span>
                  ) : (
                    <span className="text-[var(--text-success)]">{t("thietYeu.xtTauKhop")}</span>
                  )}
                </>
              ) : (
                t("thietYeu.xtTauKhong")
              )}
            </li>
            <li>{tep.ngay ? t("thietYeu.xtNgay", { ngay: tep.ngay, thang: tenThang(tep.thang) }) : t("thietYeu.xtNgayKhong")}</li>
            <li>
              {t("thietYeu.xtSoMuc", { n: tep.muc.length, nhom: tep.nhom.length })} · {t("thietYeu.xtCoSo", { n: tep.coSo })} · {t("thietYeu.xtThieu", { n: tep.soThieu })}
              {tep.boQua ? ` · ${t("thietYeu.xtBoQua", { n: tep.boQua })}` : ""}
            </li>
            {tep.soCoSan > 0 && <li>{t("thietYeu.xtDoiChieu", { coSan: tep.soCoSan, trung: tep.soTrung, moi: tep.muc.length - tep.soTrung, bo: tep.soKhongTrongTep })}</li>}
          </ul>
          <div className="flex flex-wrap gap-1.5">
            {tep.nhom.map((g) => (
              <Badge key={g.ten} tone={g.soThieu ? "warning" : "neutral"}>
                {g.ten.length > 60 ? `${g.ten.slice(0, 58)}…` : g.ten} · {g.soMuc}
              </Badge>
            ))}
          </div>
          <div className="max-h-96 overflow-y-auto">
            <TableWrap>
              <Table dense xuongDong>
                <thead>
                  <tr>
                    <Th className="w-10">#</Th>
                    <Th className="min-w-56">{t("thietYeu.cot_moTa")}</Th>
                    <Th>{t("thietYeu.partNo")}</Th>
                    <Th>{t("thietYeu.cot_toiThieu")}</Th>
                    <Th className="text-right">{t("thietYeu.cot_hienCo")}</Th>
                    <Th>{t("thietYeu.cot_soThang")}</Th>
                    {tep.soCoSan > 0 && <Th>{t("thietYeu.cot_doiChieu")}</Th>}
                  </tr>
                </thead>
                <tbody>
                  {gomNhom(tep.muc).map((g) => (
                    <PhanNhom key={g.nhom} ten={g.nhom} cot={tep.soCoSan > 0 ? 7 : 6}>
                      {g.dong.map((m, i) => (
                        <Tr key={i}>
                          <Td className="tabular text-[var(--text-muted)]">{m.stt}</Td>
                          <Td className="min-w-56">{m.moTa}</Td>
                          <Td className="whitespace-nowrap text-xs">{m.partNo ?? ""}</Td>
                          <Td className="whitespace-nowrap">{m.toiThieu ?? ""}</Td>
                          <Td className={`tabular text-right ${m.thieu ? "font-semibold text-[var(--text-danger)]" : ""}`}>{soIn(m.hienCo)}</Td>
                          <Td className="tabular whitespace-nowrap text-xs text-[var(--text-muted)]">
                            {[m.tonDau, m.nhan, m.tieuThu].some((v) => v !== null) ? `${soIn(m.tonDau) || "–"} + ${soIn(m.nhan) || "–"} − ${soIn(m.tieuThu) || "–"}` : ""}
                          </Td>
                          {tep.soCoSan > 0 && (
                            <Td>
                              <Badge tone={m.trung ? "success" : "info"}>{m.trung ? t("thietYeu.trung") : t("thietYeu.mucMoi")}</Badge>
                            </Td>
                          )}
                        </Tr>
                      ))}
                    </PhanNhom>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("thietYeu.thangSoTep")} className="w-48">
              <Input type="month" value={thang} max={thangHienTai} onChange={(e) => setThangSua(e.target.value)} />
            </Field>
            {soMucHienCo > 0 && (
              <Field label={t("thietYeu.cheDo")} className="w-[26rem] max-w-full">
                <Select value={cheDo} onChange={(e) => setCheDo(e.target.value === "dongBo" ? "dongBo" : "capNhat")}>
                  <option value="capNhat">{t("thietYeu.cheDo_capNhat")}</option>
                  <option value="dongBo">{t("thietYeu.cheDo_dongBo")}</option>
                </Select>
              </Field>
            )}
            <Button type="button" variant="primary" onClick={nhap} loading={dangNhap} disabled={!thang} icon={<Upload className="size-4" />}>
              {t("thietYeu.nutXacNhanNhap", { n: tep.muc.length })}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAnXem(true);
                formRef.current?.reset();
              }}
              icon={<X className="size-4" />}
            >
              {t("thietYeu.chonTepKhac")}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

function PhanNhom({ ten, cot, children }: { ten: string; cot: number; children: React.ReactNode }) {
  return (
    <>
      <TrNhom colSpan={cot}>{ten}</TrNhom>
      {children}
    </>
  );
}
