"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { useNgonNgu } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";
import { Button, Notice } from "@/components/ui";
import {
  apDungBanSua,
  banSuaRong,
  boDongBanIn,
  chiaTrangBaoCao,
  demChoKhac,
  docBanSua,
  doiChoDongBanIn,
  dongTrongBaoCao,
  gonBanSua,
  lechCanDoi,
  suaDauBanIn,
  suaOBanIn,
  type BanSuaBaoCaoSon,
  type CotDauSon,
  type CotDongSon,
  type DauBaoCaoSon,
  type DongBaoCaoSon,
} from "@/lib/tonSon";

/*
 * BÁO CÁO LƯỢNG SƠN TỒN in đúng mẫu MLS-11-14 "BÁO CÁO LƯỢNG SƠN TỒN / PAINT
 * INVENTORY" của công ty — dựng lại từ chính tệp Word mẫu (BC LUONG SON TON):
 *   - kích thước lấy từ XML của tệp (lưới cột, chiều cao hàng, lề ô, khung) và
 *     đối chiếu với bản Word tự dựng ra (vị trí từng đường kẻ, từng dòng chữ);
 *   - Times New Roman nghiêng như kiểu Normal của tệp, ô "Tên tàu / Quý / Năm"
 *     Arial nghiêng (kiểu Heading 5), logo cắt đúng khung ảnh của tệp;
 *   - đầu trang (logo, tên biểu mẫu, MLS-11-14, Page) và chân trang (Người làm
 *     báo cáo: CE, CO…) lặp lại ở mọi trang như đầu/chân trang của Word.
 * Tệp gốc khổ Letter; tờ in dùng giấy A4 của văn phòng, giữ nguyên mọi kích
 * thước, căn giữa theo chiều ngang, chân trang cách mép dưới như tệp gốc.
 * Bảng dài thì tự sang trang (đo chiều cao từng dòng): trang sau lặp hàng tiêu
 * đề bảng; khối ký luôn đi cùng ít nhất dòng cuối.
 *
 * "Sửa trước khi in": đổi ô, bỏ / thêm / đổi thứ tự dòng — chỉ đổi tờ in
 * (lib/tonSon.ts: bản sửa cất trong localStorage theo tàu + quý, áp lên số liệu
 * mới nhất), không đổi tồn sơn của tàu.
 */

// ── Kích thước (inch) theo tệp Word: twip / 1440 ──
/** Giấy A4 rộng 8,27" — tệp Letter 8,5": dời mọi thứ sang trái để căn giữa như tệp. */
const DX = (8.2677 - 8.5) / 2;
const x = (inchTrenLetter: number) => `${(inchTrenLetter + DX).toFixed(4)}in`;
const LE_TRAI = 0.375; // lề trái 540 twip
const DAU_TRANG = { top: 0.4417, left: 0.44755, cot: [1.5528, 4.0625, 1.8646], cao: 0.943 };
const COT_THONG_TIN = [1725, 222, 2418, 1604, 222, 1339, 1364, 1816].map((tw) => tw / 1440);
const COT_BANG = [813, 3687, 900, 1350, 1292, 1276, 1417].map((tw) => tw / 1440);
const COT_CHAN = [8460, 2250].map((tw) => tw / 1440);
/** Bảng thụt 288 twip, chế độ Word 2003 tính tới chữ nên khung lùi một lề ô (108 twip). */
const THUT_BANG = (288 - 108) / 1440;
const THAN_TREN = 1.625; // lề trên 2340 twip
/** Khung chân trang: cách mép dưới 0,5" + đoạn trống sau bảng (12 pt) + cao bảng (2 dòng 9 pt). */
const CHAN_CAO = 0.2931;
const CHAN_TREN = 11.6929 - 0.5 - 0.1917 - CHAN_CAO;
const CAO_THAN_IN = CHAN_TREN - THAN_TREN;
/** Chiều cao "ít nhất" của hàng theo tệp (640 / 1205 twip): Word không tính nét kẻ vào, bảng CSS gộp khung thì có — cộng 0,5 pt cho bằng bước dòng của Word. */
const CAO_HANG = `calc(${640 / 1440}in + 0.5pt)`;
const CAO_TIEU_DE = `calc(${1205 / 1440}in + 0.5pt)`;
const DONG_TOI_THIEU = 7; // tờ mẫu có 7 dòng trống
const PX_INCH = 96;
/** Chiều cao (px) theo tệp mẫu — dùng khi trình duyệt chưa dựng bố cục (thẻ đang ẩn) nên đo ra 0. */
const CAO_CHUAN = { thongTin: 0.774 * PX_INCH, tieuDe: 0.842 * PX_INCH, dong: 0.4514 * PX_INCH, ky: ((3 * 13.8) / 72) * PX_INCH };

const VIEN = "0.5pt solid #000";
const VIEN_DAY = "1pt solid #000";
const VIEN_TT = "0.75pt solid #000";
const VIEN_DOI = "1.6pt double #000";

const CSS_TO_IN = `
@page { size: A4 portrait; margin: 0; }
.ds-trang-son { display: flex; flex-direction: column; align-items: center; gap: 6mm; padding: 0 0 6mm; }
.trang-son { position: relative; flex: none; width: 210mm; height: 297mm; overflow: hidden; background: #fff; color: #000;
  font-family: "Times New Roman", Times, "Liberation Serif", serif; font-style: italic; font-size: 12pt; line-height: 1.15;
  box-shadow: 0 1px 3px rgba(15, 23, 42, .18), 0 10px 30px rgba(15, 23, 42, .14); }
.trang-son.dang-sua { overflow: visible; margin-right: 30mm; }
.trang-son table { border-collapse: collapse; table-layout: fixed; }
.trang-son td { padding: 0 0.075in; vertical-align: middle; text-align: left; font-weight: 400; overflow-wrap: anywhere; }
.trang-son p { margin: 0; }
.trang-son .arial { font-family: Arial, "Liberation Sans", Helvetica, sans-serif; }
.trang-son textarea.o-sua { field-sizing: content; resize: none; overflow: hidden; }
.do-son { position: absolute; left: -10000px; top: 0; visibility: hidden; pointer-events: none; }
@media print {
  .ds-trang-son { display: block; padding: 0; }
  .trang-son, .trang-son.dang-sua { height: 296mm; margin: 0; box-shadow: none; overflow: hidden; break-after: page; }
  .trang-son:last-child { break-after: auto; }
}
`;

/** Một ô sửa được: chữ thường khi xem, ô nhập trong suốt khi sửa (in ra vẫn như chữ). */
function O({
  sua,
  giaTri,
  onDoi,
  nhan,
  nhieuDong,
}: {
  sua: boolean;
  giaTri: string;
  onDoi: (v: string) => void;
  nhan: string;
  nhieuDong?: boolean;
}) {
  if (!sua) return <>{giaTri}</>;
  const lop = "o-sua block w-full min-w-0 border-0 bg-transparent p-0 focus:outline-none focus:ring-1 focus:ring-brand-500";
  return nhieuDong ? (
    <textarea rows={1} value={giaTri} onChange={(e) => onDoi(e.target.value)} aria-label={nhan} className={lop} />
  ) : (
    <input value={giaTri} onChange={(e) => onDoi(e.target.value)} aria-label={nhan} className={lop} />
  );
}

/** Đầu trang của mẫu (lặp lại mọi trang). */
function DauTrang({ trang }: { trang: string }) {
  // Lề ô 71 twip hai bên, lề trên 72 twip của bảng: hai ô chữ ghi đè lề trên = 0 nhưng Word (chế độ
  // 2003) vẫn chừa nó khi canh giữa theo chiều dọc — đo trên bản Word dựng ra, chữ thấp hơn đúng nửa lề đó.
  const o = { borderTop: VIEN_DAY, padding: "0.05in 0.0493in 0" } as const;
  return (
    <table style={{ position: "absolute", top: `${DAU_TRANG.top}in`, left: x(DAU_TRANG.left), width: `${DAU_TRANG.cot.reduce((a, b) => a + b, 0)}in` }}>
      <colgroup>
        {DAU_TRANG.cot.map((w, i) => (
          <col key={i} style={{ width: `${w}in` }} />
        ))}
      </colgroup>
      <tbody>
        <tr style={{ height: `${DAU_TRANG.cao}in` }}>
          <td style={{ ...o, borderLeft: VIEN_DAY, borderBottom: VIEN_DAY, verticalAlign: "top", textAlign: "center" }}>
            {/* Logo = CHÍNH ảnh trong tệp mẫu (trùng từng byte với public/bieu-mau), khung 105,6 × 33 pt và
                phần cắt mép (crop) đúng như tệp: ảnh hiện ra đúng như Word vẽ. */}
            <div style={{ position: "relative", width: "105.6pt", height: "33pt", margin: "6pt 0 2pt", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- tờ in: ảnh gốc của biểu mẫu, không tối ưu / tải chậm */}
              <img
                src="/bieu-mau/logo-mercury-lines.png"
                alt="Mercury Lines"
                style={{ position: "absolute", maxWidth: "none", width: "123.385pt", height: "56.956pt", left: "-7.623pt", top: "-12.374pt" }}
              />
            </div>
            <p style={{ margin: "6pt 0 2pt", fontSize: "7pt", textTransform: "uppercase" }}>
              Mercury Lines
              <br />
              Company Limited
            </p>
          </td>
          <td style={{ ...o, borderLeft: VIEN, borderBottom: VIEN_DAY, textAlign: "center", fontSize: "16pt" }}>
            <p style={{ margin: "6pt 0 3pt" }}>BÁO CÁO LƯỢNG SƠN TỒN</p>
            <p style={{ margin: "6pt 0 3pt" }}>PAINT INVENTORY</p>
          </td>
          <td style={{ ...o, borderLeft: VIEN, borderBottom: VIEN, borderRight: VIEN_DAY, textAlign: "right", fontSize: "10pt" }}>
            <p>MLS-11-14</p>
            <p>
              Issued date: <span style={{ fontStyle: "normal" }}>10/01/2024</span>
            </p>
            <p>Revision:0</p>
            <p>Revised date:</p>
            <p>Page: {trang}</p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Chân trang của mẫu (lặp lại mọi trang). */
function ChanTrang() {
  const o = { border: VIEN, fontSize: "9pt", verticalAlign: "top" } as const;
  return (
    <table style={{ position: "absolute", top: `${CHAN_TREN}in`, left: x(LE_TRAI + THUT_BANG), width: `${COT_CHAN[0] + COT_CHAN[1]}in` }}>
      <colgroup>
        {COT_CHAN.map((w, i) => (
          <col key={i} style={{ width: `${w}in` }} />
        ))}
      </colgroup>
      <tbody>
        <tr>
          <td style={o}>
            <p>Người làm báo cáo: CE, CO</p>
            <p>Thời điểm làm báo cáo: Hàng quý</p>
          </td>
          <td style={o}>
            <p>Thời gian lưu: 3 năm</p>
            <p>Lưu VP: K/thuật, v/tư</p>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const ColBang = () => (
  <colgroup>
    {COT_BANG.map((w, i) => (
      <col key={i} style={{ width: `${w}in` }} />
    ))}
  </colgroup>
);

const oBang = { border: VIEN } as const;

/** Hàng tiêu đề bảng — chữ như tệp mẫu (kể cả "Recive" và dấu cách trước "Paint name"). */
function HangTieuDe({ lop }: { lop?: string }) {
  const cot: [string, string][] = [
    ["Stt", "No."],
    ["Tên sơn", " Paint name"],
    ["Đơn vị", "Unit"],
    ["Tồn đầu kỳ", "In stock"],
    ["Nhận", "Recive"],
    ["Tiêu thụ trong kỳ", "Consume"],
    ["Tồn cuối kỳ", "Remain"],
  ];
  return (
    <tr className={lop} style={{ height: CAO_TIEU_DE }}>
      {cot.map(([vi, en]) => (
        <td key={vi} style={oBang}>
          <p>{vi}</p>
          <p>{en}</p>
        </td>
      ))}
    </tr>
  );
}

/** Khối ký sau bảng: Thuyền Trưởng / Captain bên trái, Đại Phó / Chief Officer bên phải (vị trí như tab của tệp). */
function KhoiKy() {
  const dong = { position: "relative", height: "13.8pt" } as const;
  const chu = (trai: number) => ({ position: "absolute", left: `${trai}in`, top: 0, whiteSpace: "nowrap" }) as const;
  return (
    <div>
      <div style={dong} />
      <div style={dong}>
        <span style={chu(1)}>Thuyền Trưởng</span>
        <span style={chu(5.5)}>Đại Phó</span>
      </div>
      <div style={dong}>
        <span style={chu(1.1667)}>Captain</span>
        <span style={chu(5.325)}>Chief Officer</span>
      </div>
    </div>
  );
}

export default function BaoCaoSonSua({
  khoaLuu,
  dauGoc,
  dongGoc,
  vesselId,
  coSuaTon,
}: {
  /** Khóa localStorage — theo tàu + quý. */
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
  const [trang, setTrang] = useState<number[][] | null>(null);
  const vungDo = useRef<HTMLDivElement>(null);

  // Nạp bản sửa lần trước (nếu có); bắt đầu trong setTimeout để không setState
  // ngay trong thân effect. Phần trỏ tới loại sơn không còn trong quý thì bỏ.
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

  // Chia trang theo chiều cao THẬT của từng dòng (tên dài xuống dòng thì dòng cao hơn): đo ở
  // một bản dựng ẩn đúng khổ, rồi xếp dòng vào trang. Kích thước tính bằng inch nên đo trên
  // màn hình cũng là kích thước khi in.
  const doChiaTrang = useCallback((): number[][] | null => {
    const el = vungDo.current;
    if (!el) return null;
    const cao = (sel: string, chuan: number) => el.querySelector(sel)?.getBoundingClientRect().height || chuan;
    const caoDong = [...el.querySelectorAll("tbody.do-dong > tr")].map((tr) => tr.getBoundingClientRect().height || CAO_CHUAN.dong);
    const than = CAO_THAN_IN * PX_INCH;
    const tieuDe = cao("tr.do-tieu-de", CAO_CHUAN.tieuDe);
    return chiaTrangBaoCao(caoDong, { trangDau: than - cao(".do-thong-tin", CAO_CHUAN.thongTin) - tieuDe, trangSau: than - tieuDe, ky: cao(".do-ky", CAO_CHUAN.ky) });
  }, []);
  const datTrang = useCallback((moi: number[][] | null) => {
    if (moi) setTrang((cu) => (cu && JSON.stringify(cu) === JSON.stringify(moi) ? cu : moi));
  }, []);

  // In (kể cả Ctrl+P lúc đang sửa): thoát chế độ sửa và chia trang lại ngay trước khi in;
  // thẻ trình duyệt mở ở nền rồi mới xem thì đo lại khi hiện ra.
  useEffect(() => {
    const truocKhiIn = () =>
      flushSync(() => {
        setSua(false);
        datTrang(doChiaTrang());
      });
    const khiHien = () => {
      if (!document.hidden) datTrang(doChiaTrang());
    };
    window.addEventListener("beforeprint", truocKhiIn);
    document.addEventListener("visibilitychange", khiHien);
    return () => {
      window.removeEventListener("beforeprint", truocKhiIn);
      document.removeEventListener("visibilitychange", khiHien);
    };
  }, [doChiaTrang, datTrang]);

  const luu = (moi: BanSuaBaoCaoSon) => {
    setBan(moi);
    try {
      window.localStorage.setItem(khoaLuu, JSON.stringify(moi));
    } catch {
      /* không lưu được thì vẫn sửa được trong phiên này */
    }
  };

  const { dau, dong } = apDungBanSua(goc, ban);
  // Tờ mẫu có 7 dòng; ít loại sơn hơn thì chừa dòng trống để ghi tay.
  const dongIn: (DongBaoCaoSon | null)[] = [...dong, ...Array.from({ length: Math.max(0, DONG_TOI_THIEU - dong.length) }, () => null)];
  const khoaDo = JSON.stringify([dau, dong]);

  // Đo sau khi bản dựng ẩn đã có mặt (microtask, trước khi trình duyệt vẽ); phông có thể nạp
  // xong sau lần dựng đầu → đo lại. Các trang ẩn cho tới lần chia đầu tiên.
  useLayoutEffect(() => {
    let huy = false;
    const chia = () => {
      if (!huy) datTrang(doChiaTrang());
    };
    queueMicrotask(chia);
    void document.fonts?.ready.then(chia);
    return () => {
      huy = true;
    };
  }, [khoaDo, doChiaTrang, datTrang]);

  const soChoKhac = demChoKhac(goc, ban);
  const oDaSua = (d: DongBaoCaoSon, cot: CotDongSon) => d.id.startsWith("them-") || ban.sua[d.id]?.[cot] !== undefined;
  const dauDaSua = (cot: CotDauSon) => ban.dau[cot] !== undefined;
  const dongLech = dong.flatMap((d, i) => (lechCanDoi(d) ? [i + 1] : []));

  const suaDau = (cot: CotDauSon) => (v: string) => luu(suaDauBanIn(goc, ban, cot, v));
  const suaO = (id: string, cot: CotDongSon) => (v: string) => luu(suaOBanIn(goc, ban, id, cot, v));
  const themDong = () => {
    const id = `them-${Date.now().toString(36)}`;
    luu({ ...ban, them: [...ban.them, dongTrongBaoCao(id)], thuTu: ban.thuTu ? [...ban.thuTu, id] : null });
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

  /** Bảng thông tin tàu / quý / năm (trang đầu). */
  const bangThongTin = (choSua: boolean) => {
    const o = (them: React.CSSProperties = {}) => ({ borderTop: VIEN_TT, borderBottom: VIEN_DOI, verticalAlign: "top", ...them }) as React.CSSProperties;
    const p = { margin: "6pt 0", textAlign: "justify" } as const;
    const oSua = (cot: CotDauSon, nhan: string) => (
      <p style={p}>
        <O sua={choSua} giaTri={dau[cot]} onDoi={suaDau(cot)} nhan={nhan} />
      </p>
    );
    return (
      <table className="arial" style={{ marginLeft: `${THUT_BANG}in`, width: `${COT_THONG_TIN.reduce((a, b) => a + b, 0)}in` }}>
        <colgroup>
          {COT_THONG_TIN.map((w, i) => (
            <col key={i} style={{ width: `${w}in` }} />
          ))}
        </colgroup>
        <tbody>
          <tr style={{ height: `${525 / 1440}in` }}>
            <td style={o({ borderLeft: VIEN_TT })}>
              <p style={{ ...p, textAlign: "left" }}>Tên tàu Vessel:</p>
            </td>
            <td style={o()} />
            <td className={cn(choSua && dauDaSua("tenTau") && "o-da-sua")} style={o({ borderLeft: VIEN_TT, borderRight: VIEN_TT })}>
              {oSua("tenTau", "Tên tàu / Vessel")}
            </td>
            {/* Word đặt vừa một dòng; trình duyệt đo chữ rộng hơn một chút — không cho ngắt ":" xuống dòng. */}
            <td style={o()}>
              <p style={{ ...p, whiteSpace: "nowrap" }}>Quý/Quarter:</p>
            </td>
            <td style={o()} />
            <td className={cn(choSua && dauDaSua("quy") && "o-da-sua")} style={o({ borderLeft: VIEN_TT, borderRight: VIEN_TT })}>
              {oSua("quy", "Quý / Quarter")}
            </td>
            <td style={o({ borderRight: VIEN_TT })}>
              <p style={{ ...p, whiteSpace: "nowrap" }}>Năm/Year:</p>
            </td>
            <td className={cn(choSua && dauDaSua("nam") && "o-da-sua")} style={o({ borderRight: VIEN_TT })}>
              {oSua("nam", "Năm / Year")}
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

  /** Một dòng bảng: dữ liệu (sửa được) hoặc dòng trống của mẫu. */
  const hangDong = (d: DongBaoCaoSon | null, stt: number, choSua: boolean, key: string) => {
    if (!d) {
      return (
        <tr key={key} style={{ height: CAO_HANG }}>
          {COT_BANG.map((_, i) => (
            <td key={i} style={oBang} />
          ))}
        </tr>
      );
    }
    const o = (cot: CotDongSon, nhan: string, nhieuDong = false) => (
      <td className={cn(choSua && oDaSua(d, cot) && "o-da-sua")} style={oBang}>
        <O sua={choSua} giaTri={d[cot]} onDoi={suaO(d.id, cot)} nhan={`${stt} · ${nhan}`} nhieuDong={nhieuDong} />
      </td>
    );
    const viTri = dong.findIndex((x) => x.id === d.id);
    return (
      <tr key={key} style={{ height: CAO_HANG }}>
        <td style={oBang}>{stt}</td>
        {o("moTa", "Tên sơn / Paint name", true)}
        {o("donVi", "Đơn vị / Unit")}
        {o("tonDau", "Tồn đầu kỳ / In stock")}
        {o("nhan", "Nhận / Recive")}
        {o("tieuThu", "Tiêu thụ trong kỳ / Consume")}
        <td className={cn(choSua && oDaSua(d, "tonCuoi") && "o-da-sua")} style={{ ...oBang, position: "relative" }}>
          <O sua={choSua} giaTri={d.tonCuoi} onDoi={suaO(d.id, "tonCuoi")} nhan={`${stt} · Tồn cuối kỳ / Remain`} />
          {choSua && (
            <span className="no-print absolute top-1/2 left-full ml-3 flex -translate-y-1/2 gap-0.5 font-sans not-italic">
              <button type="button" onClick={() => luu(doiChoDongBanIn(goc, ban, d.id, -1))} disabled={viTri <= 0} title={t("paint.bcLenDong")} aria-label={t("paint.bcLenDong")} className="rounded p-0.5 text-slate-500 hover:bg-slate-500/10 hover:text-slate-800 disabled:opacity-30">
                <ArrowUp className="size-3.5" />
              </button>
              <button type="button" onClick={() => luu(doiChoDongBanIn(goc, ban, d.id, 1))} disabled={viTri === dong.length - 1} title={t("paint.bcXuongDong")} aria-label={t("paint.bcXuongDong")} className="rounded p-0.5 text-slate-500 hover:bg-slate-500/10 hover:text-slate-800 disabled:opacity-30">
                <ArrowDown className="size-3.5" />
              </button>
              <button type="button" onClick={() => luu(boDongBanIn(ban, d.id))} title={t("paint.bcBoDong")} aria-label={t("paint.bcBoDong")} className="rounded p-0.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-600">
                <Trash2 className="size-3.5" />
              </button>
            </span>
          )}
        </td>
      </tr>
    );
  };

  const dsTrang = trang ?? [dongIn.map((_, i) => i)];
  const soTrang = dsTrang.length;

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
      {dongLech.length > 0 && (
        <Notice tone="warning" className="no-print">
          {t("paint.bcLechCanDoi", { ds: dongLech.join(", ") })}
        </Notice>
      )}
      {dongGoc.length === 0 && (
        <Notice tone="info" className="no-print">
          {t("paint.bcChuaCoSon")}
        </Notice>
      )}

      {/* Bản dựng ẩn để đo chiều cao (luôn ở chế độ xem, không in). */}
      <div ref={vungDo} className="do-son no-print" aria-hidden>
        <div className="trang-son">
          <div style={{ position: "absolute", top: `${THAN_TREN}in`, left: x(LE_TRAI) }}>
            <div className="do-thong-tin">
              {bangThongTin(false)}
              <div style={{ height: "13.8pt" }} />
            </div>
            <table style={{ marginLeft: `${THUT_BANG}in`, width: `${COT_BANG.reduce((a, b) => a + b, 0)}in` }}>
              <ColBang />
              <tbody>
                <HangTieuDe lop="do-tieu-de" />
              </tbody>
              <tbody className="do-dong">{dongIn.map((d, i) => hangDong(d, i + 1, false, d?.id ?? `trong-${i}`))}</tbody>
            </table>
            <div className="do-ky">
              <KhoiKy />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <div className="ds-trang-son" style={trang ? undefined : { visibility: "hidden" }}>
          {dsTrang.map((chiSo, p) => (
            <div key={p} className={cn("print-area trang-son", sua && "dang-sua")}>
              <DauTrang trang={`${p + 1}/${soTrang}`} />
              <div style={{ position: "absolute", top: `${THAN_TREN}in`, left: x(LE_TRAI), width: "7.625in" }}>
                {p === 0 && (
                  <>
                    {bangThongTin(sua)}
                    <div style={{ height: "13.8pt" }} />
                  </>
                )}
                {(chiSo.length > 0 || p === 0) && (
                  <table style={{ marginLeft: `${THUT_BANG}in`, width: `${COT_BANG.reduce((a, b) => a + b, 0)}in` }}>
                    <ColBang />
                    <tbody>
                      <HangTieuDe />
                      {chiSo.map((i) => hangDong(dongIn[i], i + 1, sua, dongIn[i]?.id ?? `trong-${i}`))}
                    </tbody>
                  </table>
                )}
                {p === soTrang - 1 && <KhoiKy />}
              </div>
              <ChanTrang />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
