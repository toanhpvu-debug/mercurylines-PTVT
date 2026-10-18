"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, CheckSquare, X } from "lucide-react";
import { ghiNhapXuatHangLoat, layDongTonNhapXuat, type DongNhapXuat } from "@/app/nhap-xuat-hang-loat-actions";
import { useNgonNgu } from "@/lib/i18n/client";
import { isoTuGioMay } from "@/lib/gioMay";
import { Button, Field, Input, Notice, Table, TableWrap, Td, Th } from "@/components/ui";
import { Modal } from "@/components/ui-client";

/**
 * Nhập / xuất HÀNG LOẠT cho bảng tồn kho (trang Tồn kho, hồ sơ tàu).
 *
 * Bảng là server component hàng trăm dòng — không biến cả bảng thành client chỉ để có ô tick (cùng
 * cách ChonHangLoat ở Danh mục): ô tick là <input> thường do server vẽ —
 *   data-chon-ton="<id dòng tồn>" data-bang="<bảng>" [data-nhom="<nhóm>"]   từng dòng
 *   data-chon-ton-bang="<bảng>"   chọn cả bảng (đầu cột)
 *   data-chon-ton-nhom="<nhóm>"   chọn cả bộ phận (dòng tiêu đề bộ phận)
 * — thành phần này nghe "change" ở cấp document, giữ danh sách đã chọn, hiện thanh nổi Nhập kho /
 * Xuất kho và hộp ghi số lượng từng dòng. Đặt `key` theo trang / bộ lọc để đổi trang là chọn lại từ đầu.
 */
const O_DONG = "input[data-chon-ton]";
const dangThay = (o: HTMLInputElement) => !o.closest("[hidden]");

export default function NhapXuatHangLoat() {
  const { t } = useNgonNgu();
  const router = useRouter();
  const [chon, setChon] = useState<number[]>([]);
  const [hop, setHop] = useState<"IN" | "OUT" | null>(null);
  const [bao, setBao] = useState<string | null>(null);

  /** Đọc lại mọi ô tick → state; chỉnh ô "chọn cả bảng / cả nhóm" theo đó. */
  const dongBo = () => {
    const ids: number[] = [];
    const dem = new Map<string, { tong: number; chon: number }>();
    const cong = (k: string | undefined, daChon: boolean) => {
      if (!k) return;
      const x = dem.get(k) ?? { tong: 0, chon: 0 };
      x.tong++;
      if (daChon) x.chon++;
      dem.set(k, x);
    };
    document.querySelectorAll<HTMLInputElement>(O_DONG).forEach((el) => {
      const id = Number(el.dataset.chonTon);
      if (!Number.isInteger(id) || id <= 0 || !dangThay(el)) return;
      if (el.checked) ids.push(id);
      cong(`b:${el.dataset.bang ?? ""}`, el.checked);
      cong(`n:${el.dataset.nhom ?? ""}`, el.checked);
    });
    const datO = (el: HTMLInputElement, k: string) => {
      const x = dem.get(k) ?? { tong: 0, chon: 0 };
      el.checked = x.tong > 0 && x.chon === x.tong;
      el.indeterminate = x.chon > 0 && x.chon < x.tong;
    };
    document.querySelectorAll<HTMLInputElement>("input[data-chon-ton-bang]").forEach((el) => datO(el, `b:${el.dataset.chonTonBang}`));
    document.querySelectorAll<HTMLInputElement>("input[data-chon-ton-nhom]").forEach((el) => datO(el, `n:${el.dataset.chonTonNhom}`));
    setChon([...new Set(ids)]);
  };

  useEffect(() => {
    const onChange = (e: Event) => {
      const el = e.target as HTMLInputElement | null;
      if (!el || el.tagName !== "INPUT" || el.type !== "checkbox") return;
      const datTheo = (thuocTinh: string, giaTri: string) =>
        document.querySelectorAll<HTMLInputElement>(`${O_DONG}[${thuocTinh}="${CSS.escape(giaTri)}"]`).forEach((o) => {
          if (dangThay(o)) o.checked = el.checked;
        });
      if (el.dataset.chonTonBang !== undefined) datTheo("data-bang", el.dataset.chonTonBang);
      else if (el.dataset.chonTonNhom !== undefined) datTheo("data-nhom", el.dataset.chonTonNhom);
      else if (el.dataset.chonTon === undefined) return;
      dongBo();
    };
    document.addEventListener("change", onChange);
    const id = window.setTimeout(dongBo, 0);
    return () => {
      document.removeEventListener("change", onChange);
      window.clearTimeout(id);
    };
  }, []);

  const boChon = () => {
    document.querySelectorAll<HTMLInputElement>(`${O_DONG}, input[data-chon-ton-bang], input[data-chon-ton-nhom]`).forEach((o) => {
      o.checked = false;
      o.indeterminate = false;
    });
    setChon([]);
  };

  const n = chon.length;
  if (n === 0 && !bao) return null;
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
        <div className="pointer-events-auto surface flex max-w-full flex-wrap items-center gap-2 rounded-2xl border px-4 py-2.5 shadow-2xl">
          {n > 0 && (
            <>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
                <CheckSquare className="size-4 text-brand-700 dark:text-brand-300" />
                {t("inventory.hl_daChon", { n })}
              </span>
              <Button type="button" size="sm" variant="primary" icon={<ArrowDownToLine className="size-4" />} onClick={() => setHop("IN")}>
                {t("inventory.optNhapKho")}
              </Button>
              <Button type="button" size="sm" variant="primary" icon={<ArrowUpFromLine className="size-4" />} onClick={() => setHop("OUT")}>
                {t("inventory.optXuatKho")}
              </Button>
              <Button type="button" size="sm" variant="ghost" icon={<X className="size-4" />} onClick={boChon}>
                {t("materials.boChon")}
              </Button>
            </>
          )}
          {bao && (
            <div className="basis-full">
              <Notice tone="success" className="flex items-start justify-between gap-2">
                <span>{bao}</span>
                <button type="button" onClick={() => setBao(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label={t("chung.dong")}>
                  <X className="size-4" />
                </button>
              </Notice>
            </div>
          )}
        </div>
      </div>
      {hop && (
        <HopNhapXuat
          type={hop}
          ids={chon}
          dong={() => setHop(null)}
          xong={(chu) => {
            setHop(null);
            boChon();
            setBao(chu);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/** Hộp ghi số lượng từng dòng đã chọn (ô trống = bỏ qua), cùng thời điểm + ghi chú cho cả phiếu. */
function HopNhapXuat({ type, ids, dong, xong }: { type: "IN" | "OUT"; ids: number[]; dong: () => void; xong: (chu: string) => void }) {
  const { t, so: dinhSo } = useNgonNgu();
  const [hang, setHang] = useState<DongNhapXuat[] | null>(null);
  const [so, setSo] = useState<Record<number, string>>({});
  const [thoiDiem, setThoiDiem] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [dienSo, setDienSo] = useState("");
  const [loi, setLoi] = useState("");
  const [pending, start] = useTransition();
  const xuat = type === "OUT";

  useEffect(() => {
    let boQua = false;
    layDongTonNhapXuat(ids).then((kq) => {
      if (boQua) return;
      if (kq.dong) setHang(kq.dong);
      else setLoi(kq.message);
    });
    return () => {
      boQua = true;
    };
  }, [ids]);

  const soCua = (id: number) => {
    const x = Number((so[id] ?? "").replace(",", "."));
    return Number.isFinite(x) ? x : NaN;
  };
  const coGhi = (hang ?? []).filter((h) => (so[h.id] ?? "").trim() !== "" && soCua(h.id) > 0);
  const sai = (hang ?? []).filter((h) => (so[h.id] ?? "").trim() !== "" && !(soCua(h.id) > 0));
  // Xuất quá tồn hiện có: tô đỏ và khóa nút Ghi (máy chủ vẫn kiểm lại trong giao dịch).
  const vuotTon = new Set(xuat ? (hang ?? []).filter((h) => soCua(h.id) > h.ton + 1e-9).map((h) => h.id) : []);

  const dienChoMoiDong = (gt: (h: DongNhapXuat) => string) => setSo(Object.fromEntries((hang ?? []).map((h) => [h.id, gt(h)])));
  const ghi = () =>
    start(async () => {
      setLoi("");
      if (!coGhi.length) {
        setLoi(t("inventory.hl_chuaCoSo"));
        return;
      }
      const kq = await ghiNhapXuatHangLoat({
        type,
        occurredAt: isoTuGioMay(thoiDiem),
        note: ghiChu,
        dong: coGhi.map((h) => ({ id: h.id, soLuong: soCua(h.id) })),
      });
      if (kq.success) {
        xong(kq.message);
        return;
      }
      setLoi(kq.message);
      // Máy chủ báo tồn mới nhất của các dòng thiếu → cập nhật cột Tồn để thấy ngay dòng nào vượt.
      if (kq.thieu?.length) {
        const con = new Map(kq.thieu.map((x) => [x.id, x.con]));
        setHang((hs) => (hs ?? []).map((h) => (con.has(h.id) ? { ...h, ton: con.get(h.id)! } : h)));
      }
    });

  return (
    <Modal open onClose={dong} width="max-w-4xl" title={t(xuat ? "inventory.hl_tieuDeXuat" : "inventory.hl_tieuDeNhap", { n: ids.length })}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          ghi();
        }}
      >
        <p className="text-sm text-[var(--text-secondary)]">{t(xuat ? "inventory.hl_moTaXuat" : "inventory.hl_moTaNhap")}</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t("inventory.goiYThoiDiem")}>
            <Input type="datetime-local" value={thoiDiem} onChange={(e) => setThoiDiem(e.target.value)} />
          </Field>
          <Field label={t("chung.ghiChu")}>
            <Input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder={t("inventory.ghiChuGoiY")} maxLength={500} />
          </Field>
        </div>
        {hang && hang.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t("inventory.hl_dienCungSo")}>
              <Input type="number" min="0" step="any" inputMode="decimal" value={dienSo} onChange={(e) => setDienSo(e.target.value)} className="w-32" />
            </Field>
            <Button type="button" size="sm" disabled={!(Number(dienSo) > 0)} onClick={() => dienChoMoiDong(() => dienSo)}>
              {t("inventory.hl_dienChoMoiDong")}
            </Button>
            {xuat && (
              <Button type="button" size="sm" onClick={() => dienChoMoiDong((h) => (h.ton > 0 ? String(h.ton) : ""))}>
                {t("inventory.hl_dienBangTon")}
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => setSo({})}>
              {t("inventory.hl_xoaSo")}
            </Button>
          </div>
        )}
        {hang === null && !loi ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">{t("chung.dangTai")}</p>
        ) : hang ? (
          // Cuộn riêng, tiêu đề ghim: vài trăm dòng thì nút Ghi bên dưới vẫn luôn thấy.
          <TableWrap className="max-h-[45vh] overflow-y-auto">
            <Table dense xuongDong>
              <thead className="sticky top-0 z-10 bg-[var(--surface-raised)]">
                <tr>
                  <Th>{t("chung.ma")}</Th>
                  <Th>{t("inventory.cotTenVatTu")}</Th>
                  <Th>{t("chung.kho")}</Th>
                  <Th align="right">{t("inventory.cotTon")}</Th>
                  <Th>{t("chung.soLuong")}</Th>
                </tr>
              </thead>
              <tbody>
                {hang.map((h) => {
                  const vuot = vuotTon.has(h.id);
                  const saiSo = (so[h.id] ?? "").trim() !== "" && !(soCua(h.id) > 0);
                  return (
                    <tr key={h.id} className="last:[&>td]:border-b-0">
                      <Td className="font-display text-xs tracking-wide whitespace-nowrap">{h.ma}</Td>
                      <Td>{h.ten}</Td>
                      <Td className="font-display text-xs tracking-wide whitespace-nowrap text-[var(--text-muted)]">{h.khoMa}</Td>
                      <Td align="right" className="whitespace-nowrap">
                        {dinhSo(h.ton)} <span className="text-xs text-[var(--text-muted)]">{h.dvt}</span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          aria-label={`${t("chung.soLuong")} ${h.ma}`}
                          value={so[h.id] ?? ""}
                          onChange={(e) => setSo((s) => ({ ...s, [h.id]: e.target.value }))}
                          className={vuot || saiSo ? "w-28 border-[var(--text-danger)] ring-1 ring-[var(--text-danger)]" : "w-28"}
                        />
                        {vuot && <span className="mt-0.5 block text-xs text-[var(--text-danger)]">{t("inventory.hl_vuotTon", { n: dinhSo(h.ton) })}</span>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        ) : null}
        {loi && <Notice tone="danger">{loi}</Notice>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[var(--text-muted)]">{hang ? t("inventory.hl_seGhi", { n: coGhi.length, tong: hang.length }) : ""}</span>
          <div className="flex gap-2">
            <Button type="button" onClick={dong}>
              {t("chung.huy")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              disabled={!hang || coGhi.length === 0 || vuotTon.size > 0 || sai.length > 0}
              icon={xuat ? <ArrowUpFromLine className="size-4" /> : <ArrowDownToLine className="size-4" />}
            >
              {t(xuat ? "inventory.hl_nutXuat" : "inventory.hl_nutNhap", { n: coGhi.length })}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
