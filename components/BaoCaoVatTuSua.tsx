"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, RotateCcw, Check, Trash2 } from "lucide-react";
import LogoBieuMau from "@/components/LogoBieuMau";
import { useNgonNgu } from "@/lib/i18n/client";
import { Button, Notice } from "@/components/ui";

/** Một dòng báo cáo — mọi ô là chuỗi để người dùng gõ tự do trước khi in. */
export type DongBaoCao1101 = {
  id: string;
  ten: string;
  kyHieu: string;
  donVi: string;
  tonTruoc: string;
  nhan: string;
  ngayNhan: string;
  dung: string;
  ngayDung: string;
  ton: string;
  ghiChu: string;
};

export type DauBaoCao1101 = {
  tenTau: string;
  ngay: string;
  boPhan: string;
  taiCang: string;
};

type BanLuu = { dau: DauBaoCao1101; dong: DongBaoCao1101[]; luc: string };

const O_SUA = "o-sua w-full min-w-0 border-0 bg-transparent p-0 text-inherit focus:outline-none focus:ring-1 focus:ring-brand-500";
const O_GIUA = `${O_SUA} text-center`;
const O_TRAI = `${O_SUA} text-left`;

/**
 * Một ô: ở chế độ sửa là <input>, không thì là chữ. Định nghĩa ở cấp module —
 * khai bên trong component là React tạo kiểu mới mỗi lần vẽ, ô nhập bị gắn lại
 * và mất con trỏ sau mỗi phím gõ.
 */
function Cell({
  sua,
  giaTri,
  onChange,
  className,
  chu,
}: {
  sua: boolean;
  giaTri: string;
  onChange: (v: string) => void;
  className?: string;
  chu?: React.ReactNode;
}) {
  if (!sua) return <>{chu ?? giaTri}</>;
  return <input value={giaTri} onChange={(e) => onChange(e.target.value)} className={className ?? O_GIUA} />;
}

/**
 * Bản in MLS-11-01 sửa được trước khi in.
 *
 * Số liệu do server tổng hợp từ giao dịch kho là ĐIỂM XUẤT PHÁT; người làm báo
 * cáo hay phải chỉnh tay vài chỗ trước khi ký (ghi chú, ngày, dòng hàng nhận
 * ngoài sổ, số lệch đã kiểm thực tế). Chỉnh ở đây KHÔNG đổi số liệu trên hệ
 * thống — nó là bản để in, cất trong localStorage của trình duyệt theo tàu /
 * bộ phận / tháng, nên đóng máy mở lại vẫn còn cho tới khi bấm "Đặt lại".
 * Bản in nào đã sửa tay thì màn hình nói rõ (số chỗ khác số liệu gốc).
 */
export default function BaoCaoVatTuSua({
  khoaLuu,
  dauGoc,
  dongGoc,
}: {
  /** Khóa localStorage: tàu + bộ phận + tháng. */
  khoaLuu: string;
  dauGoc: DauBaoCao1101;
  dongGoc: DongBaoCao1101[];
}) {
  const { t } = useNgonNgu();
  const [sua, setSua] = useState(false);
  const [dau, setDau] = useState<DauBaoCao1101>(dauGoc);
  const [dong, setDong] = useState<DongBaoCao1101[]>(dongGoc);
  const [daNap, setDaNap] = useState(false);

  // Nạp bản đã sửa của lần trước (nếu có). Bắt đầu trong setTimeout để không
  // setState ngay trong thân effect.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(khoaLuu);
        if (raw) {
          const luu = JSON.parse(raw) as BanLuu;
          if (luu && luu.dau && Array.isArray(luu.dong)) {
            setDau({ ...dauGoc, ...luu.dau });
            setDong(luu.dong);
          }
        }
      } catch {
        /* localStorage bị chặn hay dữ liệu hỏng: dùng số liệu gốc */
      }
      setDaNap(true);
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khoaLuu]);

  const soChoKhac = (() => {
    let n = 0;
    const gocTheoId = new Map(dongGoc.map((d) => [d.id, d]));
    for (const d of dong) {
      const g = gocTheoId.get(d.id);
      if (!g) {
        n++;
        continue;
      }
      for (const k of Object.keys(d) as (keyof DongBaoCao1101)[]) if (k !== "id" && d[k] !== g[k]) n++;
    }
    n += dongGoc.filter((g) => !dong.some((d) => d.id === g.id)).length;
    for (const k of Object.keys(dau) as (keyof DauBaoCao1101)[]) if (dau[k] !== dauGoc[k]) n++;
    return n;
  })();

  const luu = (dauMoi: DauBaoCao1101, dongMoi: DongBaoCao1101[]) => {
    try {
      window.localStorage.setItem(khoaLuu, JSON.stringify({ dau: dauMoi, dong: dongMoi, luc: new Date().toISOString() } satisfies BanLuu));
    } catch {
      /* không lưu được thì vẫn sửa được trong phiên này */
    }
  };
  const capNhatDau = (patch: Partial<DauBaoCao1101>) => {
    const moi = { ...dau, ...patch };
    setDau(moi);
    luu(moi, dong);
  };
  const capNhatDong = (i: number, patch: Partial<DongBaoCao1101>) => {
    const moi = dong.map((d, j) => (j === i ? { ...d, ...patch } : d));
    setDong(moi);
    luu(dau, moi);
  };
  const themDong = () => {
    const moi = [...dong, { id: `moi-${Date.now()}`, ten: "", kyHieu: "", donVi: "", tonTruoc: "", nhan: "", ngayNhan: "", dung: "", ngayDung: "", ton: "", ghiChu: "" }];
    setDong(moi);
    luu(dau, moi);
  };
  const xoaDong = (i: number) => {
    const moi = dong.filter((_, j) => j !== i);
    setDong(moi);
    luu(dau, moi);
  };
  const datLai = () => {
    if (!window.confirm(t("inventory.xacNhanDatLai"))) return;
    try {
      window.localStorage.removeItem(khoaLuu);
    } catch {
      /* bỏ qua */
    }
    setDau(dauGoc);
    setDong(dongGoc);
    setSua(false);
  };

  const oTrai = O_TRAI;

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        {sua ? (
          <>
            <Button type="button" variant="primary" size="sm" onClick={() => setSua(false)} icon={<Check className="size-4" />}>
              {t("inventory.xongSua")}
            </Button>
            <Button type="button" size="sm" onClick={themDong} icon={<Plus className="size-4" />}>
              {t("inventory.themDongBaoCao")}
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" onClick={() => setSua(true)} icon={<Pencil className="size-4" />}>
            {t("inventory.suaTruocKhiIn")}
          </Button>
        )}
        {(soChoKhac > 0 || sua) && (
          <Button type="button" variant="ghost" size="sm" onClick={datLai} icon={<RotateCcw className="size-4" />}>
            {t("inventory.datLaiSoLieuGoc")}
          </Button>
        )}
        <span className="text-xs text-[var(--text-muted)]">{sua ? t("inventory.goiYSua") : ""}</span>
      </div>
      {daNap && soChoKhac > 0 && (
        <Notice tone="warning" className="no-print">
          {t("inventory.daSuaTay", { n: soChoKhac })}
        </Notice>
      )}

      <div className="print-area surface rounded-xl border p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <table className="w-full border-2 border-black text-sm">
          <tbody>
            <tr>
              <td className="w-44 border border-black p-2 align-middle">
                <LogoBieuMau />
              </td>
              <td className="border border-black p-2 text-center">
                <p className="font-bold">CÔNG TY TNHH MERCURY LINES</p>
                <p className="font-bold">MERCURY LINES COMPANY LIMITED</p>
                <p className="text-xs italic">Phù hợp: Bộ luật ISM 5.2, 6.1.3, 10.1</p>
              </td>
              <td className="w-44 border border-black p-2 text-xs">
                <p>MLS-11-01</p>
                <p>Ngày ban hành: 10/01/2024</p>
                <p>Soát xét: 00</p>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black p-2 text-center">
                <p className="text-base font-bold">BÁO CÁO NHẬN VÀ SỬ DỤNG VẬT TƯ</p>
                <p className="text-base font-bold">MATERIALS RECEIVING &amp; USING REPORT</p>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 grid grid-cols-2 gap-1 text-sm">
          <p className="flex gap-1">
            <span className="shrink-0 font-semibold">Tên tàu (Ships name):</span>
            <Cell sua={sua} giaTri={dau.tenTau} onChange={(v) => capNhatDau({ tenTau: v })} className={oTrai} />
          </p>
          <p className="flex gap-1">
            <span className="shrink-0 font-semibold">Date (Ngày):</span>
            <Cell sua={sua} giaTri={dau.ngay} onChange={(v) => capNhatDau({ ngay: v })} className={oTrai} />
          </p>
          <p className="flex gap-1">
            <span className="shrink-0 font-semibold">Bộ phận (Dep.):</span>
            <Cell sua={sua} giaTri={dau.boPhan} onChange={(v) => capNhatDau({ boPhan: v })} className={oTrai} />
          </p>
          <p className="flex gap-1">
            <span className="shrink-0 font-semibold">Tại cảng (At Sea):</span>
            <Cell sua={sua} giaTri={dau.taiCang} onChange={(v) => capNhatDau({ taiCang: v })} className={oTrai} chu={dau.taiCang || ".........................."} />
          </p>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-2 border-black text-xs">
            <thead>
              <tr className="text-center">
                <th rowSpan={2} className="border border-black p-1">
                  Stt
                  <br />
                  No
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  Tên vật tư
                  <br />
                  Material Name
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  Ký hiệu
                  <br />
                  Spare part No.
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  Đơn vị
                  <br />
                  Unit
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  SL tồn đợt trước
                  <br />
                  Last ROB
                </th>
                <th colSpan={2} className="border border-black p-1">
                  Vật tư nhận
                  <br />
                  Received
                </th>
                <th colSpan={2} className="border border-black p-1">
                  Vật tư sử dụng
                  <br />
                  Used Materials
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  Vật tư tồn
                  <br />
                  Remain on board
                </th>
                <th rowSpan={2} className="border border-black p-1">
                  Ghi chú
                  <br />
                  Remarks
                </th>
                {sua && <th rowSpan={2} className="no-print border border-black p-1" />}
              </tr>
              <tr className="text-center">
                <th className="border border-black p-1">
                  S.Lượng
                  <br />
                  Q.ty
                </th>
                <th className="border border-black p-1">
                  Ngày
                  <br />
                  Date
                </th>
                <th className="border border-black p-1">
                  S.Lượng
                  <br />
                  Q.ty
                </th>
                <th className="border border-black p-1">
                  Ngày
                  <br />
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {dong.length === 0 ? (
                <tr>
                  <td colSpan={sua ? 12 : 11} className="border border-black p-3 text-center text-slate-500">
                    {t("inventory.khongCoDuLieuKy")}
                  </td>
                </tr>
              ) : (
                dong.map((d, i) => (
                  <tr key={d.id} className="text-center">
                    <td className="border border-black p-1">{i + 1}</td>
                    <td className="border border-black p-1 text-left">
                      <Cell sua={sua} giaTri={d.ten} onChange={(v) => capNhatDong(i, { ten: v })} className={oTrai} />
                    </td>
                    <td className="border border-black p-1">
                      <Cell sua={sua} giaTri={d.kyHieu} onChange={(v) => capNhatDong(i, { kyHieu: v })} />
                    </td>
                    <td className="border border-black p-1">
                      <Cell sua={sua} giaTri={d.donVi} onChange={(v) => capNhatDong(i, { donVi: v })} />
                    </td>
                    <td className="border border-black p-1">
                      <Cell sua={sua} giaTri={d.tonTruoc} onChange={(v) => capNhatDong(i, { tonTruoc: v })} />
                    </td>
                    <td className="border border-black p-1">
                      <Cell sua={sua} giaTri={d.nhan} onChange={(v) => capNhatDong(i, { nhan: v })} />
                    </td>
                    <td className="border border-black p-1">
                      <Cell sua={sua} giaTri={d.ngayNhan} onChange={(v) => capNhatDong(i, { ngayNhan: v })} />
                    </td>
                    <td className="border border-black p-1">
                      <Cell sua={sua} giaTri={d.dung} onChange={(v) => capNhatDong(i, { dung: v })} />
                    </td>
                    <td className="border border-black p-1">
                      <Cell sua={sua} giaTri={d.ngayDung} onChange={(v) => capNhatDong(i, { ngayDung: v })} />
                    </td>
                    <td className="border border-black p-1 font-semibold">
                      <Cell sua={sua} giaTri={d.ton} onChange={(v) => capNhatDong(i, { ton: v })} />
                    </td>
                    <td className="border border-black p-1 text-left">
                      <Cell sua={sua} giaTri={d.ghiChu} onChange={(v) => capNhatDong(i, { ghiChu: v })} className={oTrai} />
                    </td>
                    {sua && (
                      <td className="no-print border border-black p-1">
                        <button type="button" onClick={() => xoaDong(i)} title={t("inventory.xoaDongBaoCao")} className="rounded p-0.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-600">
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-between text-xs text-slate-700">
          <div>
            <p>Người làm báo cáo: CE, CO</p>
            <p>Thời điểm làm báo cáo: Hàng tháng</p>
          </div>
          <div>
            <p>Thời gian lưu: 3 năm</p>
            <p>Lưu VP: Vật tư</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 text-center text-sm">
          <div>
            <p className="font-bold">NGƯỜI LÀM BÁO CÁO</p>
            <p className="italic">CE / CO</p>
            <div className="mt-16" />
          </div>
          <div>
            <p className="font-bold">THUYỀN TRƯỞNG</p>
            <p className="italic">Captain</p>
            <div className="mt-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
