"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Camera,
  CameraOff,
  Check,
  Flashlight,
  ImagePlus,
  ListChecks,
  RotateCcw,
  ScanLine,
  Search,
  SwitchCamera,
  Trash2,
  X,
} from "lucide-react";
import { createInventoryTransaction } from "@/app/actions";
import { docMaTuQr } from "@/lib/qr";
import { Badge, Button, Input, Notice, Select } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

/**
 * Màn quét mã QR — chế độ KIỂM KÊ LIÊN TỤC.
 *
 * Người kiểm kê đứng ở kệ với điện thoại: giơ nhãn → máy kêu bíp → bảng ghi hiện
 * ngay dưới khung hình với tồn hiện tại → gõ số → Ghi → khung hình mở lại, giơ
 * nhãn kế tiếp. Không rời trang, không đợi tải lại, không mở lại camera. Cách cũ
 * (quét xong nhảy sang thẻ kho) tốn 4 cú bấm và một lần xin quyền camera cho
 * MỖI mặt hàng — kiểm kê 200 mặt hàng là không chịu nổi.
 *
 * Ba việc ghi được ngay trên bảng: NHẬP, XUẤT, và ĐẾM KIỂM KÊ — gõ số đếm thực
 * tế, bảng tự so với hệ thống và ghi phiếu điều chỉnh đúng phần chênh (nhập nếu
 * đếm thừa, xuất nếu đếm thiếu), ghi chú nêu rõ hai con số. Khớp thì không ghi
 * gì, chỉ đánh dấu trong danh sách phiên.
 *
 * Nhịp quét: đọc khung hình mỗi 120 ms (BarcodeDetector) hay 200 ms (jsQR); một
 * nhãn còn nằm trong khung sau khi đã ghi thì không đọc lại trong 3 giây, để
 * không mở bảng hai lần cho cùng một mặt hàng. Bảng đang mở thì tạm ngừng đọc,
 * camera vẫn chạy để mở lại tức thì.
 *
 * Ba đường đọc mã (camera trực tiếp, chụp ảnh nhãn, gõ tay) và giới hạn https
 * của trình duyệt: xem ghi chú ở batDauQuet / docTuAnh bên dưới.
 */

type HamJsQr = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  o?: { inversionAttempts: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" }
) => { data: string } | null;

type BoDoc =
  | { kieu: "trinhDuyet"; detector: { detect(v: HTMLVideoElement): Promise<Array<{ rawValue: string }>> } }
  | { kieu: "jsqr"; jsQR: HamJsQr; canvas: HTMLCanvasElement };

type CamTrangThai =
  | { kieu: "dangMo" }
  | { kieu: "dangQuet" }
  | { kieu: "dangDocAnh" }
  | { kieu: "loi"; khoa: "camera_khongCo" | "camera_biTuChoi" | "camera_canHttps" | "camera_loiKhac"; loi?: string }
  | { kieu: "tat" };

type MatHang = {
  id: number;
  code: string;
  nameVn: string;
  uom: string;
  materialType: string;
  impa: string | null;
  partNumber: string | null;
  minStock: number;
};
type DongTon = {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  vesselCode: string;
  quantity: number;
  reserved: number;
};
type Kho = { id: number; code: string; name: string; vesselId: number | null };
type DuLieuMatHang = { material: MatHang; ton: DongTon[]; khoCuaToi: Kho[]; canTransact: boolean };

type Bang =
  | { kieu: "dangTai"; ma: string }
  | { kieu: "loi"; thongBao: string }
  | { kieu: "san"; du: DuLieuMatHang };

type CheDo = "IN" | "OUT" | "DEM";

type MucPhien = {
  id: number;
  luc: string;
  ma: string;
  ten: string;
  tomTat: string;
  tone: "success" | "warning" | "info" | "danger";
};

type MayAnh = { deviceId: string; label: string };

const KHOA_CAMERA_DA_CHON = "mercury.quet.camera";
const KHOA_CHE_DO = "mercury.quet.cheDo";
const KHOA_KHO = "mercury.quet.kho";
const KHOA_PHIEN = "mercury.quet.phien";
/** Cùng một nhãn còn trong khung: không đọc lại trong khoảng này. */
const NGUOI_TRUNG_MS = 3000;

declare global {
  interface Window {
    BarcodeDetector?: new (o: { formats: string[] }) => {
      detect(v: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
    } & { getSupportedFormats?: () => Promise<string[]> };
    webkitAudioContext?: typeof AudioContext;
  }
}

async function taiJsQr(): Promise<HamJsQr> {
  const { default: jsQR } = await import("jsqr");
  return jsQR as unknown as HamJsQr;
}

function docLuu(khoa: string): string {
  try {
    return window.localStorage.getItem(khoa) ?? "";
  } catch {
    return "";
  }
}
function ghiLuu(khoa: string, gt: string) {
  try {
    window.localStorage.setItem(khoa, gt);
  } catch {
    /* chế độ riêng tư có thể chặn */
  }
}

export default function QuetQr() {
  const { t } = useNgonNgu();
  const video = useRef<HTMLVideoElement>(null);
  const tepAnh = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const nhip = useRef<number | null>(null);
  const dangXuLy = useRef(false);
  const tamDung = useRef(false);
  const boDoc = useRef<BoDoc | null>(null);
  const maCuoi = useRef<{ ma: string; luc: number }>({ ma: "", luc: 0 });
  const audio = useRef<AudioContext | null>(null);

  const [cam, setCam] = useState<CamTrangThai>({ kieu: "dangMo" });
  const [goiY, setGoiY] = useState<{ tone: "warning" | "info"; chu: string } | null>(null);
  const [bang, setBang] = useState<Bang | null>(null);
  const [cheDo, setCheDo] = useState<CheDo>("IN");
  const [khoId, setKhoId] = useState<string>("");
  const [soLuong, setSoLuong] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [dangGhi, setDangGhi] = useState(false);
  const [loiGhi, setLoiGhi] = useState("");
  // Bước ĐỒNG Ý: bấm Ghi lần đầu chỉ hiện tóm tắt (việc gì, bao nhiêu, kho nào),
  // bấm Đồng ý mới ghi thật. Quét liên tục thì ngón tay đi rất nhanh — một cú
  // Enter sớm hay số gõ dở mà máy tự ghi là sai tồn kho, mà sai tồn thì phải
  // lập phiếu ngược để sửa. Mọi thay đổi trên form đều hủy bước đồng ý.
  const [xacNhan, setXacNhan] = useState(false);
  const [phien, setPhien] = useState<MucPhien[]>([]);
  const [maGo, setMaGo] = useState("");
  const [mayAnh, setMayAnh] = useState<MayAnh[]>([]);
  const [mayAnhDangDung, setMayAnhDangDung] = useState("");
  const [coDen, setCoDen] = useState(false);
  const [denBat, setDenBat] = useState(false);

  // ── Tiếng bíp như máy quét chuyên dụng: người kiểm kê không phải nhìn màn hình ──
  const keu = useCallback((tanSo: number, ms: number) => {
    try {
      const Ctx = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = audio.current ?? (audio.current = new Ctx());
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = tanSo;
      g.gain.value = 0.08;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + ms / 1000);
    } catch {
      /* máy không phát được thì thôi, còn rung và màu */
    }
  }, []);

  const dungCamera = useCallback(() => {
    if (nhip.current !== null) {
      window.clearInterval(nhip.current);
      nhip.current = null;
    }
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setCoDen(false);
    setDenBat(false);
  }, []);

  // ── Phiên quét: nhớ qua tải lại trang, quên khi đóng tab. Khôi phục trong
  // timer mở camera bên dưới (không đọc storage lúc dựng server, không setState
  // thẳng trong effect). ────────────────────────────────────────────────────────
  const themPhien = useCallback((m: Omit<MucPhien, "id" | "luc">) => {
    setPhien((cu) => {
      const moi = [{ ...m, id: Date.now(), luc: new Date().toLocaleTimeString() }, ...cu].slice(0, 50);
      try {
        window.sessionStorage.setItem(KHOA_PHIEN, JSON.stringify(moi));
      } catch {
        /* bỏ qua */
      }
      return moi;
    });
  }, []);

  // ── Mở bảng cho một mã: hỏi server, dựng form với kho và chế độ đã nhớ ───────
  const moBang = useCallback(
    async (ma: string) => {
      tamDung.current = true;
      setLoiGhi("");
      setBang({ kieu: "dangTai", ma });
      try {
        const res = await fetch(`/api/qr/${encodeURIComponent(ma)}`, { cache: "no-store" });
        const du = (await res.json()) as DuLieuMatHang & { error?: string };
        if (!res.ok || du.error) {
          keu(300, 180);
          setBang({ kieu: "loi", thongBao: du.error ?? t("qr.coLoi") });
          return;
        }
        // Kho mặc định: mặt hàng chỉ ở một kho → kho đó; không thì kho vừa dùng
        // lần trước nếu vẫn trong phạm vi; không nữa thì kho đầu tiên.
        const khoNho = docLuu(KHOA_KHO);
        const khoMacDinh =
          du.ton.length === 1
            ? String(du.ton[0].warehouseId)
            : du.khoCuaToi.some((k) => String(k.id) === khoNho)
              ? khoNho
              : String(du.khoCuaToi[0]?.id ?? "");
        setKhoId(khoMacDinh);
        setSoLuong("");
        setGhiChu("");
        setXacNhan(false);
        setBang({ kieu: "san", du });
      } catch {
        keu(300, 180);
        setBang({ kieu: "loi", thongBao: t("qr.coLoi") });
      }
    },
    [keu, t]
  );

  /** Mọi đường đọc (camera, ảnh, gõ tay) đổ về đây. */
  const xuLyMa = useCallback(
    (noiDung: string, boQuaTrung = false) => {
      const ma = docMaTuQr(noiDung);
      if (!ma) {
        keu(300, 180);
        setGoiY({ tone: "warning", chu: t("qr.maKhongHopLe", { noiDung: noiDung.slice(0, 80) }) });
        return;
      }
      const luc = Date.now();
      if (!boQuaTrung && maCuoi.current.ma === ma && luc - maCuoi.current.luc < NGUOI_TRUNG_MS) {
        setGoiY({ tone: "info", chu: t("qr.trungMa", { ma }) });
        return;
      }
      maCuoi.current = { ma, luc };
      setGoiY(null);
      keu(1400, 90);
      try {
        navigator.vibrate?.(60);
      } catch {
        /* không rung được thì thôi */
      }
      void moBang(ma);
    },
    [keu, moBang, t]
  );

  const dongBang = useCallback(() => {
    setBang(null);
    setLoiGhi("");
    setXacNhan(false);
    // Chờ một nhịp rồi mới đọc tiếp: nhãn vừa ghi thường vẫn còn trước ống kính
    // đúng lúc bảng đóng; cộng với cửa 3 giây theo mã ở xuLyMa.
    maCuoi.current = { ...maCuoi.current, luc: Date.now() };
    window.setTimeout(() => {
      tamDung.current = false;
    }, 400);
  }, []);

  // ── Ghi nhập / xuất / điều chỉnh kiểm kê ────────────────────────────────────
  const ghi = useCallback(async () => {
    if (bang?.kieu !== "san") return;
    const { du } = bang;
    const kho = du.khoCuaToi.find((k) => String(k.id) === khoId);
    const so = Number(soLuong.replace(",", "."));
    if (!kho || !Number.isFinite(so) || (cheDo !== "DEM" && !(so > 0)) || (cheDo === "DEM" && so < 0)) {
      setLoiGhi(t("chung.duLieuKhongHopLe"));
      setXacNhan(false);
      keu(300, 180);
      return;
    }
    const m = du.material;
    const tenKho = `${kho.code} — ${kho.name}`;
    let type: "IN" | "OUT";
    let soGhi: number;
    let note = ghiChu.trim();
    if (cheDo === "DEM") {
      const heThong = du.ton.find((d) => d.warehouseId === kho.id)?.quantity ?? 0;
      const chenh = Math.round((so - heThong) * 100) / 100;
      if (chenh === 0) {
        themPhien({ ma: m.code, ten: m.nameVn, tomTat: t("qr.daKhop", { ma: m.code, so: String(so), dvt: m.uom, kho: kho.code }), tone: "info" });
        keu(1000, 60);
        dongBang();
        return;
      }
      type = chenh > 0 ? "IN" : "OUT";
      soGhi = Math.abs(chenh);
      const ghiChuDem = t("qr.ghiChuKiemKe", { dem: String(so), heThong: String(heThong) });
      note = note ? `${ghiChuDem} · ${note}` : ghiChuDem;
    } else {
      type = cheDo;
      soGhi = so;
    }
    setDangGhi(true);
    setLoiGhi("");
    try {
      const fd = new FormData();
      fd.set("materialId", String(m.id));
      fd.set("warehouseId", String(kho.id));
      fd.set("type", type);
      fd.set("quantity", String(soGhi));
      fd.set("note", note);
      fd.set("returnTo", "/quet");
      const ket = await createInventoryTransaction({ message: "" }, fd);
      if (!ket.success) {
        keu(300, 180);
        setLoiGhi(ket.message || t("qr.coLoi"));
        setXacNhan(false);
        return;
      }
      ghiLuu(KHOA_KHO, String(kho.id));
      ghiLuu(KHOA_CHE_DO, cheDo);
      const viec = cheDo === "DEM" ? t("qr.cheDoDem") : type === "IN" ? t("qr.cheDoNhap") : t("qr.cheDoXuat");
      themPhien({
        ma: m.code,
        ten: m.nameVn,
        tomTat: t("qr.daGhi", { ma: m.code, viec, so: (type === "IN" ? "+" : "−") + String(soGhi), dvt: m.uom, kho: kho.code }),
        tone: type === "IN" ? "success" : "warning",
      });
      keu(1000, 60);
      dongBang();
      void tenKho;
    } catch (e) {
      keu(300, 180);
      setLoiGhi(t("qr.khongGhiDuoc", { loi: String((e as Error)?.message ?? e) }));
    } finally {
      setDangGhi(false);
    }
  }, [bang, cheDo, dongBang, ghiChu, keu, khoId, soLuong, t, themPhien]);

  // Bảng vừa mở: đưa con trỏ vào ô số lượng để gõ ngay, không phải chạm thêm.
  useEffect(() => {
    if (bang?.kieu === "san") {
      const id = window.setTimeout(() => document.getElementById("quet-so-luong")?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [bang]);

  // ── Đường 1: camera trực tiếp ─────────────────────────────────────────────
  const batDauQuet = useCallback(
    async (deviceId?: string) => {
      if (typeof window === "undefined") return;
      // Trình duyệt chỉ mở camera trên https/localhost. Địa chỉ http nội bộ trên
      // tàu thì không có cách nào — chỉ còn chụp ảnh nhãn (đường 2) và gõ tay.
      if (!window.isSecureContext) {
        setCam({ kieu: "loi", khoa: "camera_canHttps" });
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCam({ kieu: "loi", khoa: "camera_khongCo" });
        return;
      }
      dungCamera();
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        stream.current = s;
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        await v.play();
        const track = s.getVideoTracks()[0];
        try {
          const kha = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
          setCoDen(Boolean(kha.torch));
        } catch {
          setCoDen(false);
        }
        try {
          const ds = (await navigator.mediaDevices.enumerateDevices())
            .filter((d) => d.kind === "videoinput")
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
          setMayAnh(ds);
          setMayAnhDangDung(track?.getSettings().deviceId ?? deviceId ?? "");
        } catch {
          /* không liệt kê được thì thôi */
        }
      } catch (e) {
        const ten = (e as { name?: string })?.name ?? "";
        if (ten === "NotAllowedError" || ten === "SecurityError") setCam({ kieu: "loi", khoa: "camera_biTuChoi" });
        else if (ten === "NotFoundError" || ten === "OverconstrainedError") setCam({ kieu: "loi", khoa: "camera_khongCo" });
        else setCam({ kieu: "loi", khoa: "camera_loiKhac", loi: String((e as Error)?.message ?? e) });
        return;
      }

      if (!boDoc.current) {
        let dungTrinhDuyet = false;
        if (window.BarcodeDetector) {
          try {
            const ds = (await (window.BarcodeDetector as unknown as { getSupportedFormats?: () => Promise<string[]> }).getSupportedFormats?.()) ?? ["qr_code"];
            dungTrinhDuyet = ds.includes("qr_code");
          } catch {
            dungTrinhDuyet = false;
          }
        }
        if (dungTrinhDuyet && window.BarcodeDetector) {
          boDoc.current = { kieu: "trinhDuyet", detector: new window.BarcodeDetector({ formats: ["qr_code"] }) };
        } else {
          boDoc.current = { kieu: "jsqr", jsQR: await taiJsQr(), canvas: document.createElement("canvas") };
        }
      }

      setCam({ kieu: "dangQuet" });
      const nhipMs = boDoc.current.kieu === "trinhDuyet" ? 120 : 200;
      nhip.current = window.setInterval(async () => {
        const v = video.current;
        const b = boDoc.current;
        if (!v || !b || dangXuLy.current || tamDung.current || v.readyState < 2) return;
        dangXuLy.current = true;
        try {
          let noiDung: string | null = null;
          if (b.kieu === "trinhDuyet") {
            const ket = await b.detector.detect(v);
            noiDung = ket[0]?.rawValue ?? null;
          } else {
            // Thu nhỏ khung về 640 px ngang: jsQR thuần JS, khung 1280 px trên
            // điện thoại cũ mất ~150 ms mỗi lần; 640 px còn ~40 ms mà nhãn vẫn đọc được.
            const tyLe = Math.min(1, 640 / (v.videoWidth || 640));
            const w = Math.round((v.videoWidth || 640) * tyLe);
            const h = Math.round((v.videoHeight || 480) * tyLe);
            b.canvas.width = w;
            b.canvas.height = h;
            const ctx = b.canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) return;
            ctx.drawImage(v, 0, 0, w, h);
            const anh = ctx.getImageData(0, 0, w, h);
            noiDung = b.jsQR(anh.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
          }
          if (noiDung) xuLyMa(noiDung);
        } catch {
          /* một khung hỏng thì bỏ qua */
        } finally {
          dangXuLy.current = false;
        }
      }, nhipMs);
    },
    [dungCamera, xuLyMa]
  );

  // ── Đường 2: chụp ảnh nhãn bằng ứng dụng Camera có sẵn ────────────────────
  const docTuAnh = useCallback(
    async (tep: File) => {
      setCam((c) => (c.kieu === "loi" ? c : { kieu: "dangDocAnh" }));
      tamDung.current = true;
      const jsQR = await taiJsQr();
      const url = URL.createObjectURL(tep);
      try {
        const anh = await new Promise<HTMLImageElement>((ok, hong) => {
          const i = new Image();
          i.onload = () => ok(i);
          i.onerror = () => hong(new Error("anh"));
          i.src = url;
        });
        let noiDung: string | null = null;
        for (const rongToiDa of [1000, 1600, 640]) {
          const tyLe = Math.min(1, rongToiDa / anh.naturalWidth);
          const w = Math.max(1, Math.round(anh.naturalWidth * tyLe));
          const h = Math.max(1, Math.round(anh.naturalHeight * tyLe));
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) break;
          ctx.drawImage(anh, 0, 0, w, h);
          const d = ctx.getImageData(0, 0, w, h);
          noiDung = jsQR(d.data, w, h, { inversionAttempts: "attemptBoth" })?.data ?? null;
          if (noiDung) break;
        }
        if (noiDung) xuLyMa(noiDung, true);
        else {
          keu(300, 180);
          setGoiY({ tone: "warning", chu: t("qr.anhKhongCoMa") });
          tamDung.current = false;
        }
      } catch {
        setGoiY({ tone: "warning", chu: t("qr.anhKhongCoMa") });
        tamDung.current = false;
      } finally {
        URL.revokeObjectURL(url);
        setCam((c) => (c.kieu === "dangDocAnh" ? (stream.current ? { kieu: "dangQuet" } : { kieu: "tat" }) : c));
      }
    },
    [keu, t, xuLyMa]
  );

  useEffect(() => {
    // Mở camera trong một timer sau khi trang vẽ xong (xem quy tắc
    // react-hooks/set-state-in-effect); hủy timer khi rời trang.
    const id = window.setTimeout(() => {
      try {
        const luu = window.sessionStorage.getItem(KHOA_PHIEN);
        if (luu) setPhien(JSON.parse(luu) as MucPhien[]);
      } catch {
        /* không đọc được thì bắt đầu trống */
      }
      const cd = docLuu(KHOA_CHE_DO);
      if (cd === "IN" || cd === "OUT" || cd === "DEM") setCheDo(cd);
      void batDauQuet(docLuu(KHOA_CAMERA_DA_CHON) || undefined);
    }, 0);
    return () => {
      window.clearTimeout(id);
      dungCamera();
    };
  }, [batDauQuet, dungCamera]);

  const doiCamera = (deviceId: string) => {
    setMayAnhDangDung(deviceId);
    ghiLuu(KHOA_CAMERA_DA_CHON, deviceId);
    setCam({ kieu: "dangMo" });
    void batDauQuet(deviceId);
  };

  const batDen = async () => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !denBat } as MediaTrackConstraintSet] });
      setDenBat(!denBat);
    } catch {
      setCoDen(false);
    }
  };

  const dangChay = cam.kieu === "dangQuet" || cam.kieu === "dangMo";
  const cameraHong = cam.kieu === "loi";
  const bangMo = bang !== null;

  return (
    <div className="space-y-4">
      <input
        ref={tepAnh}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void docTuAnh(f);
        }}
      />

      {/* Khung hình: đầy đủ khi đang quét, thu thành dải mỏng khi bảng ghi mở để
          form nằm trọn trong màn hình điện thoại — camera vẫn chạy bên dưới. */}
      {!cameraHong && (
        <div className={`relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black transition-all ${bangMo ? "h-16" : ""}`}>
          <video ref={video} className={`block w-full object-cover ${bangMo ? "h-16" : "aspect-[4/3]"}`} muted playsInline autoPlay />
          {dangChay && !bangMo && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-[60%] max-w-[320px] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}
          {(cam.kieu === "tat" || cam.kieu === "dangDocAnh") && !bangMo && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              <CameraOff className="size-10" />
            </div>
          )}
          {coDen && dangChay && (
            <button
              type="button"
              onClick={() => void batDen()}
              aria-label={t("qr.nutDen")}
              aria-pressed={denBat}
              className={`absolute top-2 right-2 rounded-full p-2 ${denBat ? "bg-amber-400 text-black" : "bg-black/50 text-white"}`}
            >
              <Flashlight className="size-5" />
            </button>
          )}
        </div>
      )}

      {/* ── Bảng ghi ngay tại chỗ ──────────────────────────────────────────── */}
      {bang?.kieu === "dangTai" && <Notice tone="info">{t("qr.dangTaiMatHang", { ma: bang.ma })}</Notice>}
      {bang?.kieu === "loi" && (
        <div className="space-y-3">
          <Notice tone="danger">{bang.thongBao}</Notice>
          <Button type="button" variant="primary" onClick={dongBang} icon={<RotateCcw className="size-4" />}>
            {t("qr.nutBoQuaQuetTiep")}
          </Button>
        </div>
      )}
      {bang?.kieu === "san" && (
        <div className="surface rounded-xl border p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-lg tracking-wide">{bang.du.material.code}</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{bang.du.material.nameVn}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {[
                  bang.du.material.materialType === "SPARE" ? bang.du.material.partNumber : bang.du.material.impa,
                  `${t("chung.donVi")}: ${bang.du.material.uom}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button type="button" onClick={dongBang} aria-label={t("chung.dong")} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]">
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase">{t("qr.tonTheoKho")}</p>
            {bang.du.ton.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t("qr.chuaCoTonNgan")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {bang.du.ton.map((d) => (
                  <Badge key={d.warehouseId} tone={d.quantity - d.reserved <= bang.du.material.minStock ? "danger" : "success"} dot>
                    {d.warehouseCode}: {d.quantity} {bang.du.material.uom}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {!bang.du.canTransact ? (
            <Notice tone="info" className="mt-3">
              {t("qr.khongCoQuyenGhi")}
            </Notice>
          ) : bang.du.khoCuaToi.length === 0 ? (
            <Notice tone="warning" className="mt-3">
              {t("qr.chuaCoKho")}
            </Notice>
          ) : (
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!xacNhan) {
                  setXacNhan(true);
                  window.setTimeout(() => document.getElementById("quet-dong-y")?.focus(), 50);
                  return;
                }
                void ghi();
              }}
            >
              <div className="inline-flex gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1">
                {(["IN", "OUT", "DEM"] as CheDo[]).map((cd) => (
                  <button
                    key={cd}
                    type="button"
                    onClick={() => {
                      setCheDo(cd);
                      setXacNhan(false);
                    }}
                    aria-pressed={cheDo === cd}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${cheDo === cd ? "bg-brand-700 text-white shadow-sm" : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]"}`}
                  >
                    {cd === "IN" ? t("qr.cheDoNhap") : cd === "OUT" ? t("qr.cheDoXuat") : t("qr.cheDoDem")}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">{t("chung.kho")}</span>
                  <Select
                    value={khoId}
                    onChange={(e) => {
                      setKhoId(e.target.value);
                      setXacNhan(false);
                    }}
                    required
                  >
                    {bang.du.khoCuaToi.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.code} - {k.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    {cheDo === "DEM" ? t("qr.soDemThucTe") : t("qr.soLuong")} ({bang.du.material.uom})
                  </span>
                  <Input
                    id="quet-so-luong"
                    type="number"
                    inputMode="decimal"
                    enterKeyHint="done"
                    step="0.01"
                    min={cheDo === "DEM" ? "0" : "0.01"}
                    value={soLuong}
                    onChange={(e) => {
                      setSoLuong(e.target.value);
                      setXacNhan(false);
                    }}
                    className="tabular text-lg"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">{t("chung.ghiChu")}</span>
                  <Input
                    value={ghiChu}
                    onChange={(e) => {
                      setGhiChu(e.target.value);
                      setXacNhan(false);
                    }}
                    placeholder={t("inventory.ghiChuGoiY")}
                  />
                </label>
              </div>
              {cheDo === "DEM" && (
                <ChenhLech
                  heThong={bang.du.ton.find((d) => String(d.warehouseId) === khoId)?.quantity ?? 0}
                  dem={Number(soLuong.replace(",", "."))}
                  dvt={bang.du.material.uom}
                  nhan={{ heThong: t("qr.tonHeThong"), chenh: t("qr.chenhLech"), khop: t("qr.khop") }}
                />
              )}
              {loiGhi && <Notice tone="danger">{loiGhi}</Notice>}
              {xacNhan && (
                <Notice tone="brand">
                  <p className="font-semibold">{t("qr.xacNhanTieuDe")}</p>
                  <p className="mt-0.5 text-base">
                    {t("qr.xacNhanNoiDung", {
                      viec: cheDo === "IN" ? t("qr.cheDoNhap") : cheDo === "OUT" ? t("qr.cheDoXuat") : t("qr.cheDoDem"),
                      so: soLuong.replace(",", "."),
                      dvt: bang.du.material.uom,
                      ma: bang.du.material.code,
                      kho: bang.du.khoCuaToi.find((k) => String(k.id) === khoId)?.code ?? "",
                    })}
                  </p>
                </Notice>
              )}
              <div className="flex flex-wrap gap-2">
                {xacNhan ? (
                  <>
                    <Button id="quet-dong-y" type="submit" variant="primary" loading={dangGhi} icon={<Check className="size-4" />}>
                      {dangGhi ? t("chung.dangXuLy") : t("qr.nutDongY")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setXacNhan(false)} icon={<RotateCcw className="size-4" />}>
                      {t("qr.nutSuaLai")}
                    </Button>
                  </>
                ) : (
                  <Button type="submit" variant="primary" icon={<Check className="size-4" />}>
                    {t("qr.nutGhi")}
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={dongBang} icon={<X className="size-4" />}>
                  {t("qr.nutBoQuaQuetTiep")}
                </Button>
                {khoId && (
                  <Link
                    href={`/inventory/stock-card?material=${bang.du.material.id}&wh=${khoId}`}
                    className="inline-flex items-center gap-1.5 self-center text-sm text-brand-700 hover:underline dark:text-brand-300"
                  >
                    <ArrowLeftRight className="size-4" /> {t("qr.nutMoTheKho")}
                  </Link>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Trạng thái camera / gợi ý ──────────────────────────────────────── */}
      {!bangMo && cam.kieu === "dangMo" && <Notice tone="info">{t("qr.dangMoCamera")}</Notice>}
      {!bangMo && cam.kieu === "dangQuet" && !goiY && (
        <Notice tone="brand">
          <span className="inline-flex items-center gap-2">
            <ScanLine className="size-4" /> {t("qr.dangQuet")}
          </span>
        </Notice>
      )}
      {!bangMo && cam.kieu === "dangDocAnh" && <Notice tone="info">{t("qr.dangDocAnh")}</Notice>}
      {!bangMo && goiY && <Notice tone={goiY.tone}>{goiY.chu}</Notice>}
      {cameraHong && (
        <Notice tone="warning">
          <p>{t(`qr.${cam.khoa}`, cam.loi ? { loi: cam.loi } : undefined)}</p>
          <p className="mt-2 font-medium">{t("qr.chupAnhThayThe")}</p>
        </Notice>
      )}

      {!bangMo && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={cameraHong || cam.kieu === "tat" ? "primary" : "secondary"}
            onClick={() => tepAnh.current?.click()}
            icon={<ImagePlus className="size-4" />}
          >
            {t("qr.chupAnh")}
          </Button>
          {(cam.kieu === "tat" || cameraHong) && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCam({ kieu: "dangMo" });
                void batDauQuet(mayAnhDangDung || undefined);
              }}
              icon={<Camera className="size-4" />}
            >
              {cameraHong ? t("qr.thuMoCameraLai") : t("qr.nutQuetLai")}
            </Button>
          )}
          {dangChay && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                dungCamera();
                setCam({ kieu: "tat" });
              }}
              icon={<CameraOff className="size-4" />}
            >
              {t("qr.nutDungCamera")}
            </Button>
          )}
        </div>
      )}

      {!bangMo && mayAnh.length > 1 && !cameraHong && (
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
            <SwitchCamera className="size-4" /> {t("qr.chonCamera")}
          </span>
          <Select value={mayAnhDangDung} onChange={(e) => doiCamera(e.target.value)} className="max-w-xs">
            {mayAnh.map((m) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label}
              </option>
            ))}
          </Select>
        </label>
      )}

      {!bangMo && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (maGo.trim()) {
              xuLyMa(maGo, true);
              setMaGo("");
            }
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">{t("qr.nhapTay")}</span>
            <Input value={maGo} onChange={(e) => setMaGo(e.target.value)} placeholder={t("qr.nhapTayGoiY")} autoCapitalize="characters" autoCorrect="off" spellCheck={false} className="font-display tracking-wide" />
          </label>
          <Button type="submit" variant="secondary" icon={<Search className="size-4" />}>
            {t("qr.nutMo")}
          </Button>
        </form>
      )}

      {/* ── Danh sách phiên: những gì đã ghi từ lúc mở màn quét ────────────── */}
      <div className="rounded-xl border border-[var(--border-subtle)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">
            <ListChecks className="size-4" /> {t("qr.phienQuet")} {phien.length ? `(${phien.length})` : ""}
          </p>
          {phien.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setPhien([]);
                try {
                  window.sessionStorage.removeItem(KHOA_PHIEN);
                } catch {
                  /* bỏ qua */
                }
              }}
              className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-danger)]"
            >
              <Trash2 className="size-3.5" /> {t("qr.nutXoaPhien")}
            </button>
          )}
        </div>
        {phien.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">{t("qr.phienQuetTrong")}</p>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {phien.map((m) => (
              <li key={m.id} className="flex items-start gap-2 text-sm">
                <span className="tabular shrink-0 text-xs text-[var(--text-muted)]">{m.luc}</span>
                <Badge tone={m.tone} dot className="shrink-0">
                  {m.ma}
                </Badge>
                <span className="min-w-0 text-[var(--text-secondary)]">{m.tomTat}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!bangMo && <p className="text-xs text-[var(--text-muted)]">{t("qr.meoCameraDienThoai")}</p>}
    </div>
  );
}

/** Dòng so sánh cho chế độ đếm: hệ thống bao nhiêu, đếm bao nhiêu, chênh bao nhiêu. */
function ChenhLech({ heThong, dem, dvt, nhan }: { heThong: number; dem: number; dvt: string; nhan: { heThong: string; chenh: string; khop: string } }) {
  const co = Number.isFinite(dem);
  const chenh = co ? Math.round((dem - heThong) * 100) / 100 : 0;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
      <span>
        {nhan.heThong}: <b className="tabular">{heThong}</b> {dvt}
      </span>
      {co && (
        <span className={chenh === 0 ? "text-[var(--text-success)]" : chenh > 0 ? "text-[var(--text-info)]" : "text-[var(--text-danger)]"}>
          {chenh === 0 ? nhan.khop : `${nhan.chenh}: ${chenh > 0 ? "+" : ""}${chenh} ${dvt}`}
        </span>
      )}
    </div>
  );
}
