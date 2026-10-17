"use client";

import { useEffect, useEffectEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Download, FilePenLine, FolderPlus, Pencil, Plus, Printer, RotateCcw, Save, Trash2, X } from "lucide-react";
import LogoBieuMau from "@/components/LogoBieuMau";
import { goDanhMucThietYeu, luuThangThietYeu, themPhuTungThietYeu, xoaPhuTungThietYeu } from "@/app/thiet-yeu-actions";
import {
  COT_IN,
  SU_KIEN_XOA_BAN_IN,
  VI_TRI_CO_THE,
  chuyenNhomDong,
  doiChoDong,
  doiTenNhomDong,
  dongInTu,
  ghepDongMoi,
  gomNhom,
  khoaBanIn,
  laThieuIn,
  soIn,
  soTrongO,
  xoaBanInCuaTau,
  type DongIn,
  type DongThietYeu,
} from "@/lib/thietYeu";
import { useNgonNgu } from "@/lib/i18n/client";
import { Badge, Button, Field, Input, Notice, Select } from "@/components/ui";

type DauIn = { tenTau: string; ngay: string };
/**
 * Bản in đã sửa tay, cất trong localStorage theo tàu + tháng. `dau` chỉ giữ ô
 * người dùng đã sửa (ngày của tháng đang chạy tự đổi theo hôm nay, không bị
 * "đóng băng" vào bản nháp); `moc` = dấu của các dòng gốc lúc bắt đầu sửa.
 */
type BanIn = { dau: Partial<DauIn>; dong: DongIn[]; moc: string };
type CheDo = "xem" | "in" | "so";

const O_SUA = "o-sua w-full min-w-0 border-0 bg-transparent p-0 text-inherit focus:outline-none focus:ring-1 focus:ring-brand-500";
const O = "border border-black p-1";
/** Ô đã sửa tay khác số liệu gốc: tô nhẹ trên màn hình, in ra vẫn trắng. */
const DA_SUA = "bg-amber-100/70 dark:bg-amber-500/15 print:bg-transparent";

/**
 * Một ô: đang sửa là <input>, không thì là chữ. Ở cấp module để ô không mất con trỏ khi gõ.
 * `goiY` = id của <datalist> gợi ý (ô Vị trí: danh sách vị trí có thể, vẫn gõ tự do được).
 */
function Cell({ sua, giaTri, onChange, trai, goiY }: { sua: boolean; giaTri: string; onChange: (v: string) => void; trai?: boolean; goiY?: string }) {
  if (!sua) return <>{giaTri}</>;
  return <input value={giaTri} onChange={(e) => onChange(e.target.value)} list={goiY} className={`${O_SUA} ${trai ? "text-left" : "text-center"}`} />;
}

/** id của <datalist> vị trí có thể (một cái cho cả bảng). */
const DS_VI_TRI = "vi-tri-thiet-yeu";
/** id ô Mô tả của khung thêm mục ("+ Mục" ở dòng nhóm đưa con trỏ tới đây). */
const O_MO_TA_MOI = "thiet-yeu-mo-ta-moi";

const TONE_NGUON = { DA_LUU: "success", KHO: "info", UOC: "muted" } as const;

/** Dấu ngắn của các dòng gốc — đổi khi hệ thống có số mới sau lúc bản in được sửa. */
function vanTay(dong: DongIn[]): string {
  const s = JSON.stringify(dong);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Đổi Ban đầu / Nhận / Tiêu thụ → Hiện có tự tính lại (sửa tay đè được). */
function tinhLai(d: DongIn, patch: Partial<DongIn>): DongIn {
  const m = { ...d, ...patch };
  if ("tonDau" in patch || "nhan" in patch || "tieuThu" in patch) {
    const a = soTrongO(m.tonDau);
    if (a !== null) m.hienCo = soIn(a + (soTrongO(m.nhan) ?? 0) - (soTrongO(m.tieuThu) ?? 0));
  }
  return m;
}

/**
 * Bảng MLS-11-04 của một tàu cho một tháng — đồng thời là bản in (vùng
 * .print-area dựng theo đúng mẫu công ty). Hai cách sửa, không lẫn nhau:
 *   - "Sửa trước khi in" (ai xem được cũng dùng được): sửa MỌI chữ trên bản in —
 *     tên tàu, ngày, tên nhóm, từng ô, thêm / bỏ dòng. Chỉ là bản để in, cất trong
 *     trình duyệt theo tàu + tháng, KHÔNG đổi số liệu hệ thống; in và "Xuất Word"
 *     đều ra đúng bản đã sửa cho tới khi bấm "Đặt lại".
 *   - "Hiệu chỉnh danh mục & số lượng" (Máy trưởng / Đại phó / Thuyền trưởng / quản trị): sửa
 *     rồi LƯU vào hệ thống — nhóm (đổi tên, chuyển mục sang nhóm khác), số thứ tự, thứ tự dòng,
 *     mô tả, số phụ tùng, tối thiểu, số của tháng, vị trí; thêm / xóa mục. Lưu chốt cả số tháng,
 *     hoặc "Chỉ lưu danh mục". Bật được từ nút ở đầu trang và từ bảng "Cần bổ sung" (HTML máy chủ
 *     mang data-sua-thiet-yeu="<id mục>" — xem effect nghe bấm bên dưới).
 */
export default function BangThietYeu({
  vesselId,
  maTau,
  thang,
  tenTau,
  ngay,
  dongGoc,
  coQuyen,
  goDuoc,
}: {
  vesselId: number;
  maTau: string;
  thang: string;
  tenTau: string;
  ngay: string;
  dongGoc: DongThietYeu[];
  coQuyen: boolean;
  /** Gỡ cả danh mục của tàu: quản trị ở bản cài văn phòng (goDanhMucThietYeu kiểm lại). */
  goDuoc: boolean;
}) {
  const { t, tTuDo } = useNgonNgu();
  const router = useRouter();
  const khoaLuu = khoaBanIn(vesselId, thang);
  const dauGoc = useMemo<DauIn>(() => ({ tenTau, ngay }), [tenTau, ngay]);
  const dongGocIn = useMemo(() => dongGoc.map(dongInTu), [dongGoc]);
  const moc = useMemo(() => vanTay(dongGocIn), [dongGocIn]);
  const gocTheoId = useMemo(() => new Map(dongGocIn.map((d) => [d.id, d])), [dongGocIn]);
  const nguonTheoId = useMemo(() => new Map(dongGoc.map((d) => [String(d.id), d])), [dongGoc]);

  const [cheDo, setCheDo] = useState<CheDo>("xem");
  const [banIn, setBanIn] = useState<BanIn | null>(null);
  const [daNap, setDaNap] = useState(false);
  const [dongSo, setDongSo] = useState<DongIn[]>(dongGocIn);
  const [gocTruoc, setGocTruoc] = useState(dongGoc);
  const [thongBao, setThongBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [dangGui, startTransition] = useTransition();
  const [dangXuat, setDangXuat] = useState(false);
  const [moi, setMoi] = useState({ nhom: dongGoc[0]?.nhom ?? "", nhomMoi: "", moTa: "", partNo: "", toiThieu: "" });
  /** Mục vừa mở để hiệu chỉnh từ chỗ khác trên trang (tô sáng dòng). */
  const [chiMuc, setChiMuc] = useState<string | null>(null);
  /** Yêu cầu cuộn tới bảng / đúng mục sau khi bật hiệu chỉnh (n tăng mỗi lần bấm). */
  const [cuonToi, setCuonToi] = useState<{ n: number; id: string | null } | null>(null);

  // Nạp bản in đã sửa của lần trước (nếu có). Chạy trong setTimeout để không
  // setState ngay trong thân effect.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(khoaLuu);
        const luu = raw ? (JSON.parse(raw) as BanIn) : null;
        setBanIn(luu && luu.dau && Array.isArray(luu.dong) ? luu : null);
      } catch {
        setBanIn(null); /* localStorage bị chặn hay dữ liệu hỏng: dùng số liệu gốc */
      }
      setDaNap(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [khoaLuu]);

  // Nhập lại / gỡ danh mục ở chỗ khác trên trang thì bản in sửa tay cũ không
  // còn khớp — bỏ luôn bản đang giữ trong bộ nhớ.
  useEffect(() => {
    const nghe = (e: Event) => {
      if ((e as CustomEvent<number>).detail === vesselId) setBanIn(null);
    };
    window.addEventListener(SU_KIEN_XOA_BAN_IN, nghe);
    return () => window.removeEventListener(SU_KIEN_XOA_BAN_IN, nghe);
  }, [vesselId]);

  // Server trả bảng mới (sau khi lưu / thêm / xóa mục): đang hiệu chỉnh thì giữ thứ tự và ô đã
  // gõ của mục cũ, chèn mục mới vào cuối nhóm, bỏ mục đã xóa; không thì lấy nguyên.
  if (dongGoc !== gocTruoc) {
    setGocTruoc(dongGoc);
    setDongSo((cu) => (cheDo === "so" ? ghepDongMoi(cu, dongGocIn) : dongGocIn));
  }

  const suaIn = cheDo === "in";
  const suaSo = cheDo === "so";
  const dau: DauIn = !suaSo && banIn ? { ...dauGoc, ...banIn.dau } : dauGoc;
  const dauDaSua = (k: keyof DauIn) => !suaSo && dau[k] !== dauGoc[k];
  const dong = suaSo ? dongSo : (banIn?.dong ?? dongGocIn);

  // Số chỗ bản in khác số liệu gốc (ô, dòng thêm / bỏ, tên tàu, ngày).
  const soChoKhac = (() => {
    if (!banIn) return 0;
    let n = 0;
    for (const d of banIn.dong) {
      const g = gocTheoId.get(d.id);
      if (!g) n++;
      else for (const k of [...COT_IN, "nhom" as const]) if (d[k] !== g[k]) n++;
    }
    n += dongGocIn.filter((g) => !banIn.dong.some((d) => d.id === g.id)).length;
    for (const k of ["tenTau", "ngay"] as const) if (banIn.dau[k] !== undefined && banIn.dau[k] !== dauGoc[k]) n++;
    return n;
  })();

  const ghiBanIn = (b: BanIn | null) => {
    setBanIn(b);
    try {
      if (b) window.localStorage.setItem(khoaLuu, JSON.stringify(b));
      else window.localStorage.removeItem(khoaLuu);
    } catch {
      /* không lưu được thì vẫn sửa được trong phiên này */
    }
  };
  const doiBanIn = (f: (b: BanIn) => BanIn) => ghiBanIn(f(banIn ?? { dau: {}, dong: dongGocIn, moc }));

  // ─── Sửa trước khi in (chỉ trong trình duyệt) ───
  const batDauSuaIn = () => {
    setThongBao(null);
    setCheDo("in");
  };
  const xongSuaIn = () => {
    setCheDo("xem");
    if (banIn && soChoKhac === 0) ghiBanIn(null);
  };
  const datLai = () => {
    if (!window.confirm(t("thietYeu.xacNhanDatLai"))) return;
    ghiBanIn(null);
    setCheDo("xem");
  };
  const suaDongIn = (id: string, patch: Partial<DongIn>) =>
    doiBanIn((b) => ({ ...b, dong: b.dong.map((d) => (d.id === id ? tinhLai(d, patch) : d)) }));
  const doiTenNhom = (cu: string, moiTen: string) => doiBanIn((b) => ({ ...b, dong: doiTenNhomDong(b.dong, cu, moiTen) }));
  const themDongIn = (nhom: string) =>
    doiBanIn((b) => {
      const cuoi = b.dong.map((d) => d.nhom).lastIndexOf(nhom);
      const stt = String(Math.max(0, ...b.dong.filter((d) => d.nhom === nhom).map((d) => Number(d.stt) || 0)) + 1);
      const dongMoi: DongIn = { id: `moi-${Date.now()}`, nhom, stt, moTa: "", partNo: "", toiThieu: "", tonDau: "", nhan: "", tieuThu: "", hienCo: "", viTri: "" };
      const ds = [...b.dong];
      ds.splice(cuoi < 0 ? ds.length : cuoi + 1, 0, dongMoi);
      return { ...b, dong: ds };
    });
  const themNhomIn = () =>
    doiBanIn((b) => {
      const chu = String.fromCharCode(65 + Math.min(25, gomNhom(b.dong).length));
      const nhom = t("thietYeu.tenNhomMacDinh", { chu });
      return { ...b, dong: [...b.dong, { id: `moi-${Date.now()}`, nhom, stt: "1", moTa: "", partNo: "", toiThieu: "", tonDau: "", nhan: "", tieuThu: "", hienCo: "", viTri: "" }] };
    });
  const boDongIn = (id: string) => doiBanIn((b) => ({ ...b, dong: b.dong.filter((d) => d.id !== id) }));

  // ─── Hiệu chỉnh danh mục & số lượng (lưu vào hệ thống) ───
  const bao = (r: { message: string; success?: boolean }) => setThongBao({ ok: Boolean(r.success), chu: r.message });
  const batDauSuaSo = () => {
    setDongSo(dongGocIn);
    setThongBao(null);
    setChiMuc(null);
    setCheDo("so");
  };
  const dongGui = () =>
    dongSo.map(({ id, nhom, stt, moTa, partNo, toiThieu, tonDau, nhan, tieuThu, hienCo, viTri }) => ({ id: Number(id), nhom, stt, moTa, partNo, toiThieu, tonDau, nhan, tieuThu, hienCo, viTri }));
  const xongLuu = (r: { message: string; success?: boolean }) => {
    bao(r);
    if (r.success) {
      setCheDo("xem");
      setChiMuc(null);
    }
  };
  /** Lưu danh mục VÀ chốt số của tháng đang xem cho mọi mục (báo cáo tháng). */
  const luu = () => startTransition(async () => xongLuu(await luuThangThietYeu(vesselId, thang, dongGui())));
  /** Chỉ lưu danh mục (nhóm, số thứ tự, thứ tự, mô tả, số phụ tùng, tối thiểu, vị trí) — số tháng đã gõ thì hỏi lại. */
  const luuDanhMuc = () => {
    const soDaGo = dongSo.filter((d) => {
      const g = gocTheoId.get(d.id);
      return g && (["tonDau", "nhan", "tieuThu", "hienCo"] as const).some((k) => d[k] !== g[k]);
    }).length;
    if (soDaGo > 0 && !window.confirm(t("thietYeu.xacNhanChiDanhMuc", { n: soDaGo }))) return;
    startTransition(async () => xongLuu(await luuThangThietYeu(vesselId, thang, dongGui(), { chiDanhMuc: true })));
  };
  const huySo = () => {
    if (!window.confirm(t("thietYeu.xacNhanHuy"))) return;
    setDongSo(dongGocIn);
    setCheDo("xem");
    setThongBao(null);
    setChiMuc(null);
  };
  const doiCho = (id: string, huong: -1 | 1) => setDongSo((ds) => doiChoDong(ds, id, huong));
  const chuyenNhom = (id: string, nhom: string) => setDongSo((ds) => chuyenNhomDong(ds, id, nhom));
  const doiTenNhomSo = (cu: string, moiTen: string) => setDongSo((ds) => doiTenNhomDong(ds, cu, moiTen));
  /** Nhóm đang có trên bảng (gồm tên vừa đổi, chưa lưu) — cho ô thêm mục và ô chuyển nhóm. */
  const nhomDangCo = gomNhom(suaSo ? dongSo : dongGocIn).map((g) => g.nhom);
  const nhomThem = nhomDangCo.includes(moi.nhom) || moi.nhom === "__moi__" ? moi.nhom : (nhomDangCo[0] ?? "__moi__");
  const them = () =>
    startTransition(async () => {
      const nhom = nhomThem === "__moi__" ? moi.nhomMoi : nhomThem;
      const r = await themPhuTungThietYeu(vesselId, { nhom, moTa: moi.moTa, partNo: moi.partNo, toiThieu: moi.toiThieu });
      bao(r);
      if (r.success) {
        setMoi((m) => ({ ...m, nhom, nhomMoi: "", moTa: "", partNo: "", toiThieu: "" }));
      }
    });
  /** "+ Mục" ở dòng nhóm: chọn sẵn nhóm đó ở ô thêm mục, đưa con trỏ tới ô mô tả. */
  const themMucVaoNhom = (nhom: string) => {
    setMoi((m) => ({ ...m, nhom }));
    const o = document.getElementById(O_MO_TA_MOI);
    o?.scrollIntoView({ behavior: "smooth", block: "center" });
    o?.focus({ preventScroll: true });
  };

  // Nút "Hiệu chỉnh danh mục & số lượng" ở đầu trang và nút sửa của bảng "Cần bổ sung" là HTML máy
  // chủ mang data-sua-thiet-yeu="<id mục>" (rỗng = cả bảng): bấm là bật hiệu chỉnh (giữ chỗ đang
  // sửa dở), tô sáng mục và cuộn tới. Chưa nạp xong JS thì liên kết #… vẫn đưa tới bảng.
  const moHieuChinh = useEffectEvent((id: string) => {
    if (cheDo !== "so") {
      setDongSo(dongGocIn);
      setThongBao(null);
      setCheDo("so");
    }
    setChiMuc(id || null);
    setCuonToi((c) => ({ n: (c?.n ?? 0) + 1, id: id || null }));
  });
  useEffect(() => {
    if (!coQuyen) return;
    const bam = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("[data-sua-thiet-yeu]") : null;
      if (!a) return;
      e.preventDefault();
      moHieuChinh(a.getAttribute("data-sua-thiet-yeu") ?? "");
    };
    document.addEventListener("click", bam);
    return () => document.removeEventListener("click", bam);
  }, [coQuyen]);
  useEffect(() => {
    if (!cuonToi) return;
    const id = window.setTimeout(() => {
      document.getElementById(cuonToi.id ? `muc-${cuonToi.id}` : "bang-thiet-yeu")?.scrollIntoView({ behavior: "smooth", block: cuonToi.id ? "center" : "start" });
    }, 0);
    return () => window.clearTimeout(id);
  }, [cuonToi]);
  const goDanhMuc = () => {
    if (!window.confirm(t("thietYeu.xacNhanGoDanhMuc", { tau: tenTau, n: dongGoc.length }))) return;
    setThongBao(null);
    startTransition(async () => {
      const r = await goDanhMucThietYeu(vesselId);
      if (!r.success) {
        bao(r);
        return;
      }
      xoaBanInCuaTau(vesselId);
      // Bảng này sắp biến mất (trang về trạng thái chưa có danh mục) — báo kết
      // quả qua URL để trang hiện, thay vì thông báo nằm trong bảng.
      router.replace(`/materials/thiet-yeu?vessel=${vesselId}&thang=${thang}&daGo=${dongGoc.length}`);
    });
  };
  const xoa = (d: DongIn) => {
    if (!window.confirm(t("thietYeu.xacNhanXoa", { moTa: d.moTa }))) return;
    startTransition(async () => {
      const r = await xoaPhuTungThietYeu(Number(d.id));
      bao(r);
    });
  };

  // ─── Xuất Word: bản đã sửa tay thì gửi đúng bản đó, không thì số liệu hệ thống.
  // Tải qua fetch cả hai đường để lỗi (vd. chưa có mẫu) hiện ngay trên trang. ───
  const xuatWord = async () => {
    setDangXuat(true);
    setThongBao(null);
    try {
      const r =
        banIn && soChoKhac > 0
          ? await fetch("/api/export/thiet-yeu", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vessel: vesselId, thang, tenTau: dau.tenTau, ngay: dau.ngay, dong: banIn.dong }),
            })
          : await fetch(`/api/export/thiet-yeu?vessel=${vesselId}&thang=${thang}`);
      if (!r.ok) {
        const chu = (r.headers.get("content-type") ?? "").startsWith("text/plain") && r.status === 404 ? await r.text() : "";
        setThongBao({ ok: false, chu: chu || t("thietYeu.khongXuatDuoc", { ma: r.status }) });
        return;
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `MLS-11-04_${maTau}_${thang}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setThongBao({ ok: false, chu: t("thietYeu.khongXuatDuoc", { ma: "—" }) });
    } finally {
      setDangXuat(false);
    }
  };

  const nhomHienThi = gomNhom(dong);
  const doiO = (d: DongIn, k: (typeof COT_IN)[number]) => (v: string) =>
    suaSo ? setDongSo((ds) => ds.map((x) => (x.id === d.id ? tinhLai(x, { [k]: v }) : x))) : suaDongIn(d.id, { [k]: v });
  // Vị trí có thể trên tàu (lib/thietYeu.ts) — gợi ý cho ô Vị trí và ô "Vị trí cho cả nhóm".
  const luaChonViTri = VI_TRI_CO_THE.map((v) => ({ value: v.ma, label: tTuDo(`thietYeu.viTri_${v.khoa}`) }));
  /** Ghi một vị trí cho mọi dòng của nhóm (số tháng: lưu khi bấm Lưu; bản in: chỉ bản in). */
  const datViTriNhom = (nhom: string, viTri: string) =>
    suaSo
      ? setDongSo((ds) => ds.map((x) => (x.nhom === nhom ? { ...x, viTri } : x)))
      : doiBanIn((b) => ({ ...b, dong: b.dong.map((x) => (x.nhom === nhom ? { ...x, viTri } : x)) }));
  const laSua = (d: DongIn, k: keyof DongIn) => !suaSo && Boolean(banIn) && gocTheoId.get(d.id)?.[k] !== d[k];
  const dangSua = suaIn || suaSo;

  return (
    // id: đích của nút "Hiệu chỉnh danh mục & số lượng" ở đầu trang (#bang-thiet-yeu).
    <div id="bang-thiet-yeu" className="scroll-mt-4 space-y-3">
      {/* Gợi ý cho ô Vị trí khi sửa: chọn trong danh sách hoặc gõ tự do. */}
      <datalist id={DS_VI_TRI}>
        {luaChonViTri.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </datalist>
      <div className="no-print flex flex-wrap items-center gap-2">
        {suaSo ? (
          <>
            <Button type="button" variant="primary" size="sm" onClick={luu} loading={dangGui} icon={<Check className="size-4" />}>
              {dangGui ? t("thietYeu.dangLuu") : t("thietYeu.luuThang", { thang })}
            </Button>
            <Button type="button" size="sm" onClick={luuDanhMuc} disabled={dangGui} title={t("thietYeu.chiLuuDanhMucGoiY")} icon={<Save className="size-4" />}>
              {t("thietYeu.chiLuuDanhMuc")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={huySo} disabled={dangGui} icon={<X className="size-4" />}>
              {t("thietYeu.huySua")}
            </Button>
            <span className="basis-full text-xs text-[var(--text-muted)]">{t("thietYeu.goiYSua")}</span>
          </>
        ) : suaIn ? (
          <>
            <Button type="button" variant="primary" size="sm" onClick={xongSuaIn} icon={<Check className="size-4" />}>
              {t("thietYeu.xongSuaIn")}
            </Button>
            <Button type="button" size="sm" onClick={themNhomIn} icon={<FolderPlus className="size-4" />}>
              {t("thietYeu.themNhomIn")}
            </Button>
            <span className="text-xs text-[var(--text-muted)]">{t("thietYeu.goiYSuaIn")}</span>
          </>
        ) : (
          <>
            <Button type="button" size="sm" onClick={batDauSuaIn} icon={<FilePenLine className="size-4" />}>
              {t("thietYeu.suaTruocKhiIn")}
            </Button>
            {coQuyen && (
              <Button type="button" size="sm" onClick={batDauSuaSo} icon={<Pencil className="size-4" />}>
                {t("thietYeu.hieuChinh")}
              </Button>
            )}
            {goDuoc && (
              <Button type="button" variant="danger" size="sm" onClick={goDanhMuc} loading={dangGui} icon={<Trash2 className="size-4" />}>
                {t("thietYeu.goDanhMuc")}
              </Button>
            )}
          </>
        )}
        {!suaSo && soChoKhac > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={datLai} icon={<RotateCcw className="size-4" />}>
            {t("thietYeu.datLai")}
          </Button>
        )}
        {!suaSo && (
          <span className="ml-auto flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => window.print()} icon={<Printer className="size-4" />}>
              {t("thietYeu.inBaoCao")}
            </Button>
            <Button type="button" size="sm" onClick={xuatWord} loading={dangXuat} icon={<Download className="size-4" />}>
              {t("thietYeu.xuatWord")}
            </Button>
          </span>
        )}
      </div>
      {daNap && !suaSo && soChoKhac > 0 && (
        <Notice tone="warning" className="no-print">
          {t("thietYeu.daSuaTay", { n: soChoKhac })}
          {banIn && banIn.moc !== moc && <> {t("thietYeu.banInCu")}</>}
        </Notice>
      )}
      {thongBao && (
        <Notice tone={thongBao.ok ? "success" : "danger"} className="no-print">
          {thongBao.chu}
        </Notice>
      )}

      {suaSo && (
        <div className="no-print grid grid-cols-1 items-end gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 md:grid-cols-[14rem_1fr_9rem_9rem_auto]">
          <Field label={t("thietYeu.nhom")}>
            <Select value={nhomThem} onChange={(e) => setMoi({ ...moi, nhom: e.target.value })}>
              {nhomDangCo.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="__moi__">{t("thietYeu.nhomMoi")}</option>
            </Select>
          </Field>
          <Field label={t("thietYeu.moTaMuc")}>
            {nhomThem === "__moi__" && (
              <Input className="mb-2" value={moi.nhomMoi} placeholder={t("thietYeu.tenNhomMoi")} onChange={(e) => setMoi({ ...moi, nhomMoi: e.target.value })} />
            )}
            <Input id={O_MO_TA_MOI} value={moi.moTa} onChange={(e) => setMoi({ ...moi, moTa: e.target.value })} />
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
        <div className="mt-2 grid grid-cols-2 gap-x-10 text-sm">
          <p className="flex gap-1">
            <span className="shrink-0">
              Tên tàu (<i>Vessel</i>)
            </span>
            <span className={`min-w-0 flex-1 font-bold ${dauDaSua("tenTau") ? DA_SUA : ""}`}>
              <Cell sua={suaIn} giaTri={dau.tenTau} onChange={(v) => doiBanIn((b) => ({ ...b, dau: { ...b.dau, tenTau: v } }))} trai />
            </span>
          </p>
          <p className="flex gap-1">
            <span className="shrink-0">
              Ngày (<i>Date</i>):
            </span>
            <span className={`min-w-0 flex-1 ${dauDaSua("ngay") ? DA_SUA : ""}`}>
              <Cell sua={suaIn} giaTri={dau.ngay} onChange={(v) => doiBanIn((b) => ({ ...b, dau: { ...b.dau, ngay: v } }))} trai />
            </span>
          </p>
        </div>

        <table className="mt-2 w-full border-2 border-black text-xs">
          <thead>
            <tr className="text-center align-middle">
              <th className={`${O} w-10`}>stt</th>
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
            {nhomHienThi.map((g, gi) => (
              <NhomRows
                // Khóa theo vị trí nhóm, không theo tên hay dòng đầu: đang gõ đổi tên nhóm, hoặc đưa
                // dòng đầu xuống dưới, thì nhóm không bị gắn lại (ô nhập / nút không mất con trỏ).
                key={gi}
                nhom={g.nhom}
                // Tên nhóm sửa được ở cả hai chế độ: bản in (chỉ bản in) và hiệu chỉnh (lưu, đổi cho mọi mục của nhóm).
                sua={dangSua}
                daSua={
                  Boolean(banIn) &&
                  !suaSo &&
                  (g.dong.some((d) => gocTheoId.has(d.id) && gocTheoId.get(d.id)!.nhom !== d.nhom) || g.dong.every((d) => !gocTheoId.has(d.id)))
                }
                onDoiTen={(v) => (suaSo ? doiTenNhomSo(g.nhom, v) : doiTenNhom(g.nhom, v))}
                onThemDong={() => (suaSo ? themMucVaoNhom(g.nhom) : themDongIn(g.nhom))}
                nhanThemDong={suaSo ? t("thietYeu.themMucNhom") : t("thietYeu.themDongIn")}
                suaViTri={dangSua}
                luaChonViTri={luaChonViTri}
                nhanViTriNhom={t("thietYeu.viTriCaNhom")}
                goiYViTriNhom={t("thietYeu.viTriCaNhomGoiY")}
                onDatViTri={(v) => datViTriNhom(g.nhom, v)}
              >
                {g.dong.map((d, i) => {
                  const thieu = laThieuIn(d);
                  const nguon = nguonTheoId.get(d.id);
                  const o = (k: (typeof COT_IN)[number], cls = "") => (
                    <td className={`${O} ${cls} ${laSua(d, k) ? DA_SUA : ""}`}>
                      <Cell
                        sua={dangSua}
                        giaTri={d[k]}
                        onChange={doiO(d, k)}
                        trai={k === "moTa"}
                        goiY={k === "viTri" ? DS_VI_TRI : undefined}
                      />
                    </td>
                  );
                  return (
                    <tr
                      key={d.id}
                      id={`muc-${d.id}`}
                      className={`scroll-mt-24 text-center align-top ${
                        suaSo && chiMuc === d.id ? "bg-sky-100 print:bg-transparent dark:bg-sky-500/20" : thieu ? "bg-rose-50 print:bg-transparent dark:bg-rose-950/30" : ""
                      }`}
                    >
                      {o("stt")}
                      {o("moTa", "text-left")}
                      {o("partNo")}
                      {o("toiThieu")}
                      {o("tonDau")}
                      {o("nhan")}
                      {o("tieuThu")}
                      {o("hienCo", `font-semibold ${thieu ? "text-[var(--text-danger)] print:text-inherit" : ""}`)}
                      {o("viTri")}
                      <td className={`no-print ${O}`}>
                        <div className="flex items-center justify-center gap-1">
                          {nguon ? (
                            <Badge tone={TONE_NGUON[nguon.nguon]}>{tTuDo(`thietYeu.nguon_${nguon.nguon}`)}</Badge>
                          ) : (
                            <Badge tone="warning">{t("thietYeu.dongThemTay")}</Badge>
                          )}
                          {dangSua && (
                            <button
                              type="button"
                              onClick={() => (suaSo ? xoa(d) : boDongIn(d.id))}
                              disabled={dangGui}
                              title={suaSo ? t("thietYeu.xoaMuc") : t("thietYeu.boDongIn")}
                              aria-label={suaSo ? t("thietYeu.xoaMuc") : t("thietYeu.boDongIn")}
                              className="rounded p-0.5 text-[var(--text-danger)] hover:bg-rose-500/10"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                        {suaSo && (
                          // Đưa lên / xuống trong nhóm, chuyển sang nhóm khác — lưu khi bấm Lưu.
                          <div className="mt-1 flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => doiCho(d.id, -1)}
                              disabled={i === 0}
                              title={t("thietYeu.lenTren")}
                              aria-label={t("thietYeu.lenTren")}
                              className="rounded p-0.5 text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-30"
                            >
                              <ArrowUp className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => doiCho(d.id, 1)}
                              disabled={i === g.dong.length - 1}
                              title={t("thietYeu.xuongDuoi")}
                              aria-label={t("thietYeu.xuongDuoi")}
                              className="rounded p-0.5 text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] disabled:opacity-30"
                            >
                              <ArrowDown className="size-3.5" />
                            </button>
                            {nhomDangCo.length > 1 && (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) chuyenNhom(d.id, e.target.value);
                                }}
                                title={t("thietYeu.chuyenNhom")}
                                aria-label={t("thietYeu.chuyenNhom")}
                                className="w-16 rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-0.5 py-0.5 text-xs text-[var(--text-secondary)]"
                              >
                                <option value="">{t("thietYeu.chuyenNhomNgan")}</option>
                                {nhomDangCo
                                  .filter((n) => n !== d.nhom)
                                  .map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                              </select>
                            )}
                          </div>
                        )}
                        {nguon?.maVatTu && <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{t("thietYeu.ganKho", { ma: nguon.maVatTu })}</p>}
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
function NhomRows({
  nhom,
  sua,
  daSua,
  onDoiTen,
  onThemDong,
  nhanThemDong,
  suaViTri,
  luaChonViTri,
  nhanViTriNhom,
  goiYViTriNhom,
  onDatViTri,
  children,
}: {
  nhom: string;
  sua: boolean;
  daSua: boolean;
  onDoiTen: (v: string) => void;
  onThemDong: () => void;
  nhanThemDong: string;
  /** Đang sửa (bản in hoặc số tháng): hiện ô chọn vị trí cho cả nhóm. */
  suaViTri: boolean;
  luaChonViTri: { value: string; label: string }[];
  nhanViTriNhom: string;
  goiYViTriNhom: string;
  onDatViTri: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr>
        <td colSpan={9} className={`${O} text-left font-bold ${daSua ? DA_SUA : ""}`}>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Cell sua={sua} giaTri={nhom} onChange={onDoiTen} trai />
            </div>
            {suaViTri && (
              // Ô chọn ghi MỘT vị trí cho mọi dòng của nhóm — xong thì về lại dòng nhắc.
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onDatViTri(e.target.value);
                }}
                title={goiYViTriNhom}
                aria-label={nhanViTriNhom}
                className="no-print max-w-56 shrink-0 rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1 py-0.5 text-xs font-normal text-[var(--text-secondary)]"
              >
                <option value="">{nhanViTriNhom}</option>
                {luaChonViTri.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.value} — {x.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </td>
        <td className={`no-print ${O} text-center`}>
          {sua && (
            <button type="button" onClick={onThemDong} className="inline-flex items-center gap-1 rounded px-1 text-[11px] text-[var(--text-brand)] hover:underline">
              <Plus className="size-3" />
              {nhanThemDong}
            </button>
          )}
        </td>
      </tr>
      {children}
    </>
  );
}
