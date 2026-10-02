"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, ListX, Pencil, Plus, Printer, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { LogoLockup } from "@/components/MercuryLogo";
import { useNgonNgu } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { Button, Notice } from "@/components/ui";
import {
  apDungBanSua,
  banSuaRong,
  boDongBanIn,
  demChoKhac,
  docBanSua,
  doiChoDongBanIn,
  gonBanSua,
  suaDauBanIn,
  suaOBanIn,
  uocSoTrang,
  type BanSuaBaoCaoSon,
  type CotDauSon,
  type CotDongSon,
  type DauBaoCaoSon,
  type DongBaoCaoSon,
} from "@/lib/tonSon";

/*
 * BÁO CÁO SƠN in đúng mẫu MLS-11-05 "REQUISITION FOR STORES / YÊU CẦU VẬT TƯ"
 * của công ty — dựng lại từ chính tệp Excel mẫu (MLS-11-05 - CO - Paint):
 *   - 9 cột A–I đúng tỉ lệ bề rộng, chữ Times New Roman đúng cỡ từng ô (pt),
 *     chiều cao hàng đúng như tệp, khung đôi ở đầu biểu mẫu và đầu bảng;
 *   - A4 dọc, lề trái 0,2" · phải 0,25" · trên/dưới 0,75", căn giữa ngang;
 *   - chân trang "Người làm báo cáo: CE, CO · Thời điểm làm báo cáo: Khi cần
 *     thiết | Thời gian lưu: 3 năm · Lưu VP: Vật tư".
 * Chữ, khung, bố cục của mẫu không đổi; chỉ điền số liệu.
 *
 * "Sửa trước khi in": đổi ô, bỏ dòng, thêm dòng, đổi thứ tự, điền số yêu cầu —
 * chỉ đổi tờ in (lib/tonSon.ts: bản sửa cất trong localStorage theo tàu, áp lên
 * số liệu mới nhất), không đổi tồn sơn của tàu.
 */

// Bề rộng cột A–I theo tệp mẫu (đơn vị ký tự Excel 7,29 · 5 · 18,29 · 17,43 · 13,43 · 6,71 · 8,29 · 9,29 · 12,71).
const COT = [7.402, 5.081, 18.58, 17.707, 13.642, 6.819, 8.418, 9.435, 12.916];
const pt = (n: number) => `${n}pt`;
const VIEN = "1px solid #000";
const VIEN_DOI = "3px double #000";
const VIEN_CHAM = "1px dotted #000";

const CSS_TO_IN = `
@page { size: A4 portrait; margin: 19.05mm 6.35mm 19.05mm 5.08mm; }
.to-son-a4 { width: 210mm; min-height: 297mm; padding: 19.05mm 6.35mm 19.05mm 5.08mm; margin: 0 auto;
  display: flex; flex-direction: column; background: #fff; color: #000;
  font-family: "Times New Roman", Times, "Liberation Serif", serif;
  box-shadow: 0 1px 3px rgba(15, 23, 42, .18), 0 10px 30px rgba(15, 23, 42, .14); }
.to-son-a4.dang-sua { margin-right: 32mm; }
.to-son-a4 table.bm { width: 100%; max-width: 196mm; margin: 0 auto; border-collapse: collapse; table-layout: fixed; }
.to-son-a4 table.bm td, .to-son-a4 table.bm th { padding: 0 3px; vertical-align: middle; line-height: 1.15; font-weight: 400; overflow-wrap: anywhere; }
.to-son-a4 table.bm tr { break-inside: avoid; }
.to-son-a4 p { margin: 0; }
@media print {
  .to-son-a4, .to-son-a4.dang-sua { width: auto; min-height: 250mm; padding: 0; margin: 0; box-shadow: none; }
}
`;

/** Một ô sửa được: chữ thường khi xem, ô nhập trong suốt khi sửa (in ra vẫn như chữ). */
function O({
  sua,
  giaTri,
  onDoi,
  canh = "center",
  nhan,
  goiY,
}: {
  sua: boolean;
  giaTri: string;
  onDoi: (v: string) => void;
  canh?: "left" | "center" | "right";
  nhan: string;
  goiY?: string;
}) {
  if (!sua) return <>{giaTri}</>;
  return (
    <input
      value={giaTri}
      onChange={(e) => onDoi(e.target.value)}
      aria-label={nhan}
      placeholder={goiY}
      className={cn(
        "o-sua block w-full min-w-0 border-0 bg-transparent p-0 focus:outline-none focus:ring-1 focus:ring-brand-500",
        canh === "left" ? "text-left" : canh === "right" ? "text-right" : "text-center"
      )}
    />
  );
}

export default function BaoCaoSonSua({
  khoaLuu,
  dauGoc,
  dongGoc,
  vesselId,
  coSuaTon,
}: {
  /** Khóa localStorage — theo tàu. */
  khoaLuu: string;
  dauGoc: DauBaoCaoSon;
  dongGoc: DongBaoCaoSon[];
  vesselId: number;
  /** Người xem sửa được tồn sơn thật (để chỉ đường sang bảng Tồn sơn). */
  coSuaTon: boolean;
}) {
  const { t } = useNgonNgu();
  const goc = useMemo(() => ({ dau: dauGoc, dong: dongGoc }), [dauGoc, dongGoc]);
  const [ban, setBan] = useState<BanSuaBaoCaoSon>(banSuaRong);
  const [daNap, setDaNap] = useState(false);
  const [sua, setSua] = useState(false);
  const [soTrang, setSoTrang] = useState(1);
  const noiDung = useRef<HTMLDivElement>(null);

  // Nạp bản sửa lần trước (nếu có); bắt đầu trong setTimeout để không setState
  // ngay trong thân effect. Phần trỏ tới loại sơn đã gỡ khỏi tàu thì bỏ.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(khoaLuu);
        const b = raw ? docBanSua(JSON.parse(raw)) : null;
        if (b) setBan(gonBanSua(goc, b));
      } catch {
        /* localStorage bị chặn hay dữ liệu hỏng: dùng số liệu gốc */
      }
      setDaNap(true);
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khoaLuu]);

  // Ước số trang (ô "Page: 1 of N" của mẫu): tờ xem trước dựng đúng khổ giấy nên
  // chiều cao đo trên màn hình là chiều cao khi in.
  useEffect(() => {
    const el = noiDung.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setSoTrang(uocSoTrang(el.getBoundingClientRect().height + 50)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // In lúc đang sửa (Ctrl+P): thoát chế độ sửa trước để không in chữ gợi ý trong ô trống.
  useEffect(() => {
    const truocKhiIn = () => flushSync(() => setSua(false));
    window.addEventListener("beforeprint", truocKhiIn);
    return () => window.removeEventListener("beforeprint", truocKhiIn);
  }, []);

  const luu = (moi: BanSuaBaoCaoSon) => {
    setBan(moi);
    try {
      window.localStorage.setItem(khoaLuu, JSON.stringify(moi));
    } catch {
      /* không lưu được thì vẫn sửa được trong phiên này */
    }
  };

  const { dau, dong } = apDungBanSua(goc, ban);
  const soChoKhac = demChoKhac(goc, ban);
  const gocTheoId = new Map(goc.dong.map((d) => [d.id, d]));
  const oDaSua = (d: DongBaoCaoSon, cot: CotDongSon) => d.id.startsWith("them-") || ban.sua[d.id]?.[cot] !== undefined;
  const dauDaSua = (cot: CotDauSon) => ban.dau[cot] !== undefined;
  const coDongTon0 = dong.some((d) => !d.id.startsWith("them-") && (d.rob.trim() === "" || d.rob.trim() === "0"));
  const coGoiY = dong.some((d) => gocTheoId.get(d.id)?.goiY && !d.yeuCau.trim());
  const soDongTrong = Math.max(3, 14 - dong.length);
  const trang = dau.trang.trim() || `1 of ${soTrang}`;

  const suaDau = (cot: CotDauSon) => (v: string) => luu(suaDauBanIn(goc, ban, cot, v));
  const suaO = (id: string, cot: CotDongSon) => (v: string) => luu(suaOBanIn(goc, ban, id, cot, v));
  const themDong = () => {
    const id = `them-${Date.now().toString(36)}`;
    luu({
      ...ban,
      them: [...ban.them, { id, moTa: "", impa: "", donVi: "", rob: "", yeuCau: "", duyet: "" }],
      thuTu: ban.thuTu ? [...ban.thuTu, id] : null,
    });
  };
  const boDongTon0 = () => {
    let moi = ban;
    for (const d of dong) if (!d.id.startsWith("them-") && (d.rob.trim() === "" || d.rob.trim() === "0")) moi = boDongBanIn(moi, d.id);
    luu(moi);
  };
  const dienTheoDinhMuc = () => {
    let moi = ban;
    for (const d of dong) {
      const g = gocTheoId.get(d.id);
      if (g?.goiY && !d.yeuCau.trim()) moi = suaOBanIn(goc, moi, d.id, "yeuCau", g.goiY);
    }
    luu(moi);
  };
  const datLai = () => {
    if (!window.confirm(t("paint.bcXacNhanDatLai"))) return;
    try {
      window.localStorage.removeItem(khoaLuu);
    } catch {
      /* bỏ qua */
    }
    setBan(banSuaRong());
    setSua(false);
  };
  const inBaoCao = () => {
    flushSync(() => setSua(false));
    window.print();
  };

  const th = (style: React.CSSProperties = {}): React.CSSProperties => ({ borderLeft: VIEN, borderRight: VIEN, textAlign: "center", padding: "0 1px", ...style });
  const td = (style: React.CSSProperties = {}): React.CSSProperties => ({ borderLeft: VIEN, borderRight: VIEN, borderBottom: VIEN_CHAM, fontSize: pt(13), ...style });

  return (
    <div className="space-y-3">
      <style>{CSS_TO_IN}</style>
      <div className="no-print flex flex-wrap items-center gap-2">
        {sua ? (
          <>
            <Button type="button" variant="primary" size="sm" onClick={() => setSua(false)} icon={<Check className="size-4" />}>
              {t("paint.bcXong")}
            </Button>
            <Button type="button" size="sm" onClick={themDong} icon={<Plus className="size-4" />}>
              {t("paint.bcThemDong")}
            </Button>
            <Button type="button" size="sm" onClick={boDongTon0} disabled={!coDongTon0} icon={<ListX className="size-4" />}>
              {t("paint.bcBoDongTon0")}
            </Button>
            <Button type="button" size="sm" onClick={dienTheoDinhMuc} disabled={!coGoiY} icon={<Wand2 className="size-4" />}>
              {t("paint.bcDienTheoDinhMuc")}
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" onClick={() => setSua(true)} icon={<Pencil className="size-4" />}>
            {t("paint.bcSuaTruocKhiIn")}
          </Button>
        )}
        {soChoKhac > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={datLai} icon={<RotateCcw className="size-4" />}>
            {t("paint.bcDatLai")}
          </Button>
        )}
        <Button type="button" variant="primary" size="sm" onClick={inBaoCao} icon={<Printer className="size-4" />} className="ml-auto">
          {t("paint.bcNutIn")}
        </Button>
      </div>
      <p className="no-print text-xs text-[var(--text-muted)]">
        {sua ? t("paint.bcGoiYDangSua") : t("paint.bcGoiY")}{" "}
        {coSuaTon && (
          <Link href={`/paint/${vesselId}#ton-son`} className="text-[var(--text-brand)] hover:underline">
            {t("paint.bcGoiYSuaThat")}
          </Link>
        )}
      </p>
      {daNap && soChoKhac > 0 && (
        <Notice tone="warning" className="no-print">
          {t("paint.bcDaSuaTay", { n: soChoKhac })}
        </Notice>
      )}
      {dongGoc.length === 0 && (
        <Notice tone="info" className="no-print">
          {t("paint.bcChuaCoSon")}
        </Notice>
      )}

      <div className="overflow-x-auto pb-6 print:overflow-visible print:pb-0">
        <div className={cn("print-area to-son-a4", sua && "dang-sua")}>
          <div ref={noiDung}>
            {/* ── Đầu biểu mẫu (dòng 1–10 của tệp mẫu) ── */}
            <table className="bm">
              <colgroup>
                {COT.map((w, i) => (
                  <col key={i} style={{ width: `${w}%` }} />
                ))}
              </colgroup>
              <tbody>
                <tr style={{ height: pt(21) }}>
                  <td colSpan={3} rowSpan={5} style={{ borderTop: VIEN, borderLeft: VIEN, borderRight: VIEN, borderBottom: VIEN_DOI, textAlign: "center", verticalAlign: "top", padding: "0 4px" }}>
                    {/* Như tệp mẫu: logo neo phía trên ô (phần thấy được ~132×23 px), tên công ty
                        chữ đậm nghiêng cỡ 11 nằm ở đáy ô gộp A1:C5. */}
                    <div className="logo-bieu-mau" style={{ height: pt(87), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", paddingTop: pt(11), paddingBottom: pt(2) }}>
                      <LogoLockup height={26} className="h-[26px] w-auto" />
                      <p style={{ fontSize: pt(11), fontWeight: 700, fontStyle: "italic", lineHeight: 1.15 }}>MERCURY LINES COMPANY LIMITED</p>
                    </div>
                  </td>
                  <td colSpan={4} style={{ borderTop: VIEN, borderRight: VIEN, fontSize: pt(16), fontWeight: 700, textAlign: "center" }}>
                    REQUISITION FOR STORES
                  </td>
                  <td colSpan={2} style={{ borderTop: VIEN, borderRight: VIEN_DOI, fontSize: pt(10), fontStyle: "italic", textAlign: "right" }}>
                    MLS-11-05
                  </td>
                </tr>
                <tr style={{ height: pt(18.75) }}>
                  <td colSpan={4} style={{ borderRight: VIEN, fontSize: pt(14), fontWeight: 700, textAlign: "center" }}>
                    YÊU CẦU VẬT TƯ
                  </td>
                  <td colSpan={2} style={{ borderRight: VIEN_DOI, fontSize: pt(10), fontStyle: "italic", textAlign: "right" }}>
                    Issued date: 10/01/2024
                  </td>
                </tr>
                <tr style={{ height: pt(16.5) }}>
                  <td colSpan={4} rowSpan={3} style={{ borderRight: VIEN, borderBottom: VIEN_DOI, fontSize: pt(13), fontStyle: "italic", textAlign: "center", verticalAlign: "bottom", paddingBottom: 3 }}>
                    Phù hợp: Bộ luật ISM 5.2,6.1.3,10.1
                  </td>
                  <td colSpan={2} style={{ borderRight: VIEN_DOI, fontSize: pt(10), fontStyle: "italic", textAlign: "right" }}>
                    Revision: 0
                  </td>
                </tr>
                <tr style={{ height: pt(16.5) }}>
                  <td colSpan={2} style={{ borderRight: VIEN_DOI, fontSize: pt(10), fontStyle: "italic", textAlign: "center" }}>
                    Revised date:
                  </td>
                </tr>
                <tr style={{ height: pt(17.25) }}>
                  <td colSpan={2} className={cn(sua && dauDaSua("trang") && "o-da-sua")} style={{ borderRight: VIEN_DOI, borderBottom: VIEN_DOI, fontSize: pt(10), fontStyle: "italic", textAlign: "center" }}>
                    {sua ? (
                      <span className="flex items-baseline justify-center gap-1">
                        Page:
                        <span className="w-16">
                          <O sua giaTri={dau.trang} onDoi={suaDau("trang")} nhan="Page" goiY={`1 of ${soTrang}`} />
                        </span>
                      </span>
                    ) : (
                      `Page: ${trang}`
                    )}
                  </td>
                </tr>
                <tr style={{ height: pt(10.5) }}>
                  <td colSpan={9} style={{ padding: 0 }} />
                </tr>
                <tr style={{ height: pt(16.5) }}>
                  <td colSpan={2} style={{ border: VIEN, fontSize: pt(11), fontWeight: 700, textAlign: "center" }}>
                    Vsl./Tàu:
                  </td>
                  <td colSpan={4} className={cn(sua && dauDaSua("tenTau") && "o-da-sua")} style={{ border: VIEN, fontSize: pt(13), fontWeight: 700, textAlign: "center" }}>
                    <O sua={sua} giaTri={dau.tenTau} onDoi={suaDau("tenTau")} nhan="Vsl./Tàu" />
                  </td>
                  {/* Cột G hẹp hơn chữ "Date/Ngày:" cỡ 11 (Excel cắt mất đuôi chữ): giữ một dòng, cỡ 9,5 cho vừa ô. */}
                  <td style={{ border: VIEN, fontSize: pt(9.5), whiteSpace: "nowrap", padding: "0 2px" }}>Date/Ngày:</td>
                  <td colSpan={2} className={cn(sua && dauDaSua("ngay") && "o-da-sua")} style={{ border: VIEN, fontSize: pt(11), textAlign: "center" }}>
                    <O sua={sua} giaTri={dau.ngay} onDoi={suaDau("ngay")} nhan="Date/Ngày" />
                  </td>
                </tr>
                <tr style={{ height: pt(36) }}>
                  <td colSpan={2} style={{ border: VIEN, fontSize: pt(11), fontWeight: 700 }}>
                    Dept./
                    <br />
                    Bộ phận:
                  </td>
                  <td colSpan={4} className={cn(sua && dauDaSua("boPhan") && "o-da-sua")} style={{ border: VIEN, fontSize: pt(13), fontWeight: 700, textAlign: "center" }}>
                    <O sua={sua} giaTri={dau.boPhan} onDoi={suaDau("boPhan")} nhan="Dept./Bộ phận" />
                  </td>
                  <td style={{ border: VIEN, fontSize: pt(11) }}>
                    <span style={{ fontWeight: 700 }}>Req. No.</span>
                    <br />
                    <span style={{ fontStyle: "italic" }}>Số y/cầu:</span>
                  </td>
                  <td colSpan={2} className={cn(sua && dauDaSua("soYeuCau") && "o-da-sua")} style={{ border: VIEN, fontSize: pt(11), fontWeight: 700, textAlign: "center" }}>
                    <O sua={sua} giaTri={dau.soYeuCau} onDoi={suaDau("soYeuCau")} nhan="Req. No." />
                  </td>
                </tr>
                <tr style={{ height: pt(12.75) }}>
                  <td colSpan={9} style={{ padding: 0 }} />
                </tr>
              </tbody>
            </table>

            {/* ── Bảng (dòng 11 trở đi) — đầu bảng lặp lại nếu sang trang ── */}
            <table className="bm">
              <colgroup>
                {COT.map((w, i) => (
                  <col key={i} style={{ width: `${w}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr style={{ height: pt(33.75), fontSize: pt(13) }}>
                  <th style={th({ borderTop: VIEN_DOI, borderLeft: VIEN_DOI, fontWeight: 700 })}>S. No.</th>
                  <th colSpan={3} style={th({ borderTop: VIEN_DOI, fontWeight: 700 })}>
                    Description
                  </th>
                  <th style={th({ borderTop: VIEN_DOI, fontWeight: 700 })}>IMPA Code</th>
                  <th style={th({ borderTop: VIEN_DOI, fontWeight: 700 })}>Unit</th>
                  <th style={th({ borderTop: VIEN_DOI, fontWeight: 700 })}>R.O.B</th>
                  <th style={th({ borderTop: VIEN_DOI, fontWeight: 700 })}>Q&apos;ty. Req.</th>
                  <th style={th({ borderTop: VIEN_DOI, borderRight: VIEN_DOI, fontWeight: 700 })}>Q&apos;ty. App.</th>
                </tr>
                <tr style={{ height: pt(63), fontSize: pt(12), fontStyle: "italic" }}>
                  <th style={th({ borderLeft: VIEN_DOI, borderBottom: VIEN })}>Stt.</th>
                  <th colSpan={3} style={th({ borderBottom: VIEN })}>
                    Mô tả
                  </th>
                  <th style={th({ borderBottom: VIEN })}>Mã IMPA</th>
                  <th style={th({ borderBottom: VIEN })}>Đơn vị</th>
                  <th style={th({ borderBottom: VIEN })}>Còn tồn trên tàu</th>
                  <th style={th({ borderBottom: VIEN })}>S.lượng yêu cầu</th>
                  <th style={th({ borderRight: VIEN_DOI, borderBottom: VIEN })}>S.lượng duyệt</th>
                </tr>
              </thead>
              <tbody>
                {dong.map((d, i) => (
                  <tr key={d.id} style={{ height: pt(16.5) }}>
                    <td style={td({ textAlign: "center" })}>{i + 1}</td>
                    <td colSpan={3} className={cn(sua && oDaSua(d, "moTa") && "o-da-sua")} style={td({ fontSize: pt(12), textAlign: "left" })}>
                      <O sua={sua} giaTri={d.moTa} onDoi={suaO(d.id, "moTa")} canh="left" nhan={`${i + 1} · Description`} />
                    </td>
                    <td className={cn(sua && oDaSua(d, "impa") && "o-da-sua")} style={td({ textAlign: "center" })}>
                      <O sua={sua} giaTri={d.impa} onDoi={suaO(d.id, "impa")} nhan={`${i + 1} · IMPA Code`} />
                    </td>
                    <td className={cn(sua && oDaSua(d, "donVi") && "o-da-sua")} style={td({ fontSize: pt(12), textAlign: "center" })}>
                      <O sua={sua} giaTri={d.donVi} onDoi={suaO(d.id, "donVi")} nhan={`${i + 1} · Unit`} />
                    </td>
                    <td className={cn(sua && oDaSua(d, "rob") && "o-da-sua")} style={td({ textAlign: "right" })}>
                      <O sua={sua} giaTri={d.rob} onDoi={suaO(d.id, "rob")} canh="right" nhan={`${i + 1} · R.O.B`} />
                    </td>
                    <td className={cn(sua && oDaSua(d, "yeuCau") && "o-da-sua")} style={td({ textAlign: "right" })}>
                      <O sua={sua} giaTri={d.yeuCau} onDoi={suaO(d.id, "yeuCau")} canh="right" nhan={`${i + 1} · Q'ty. Req.`} goiY={gocTheoId.get(d.id)?.goiY || undefined} />
                    </td>
                    <td className={cn(sua && oDaSua(d, "duyet") && "o-da-sua")} style={td({ textAlign: "right", position: "relative" })}>
                      <O sua={sua} giaTri={d.duyet} onDoi={suaO(d.id, "duyet")} canh="right" nhan={`${i + 1} · Q'ty. App.`} />
                      {sua && (
                        <span className="no-print absolute top-1/2 left-full ml-2 flex -translate-y-1/2 gap-0.5 font-sans">
                          <button type="button" onClick={() => luu(doiChoDongBanIn(goc, ban, d.id, -1))} disabled={i === 0} title={t("paint.bcLenDong")} aria-label={t("paint.bcLenDong")} className="rounded p-0.5 text-slate-500 hover:bg-slate-500/10 hover:text-slate-800 disabled:opacity-30">
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button type="button" onClick={() => luu(doiChoDongBanIn(goc, ban, d.id, 1))} disabled={i === dong.length - 1} title={t("paint.bcXuongDong")} aria-label={t("paint.bcXuongDong")} className="rounded p-0.5 text-slate-500 hover:bg-slate-500/10 hover:text-slate-800 disabled:opacity-30">
                            <ArrowDown className="size-3.5" />
                          </button>
                          <button type="button" onClick={() => luu(boDongBanIn(ban, d.id))} title={t("paint.bcBoDong")} aria-label={t("paint.bcBoDong")} className="rounded p-0.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-600">
                            <Trash2 className="size-3.5" />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {Array.from({ length: soDongTrong }, (_, i) => (
                  <tr key={`trong-${i}`} style={{ height: pt(16.5) }}>
                    <td style={td()} />
                    <td colSpan={3} style={td()} />
                    <td style={td()} />
                    <td style={td()} />
                    <td style={td()} />
                    <td style={td()} />
                    <td style={td()} />
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Ô ký (dòng 28–29 của tệp mẫu) ── */}
            <table className="bm" style={{ marginTop: pt(16.5) }}>
              <colgroup>
                {COT.map((w, i) => (
                  <col key={i} style={{ width: `${w}%` }} />
                ))}
              </colgroup>
              <tbody>
                <tr style={{ height: pt(16.5), fontSize: pt(13), fontWeight: 700, textAlign: "center" }}>
                  <td colSpan={3} style={{ fontWeight: 700 }}>Chief Engineer/ Chief Officer</td>
                  <td style={{ fontWeight: 700 }}>Captain</td>
                  <td colSpan={3} style={{ fontWeight: 700 }}>Tech.&amp;Pur Dept</td>
                  <td colSpan={2} style={{ fontWeight: 700 }}>Vice Director</td>
                </tr>
                <tr style={{ height: pt(16.5), fontSize: pt(13), fontStyle: "italic", textAlign: "center" }}>
                  <td colSpan={3}>Máy Trưởng/ Đại Phó</td>
                  <td>Thuyền Trưởng</td>
                  <td colSpan={3}>Phòng Kỹ Thuật Vật Tư</td>
                  <td colSpan={2}>Phó Giám Đốc</td>
                </tr>
                <tr style={{ height: "26mm" }}>
                  <td colSpan={9} />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Chân trang của mẫu (ở tệp Excel là chân trang in, chữ nghiêng cỡ 9). */}
          <div style={{ marginTop: "auto", paddingTop: "6mm", display: "flex", justifyContent: "space-between", gap: "8mm", fontSize: pt(9), fontStyle: "italic", lineHeight: 1.3 }}>
            <div>
              <p>Người làm báo cáo: CE, CO</p>
              <p>Thời điểm làm báo cáo: Khi cần thiết</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p>Thời gian lưu: 3 năm</p>
              <p>Lưu VP: Vật tư</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
