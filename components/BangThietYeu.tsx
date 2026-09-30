"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import LogoBieuMau from "@/components/LogoBieuMau";
import { luuThangThietYeu, themPhuTungThietYeu, xoaPhuTungThietYeu, type DongLuuThang } from "@/app/thiet-yeu-actions";
import { gomNhom, laThieu, soIn, soTuToiThieu, type DongThietYeu } from "@/lib/thietYeu";
import { useNgonNgu } from "@/lib/i18n/client";
import { Badge, Button, Field, Input, Notice, Select } from "@/components/ui";

/** Một dòng đang sửa — mọi ô là chuỗi để gõ tự do. */
type DongSua = DongLuuThang & {
  nhom: string;
  stt: string;
  nguon: DongThietYeu["nguon"];
  maVatTu: string | null;
};

const tuGoc = (d: DongThietYeu): DongSua => ({
  id: d.id,
  nhom: d.nhom,
  stt: d.stt,
  moTa: d.moTa,
  partNo: d.partNo ?? "",
  toiThieu: d.toiThieu ?? "",
  tonDau: soIn(d.tonDau),
  nhan: soIn(d.nhan),
  tieuThu: soIn(d.tieuThu),
  hienCo: soIn(d.hienCo),
  viTri: d.viTri ?? "",
  nguon: d.nguon,
  maVatTu: d.maVatTu,
});

const so = (s: string) => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const O_SUA = "w-full min-w-0 border-0 bg-transparent p-0 text-inherit focus:outline-none focus:ring-1 focus:ring-brand-500";
const O = "border border-black p-1";

/** Một ô: đang sửa là <input>, không thì là chữ. Ở cấp module để ô không mất con trỏ khi gõ. */
function Cell({ sua, giaTri, onChange, trai }: { sua: boolean; giaTri: string; onChange: (v: string) => void; trai?: boolean }) {
  if (!sua) return <>{giaTri}</>;
  return <input value={giaTri} onChange={(e) => onChange(e.target.value)} className={`${O_SUA} ${trai ? "text-left" : "text-center"}`} />;
}

const TONE_NGUON = { DA_LUU: "success", KHO: "info", UOC: "muted" } as const;

/**
 * Bảng MLS-11-04 của một tàu cho một tháng: xem, sửa số tháng rồi lưu, thêm /
 * xóa mục, và là luôn bản in (vùng .print-area dựng theo đúng mẫu công ty).
 */
export default function BangThietYeu({
  vesselId,
  thang,
  tenTau,
  ngay,
  dongGoc,
  coQuyen,
}: {
  vesselId: number;
  thang: string;
  tenTau: string;
  ngay: string;
  dongGoc: DongThietYeu[];
  coQuyen: boolean;
}) {
  const { t, tTuDo } = useNgonNgu();
  const router = useRouter();
  const [sua, setSua] = useState(false);
  const [dong, setDong] = useState<DongSua[]>(() => dongGoc.map(tuGoc));
  const [gocTruoc, setGocTruoc] = useState(dongGoc);
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dangGui, startTransition] = useTransition();
  const [moi, setMoi] = useState({ nhom: dongGoc[0]?.nhom ?? "", nhomMoi: "", moTa: "", partNo: "", toiThieu: "" });

  // Server trả bảng mới (sau khi lưu / thêm / xóa / đổi tháng): không sửa thì
  // lấy nguyên; đang sửa thì giữ ô đã gõ của mục cũ, thêm mục mới, bỏ mục đã xóa.
  if (dongGoc !== gocTruoc) {
    setGocTruoc(dongGoc);
    setDong((cu) => {
      if (!sua) return dongGoc.map(tuGoc);
      const cuTheoId = new Map(cu.map((d) => [d.id, d]));
      return dongGoc.map((g) => cuTheoId.get(g.id) ?? tuGoc(g));
    });
  }

  const nhomCoSan = gomNhom(dongGoc).map((g) => g.nhom);
  const nhomHienThi = gomNhom(dong);

  const capNhat = (id: number, patch: Partial<DongSua>) =>
    setDong((ds) =>
      ds.map((d) => {
        if (d.id !== id) return d;
        const m = { ...d, ...patch };
        // Đổi ban đầu / nhận / tiêu thụ → hiện có tự tính lại (sửa tay đè được).
        if ("tonDau" in patch || "nhan" in patch || "tieuThu" in patch) {
          const a = so(m.tonDau);
          if (a !== null) m.hienCo = soIn(a + (so(m.nhan) ?? 0) - (so(m.tieuThu) ?? 0));
        }
        return m;
      })
    );

  const bao = (r: { message: string; success?: boolean }) => setThongBao({ ok: Boolean(r.success), chu: r.message });

  const luu = () =>
    startTransition(async () => {
      const r = await luuThangThietYeu(vesselId, thang, dong.map(({ id, moTa, partNo, toiThieu, tonDau, nhan, tieuThu, hienCo, viTri }) => ({ id, moTa, partNo, toiThieu, tonDau, nhan, tieuThu, hienCo, viTri })));
      bao(r);
      if (r.success) {
        setSua(false);
        router.refresh();
      }
    });

  const huy = () => {
    if (!window.confirm(t("thietYeu.xacNhanHuy"))) return;
    setDong(dongGoc.map(tuGoc));
    setSua(false);
    setThongBao(null);
  };

  const them = () =>
    startTransition(async () => {
      const nhom = moi.nhom === "__moi__" ? moi.nhomMoi : moi.nhom;
      const r = await themPhuTungThietYeu(vesselId, { nhom, moTa: moi.moTa, partNo: moi.partNo, toiThieu: moi.toiThieu });
      bao(r);
      if (r.success) {
        setMoi((m) => ({ ...m, nhom: nhom, nhomMoi: "", moTa: "", partNo: "", toiThieu: "" }));
        router.refresh();
      }
    });

  const xoa = (d: DongSua) => {
    if (!window.confirm(t("thietYeu.xacNhanXoa", { moTa: d.moTa }))) return;
    startTransition(async () => {
      const r = await xoaPhuTungThietYeu(d.id);
      bao(r);
      if (r.success) router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {coQuyen && (
        <div className="no-print flex flex-wrap items-center gap-2">
          {sua ? (
            <>
              <Button type="button" variant="primary" size="sm" onClick={luu} loading={dangGui} icon={<Check className="size-4" />}>
                {dangGui ? t("thietYeu.dangLuu") : t("thietYeu.luuThang", { thang })}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={huy} disabled={dangGui} icon={<X className="size-4" />}>
                {t("thietYeu.huySua")}
              </Button>
              <span className="text-xs text-[var(--text-muted)]">{t("thietYeu.goiYSua")}</span>
            </>
          ) : (
            <Button type="button" size="sm" onClick={() => { setSua(true); setThongBao(null); }} icon={<Pencil className="size-4" />}>
              {t("thietYeu.suaSo")}
            </Button>
          )}
        </div>
      )}
      {thongBao && (
        <Notice tone={thongBao.ok ? "success" : "danger"} className="no-print">
          {thongBao.chu}
        </Notice>
      )}

      {sua && (
        <div className="no-print grid grid-cols-1 items-end gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 md:grid-cols-[14rem_1fr_9rem_9rem_auto]">
          <Field label={t("thietYeu.nhom")}>
            <Select value={moi.nhom} onChange={(e) => setMoi({ ...moi, nhom: e.target.value })}>
              {nhomCoSan.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="__moi__">{t("thietYeu.nhomMoi")}</option>
            </Select>
          </Field>
          <Field label={t("thietYeu.moTaMuc")}>
            {moi.nhom === "__moi__" && (
              <Input className="mb-2" value={moi.nhomMoi} placeholder={t("thietYeu.tenNhomMoi")} onChange={(e) => setMoi({ ...moi, nhomMoi: e.target.value })} />
            )}
            <Input value={moi.moTa} onChange={(e) => setMoi({ ...moi, moTa: e.target.value })} />
          </Field>
          <Field label={t("thietYeu.partNo")}>
            <Input value={moi.partNo} onChange={(e) => setMoi({ ...moi, partNo: e.target.value })} />
          </Field>
          <Field label={t("thietYeu.toiThieu")}>
            <Input value={moi.toiThieu} onChange={(e) => setMoi({ ...moi, toiThieu: e.target.value })} />
          </Field>
          <Button type="button" onClick={them} disabled={dangGui} icon={<Plus className="size-4" />}>
            {t("thietYeu.nutThem")}
          </Button>
        </div>
      )}

      <div className="print-area surface overflow-x-auto rounded-xl border p-6 shadow-sm print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <table className="w-full border-2 border-black text-sm">
          <tbody>
            <tr>
              <td className="w-44 border border-black p-2 align-middle">
                <LogoBieuMau />
              </td>
              <td className="border border-black p-2 text-center">
                <p className="font-bold">CÔNG TY TNHH MERCURY LINES</p>
                <p className="font-bold">MERCURY LINES COMPANY LIMITED</p>
                <p className="text-xs italic">Phù hợp: Bộ luật ISM 5.2,6.1.3,10.1</p>
              </td>
              <td className="w-44 border border-black p-2 text-xs">
                <p>MLS-11-04</p>
                <p>Ngày ban hành: 10/01/2024</p>
                <p>Soát xét: 00</p>
                <p>Ngày soát xét:………</p>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black p-1 text-center text-sm font-bold">
                Tiêu đề: DANH MỤC PHỤ TÙNG THIẾT YÊU TRÊN TÀU
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 text-center">
          <p className="text-base font-bold">DANH MỤC KIỂM TRA PHỤ TÙNG THIẾT YẾU TRÊN TÀU</p>
          <p className="text-base font-bold">CHECK LIST FOR ESSENTIAL SPARE PARTS ONBOARD</p>
        </div>
        <p className="mt-2 flex flex-wrap gap-x-10 text-sm">
          <span>
            Tên tàu (<i>Vessel</i>) <b>{tenTau}</b>
          </span>
          <span>
            Ngày (<i>Date</i>): {ngay}
          </span>
        </p>

        <table className="mt-2 w-full border-2 border-black text-xs">
          <thead>
            <tr className="text-center align-middle">
              <th className={`${O} w-8`}>stt</th>
              <th className={O}>
                Mô tả
                <br />
                <i>Description</i>
              </th>
              <th className={`${O} w-24`}>
                Số phụ tùng
                <br />
                <i>Spare Part No.</i>
              </th>
              <th className={`${O} w-20`}>
                Tối thiểu
                <br />
                <i>Minimum</i>
              </th>
              <th className={`${O} w-20`}>
                Số phụ tùng ban đầu
                <br />
                <i>Begin stock</i>
              </th>
              <th className={`${O} w-20`}>
                Số phụ tùng nhận trong tháng
                <br />
                <i>Rcvd. in month</i>
              </th>
              <th className={`${O} w-20`}>
                Tổng tiêu thụ
                <br />
                <i>Total conspt</i>
              </th>
              <th className={`${O} w-20`}>
                Hiện có
                <br />
                <i>Remain onboard</i>
              </th>
              <th className={`${O} w-24`}>
                Vị trí
                <br />
                <i>Location</i>
              </th>
              <th className={`no-print ${O} w-24`}>{t("thietYeu.nguon")}</th>
            </tr>
          </thead>
          <tbody>
            {nhomHienThi.map((g) => (
              <NhomRows key={g.nhom} nhom={g.nhom}>
                {g.dong.map((d) => {
                  const thieu = laThieu({ toiThieuSo: soTuToiThieu(d.toiThieu), hienCo: so(d.hienCo) });
                  return (
                    <tr key={d.id} className={`text-center align-top ${thieu ? "bg-rose-50 print:bg-transparent dark:bg-rose-950/30" : ""}`}>
                      <td className={O}>{d.stt}</td>
                      <td className={`${O} text-left`}>
                        <Cell sua={sua} giaTri={d.moTa} onChange={(v) => capNhat(d.id, { moTa: v })} trai />
                      </td>
                      <td className={O}>
                        <Cell sua={sua} giaTri={d.partNo} onChange={(v) => capNhat(d.id, { partNo: v })} />
                      </td>
                      <td className={O}>
                        <Cell sua={sua} giaTri={d.toiThieu} onChange={(v) => capNhat(d.id, { toiThieu: v })} />
                      </td>
                      <td className={O}>
                        <Cell sua={sua} giaTri={d.tonDau} onChange={(v) => capNhat(d.id, { tonDau: v })} />
                      </td>
                      <td className={O}>
                        <Cell sua={sua} giaTri={d.nhan} onChange={(v) => capNhat(d.id, { nhan: v })} />
                      </td>
                      <td className={O}>
                        <Cell sua={sua} giaTri={d.tieuThu} onChange={(v) => capNhat(d.id, { tieuThu: v })} />
                      </td>
                      <td className={`${O} font-semibold ${thieu ? "text-[var(--text-danger)] print:text-inherit" : ""}`}>
                        <Cell sua={sua} giaTri={d.hienCo} onChange={(v) => capNhat(d.id, { hienCo: v })} />
                      </td>
                      <td className={O}>
                        <Cell sua={sua} giaTri={d.viTri} onChange={(v) => capNhat(d.id, { viTri: v })} />
                      </td>
                      <td className={`no-print ${O}`}>
                        <div className="flex items-center justify-center gap-1">
                          <Badge tone={TONE_NGUON[d.nguon]}>{tTuDo(`thietYeu.nguon_${d.nguon}`)}</Badge>
                          {sua && (
                            <button
                              type="button"
                              onClick={() => xoa(d)}
                              disabled={dangGui}
                              title={t("thietYeu.xoaMuc")}
                              aria-label={t("thietYeu.xoaMuc")}
                              className="rounded p-0.5 text-[var(--text-danger)] hover:bg-rose-500/10"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                        {d.maVatTu && <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{t("thietYeu.ganKho", { ma: d.maVatTu })}</p>}
                      </td>
                    </tr>
                  );
                })}
              </NhomRows>
            ))}
          </tbody>
        </table>

        <div className="mt-8 grid grid-cols-2 text-center text-sm">
          <div>
            <p className="font-semibold">Máy trưởng</p>
            <p className="italic">Chief Engineer</p>
          </div>
          <div>
            <p className="font-semibold">Thuyền trưởng</p>
            <p className="italic">Master</p>
          </div>
        </div>
        <div className="mt-16 grid grid-cols-4 gap-2 border-t border-black pt-1 text-[10px]">
          <p>Người làm báo cáo: CE, CO</p>
          <p>Thời điểm làm báo cáo: Hàng tháng</p>
          <p>Thời gian lưu: 3 năm</p>
          <p>Lưu VP: Vật tư</p>
        </div>
      </div>
    </div>
  );
}

/** Dòng tiêu đề nhóm ("A. Phụ tùng cho Máy chính …") gộp cả chiều ngang như trên mẫu, rồi tới các dòng mục. */
function NhomRows({ nhom, children }: { nhom: string; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td colSpan={9} className={`${O} text-left font-bold`}>
          {nhom}
        </td>
        <td className={`no-print ${O}`} />
      </tr>
      {children}
    </>
  );
}
