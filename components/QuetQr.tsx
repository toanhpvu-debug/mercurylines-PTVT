"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, ImagePlus, RotateCcw, ScanLine, Search, SwitchCamera } from "lucide-react";
import { docMaTuQr, duongDanQr } from "@/lib/qr";
import { Button, Input, Notice, Select } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

/**
 * Màn quét mã QR bằng camera của điện thoại / máy tính.
 *
 * BA đường đọc, để trên máy nào, địa chỉ nào cũng quét được:
 *
 *   1. Camera trực tiếp trong trang — nhanh nhất, giơ nhãn vào khung là xong.
 *      Giải mã bằng BarcodeDetector của trình duyệt (Chrome/Edge trên Android và
 *      máy tính) hoặc jsQR (thư viện thuần JS trong bản cài) cho iPhone/Safari.
 *      Trình duyệt CHỈ cho mở camera kiểu này trên địa chỉ https hoặc localhost.
 *
 *   2. Chụp ảnh nhãn — nút mở ứng dụng Camera có sẵn của điện thoại qua
 *      <input type="file" capture>, chụp một tấm, trang tự đọc mã trong ảnh bằng
 *      jsQR. Không đòi https, không hộp thoại xin quyền, chạy cả khi mở app qua
 *      địa chỉ http nội bộ trên tàu. Chậm hơn đường 1 một cú bấm, nhưng KHÔNG BAO
 *      GIỜ bị chặn — nên khi đường 1 mở không được, đây là nút chính.
 *
 *   3. Gõ mã tay — nhãn mờ, rách, hoặc chỉ biết mã.
 *
 * Cả ba chạy hoàn toàn trên máy: app trên tàu không có mạng vẫn quét được.
 * Nhiều điện thoại có 2–3 camera sau (rộng, thường, macro); trình duyệt hay
 * chọn nhầm ống rộng khiến mã nhỏ không nét — nên sau khi mở được camera thì
 * cho chọn camera, và nhớ lựa chọn cho lần sau.
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

type TrangThai =
  | { kieu: "dangMo" }
  | { kieu: "dangQuet" }
  | { kieu: "docDuoc"; ma: string }
  | { kieu: "maLa"; noiDung: string }
  | { kieu: "dangDocAnh" }
  | { kieu: "anhKhongCoMa" }
  | { kieu: "loi"; khoa: "camera_khongCo" | "camera_biTuChoi" | "camera_canHttps" | "camera_loiKhac"; loi?: string }
  | { kieu: "tat" };

type MayAnh = { deviceId: string; label: string };

const KHOA_CAMERA_DA_CHON = "mercury.quet.camera";

declare global {
  interface Window {
    BarcodeDetector?: new (o: { formats: string[] }) => {
      detect(v: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
    } & { getSupportedFormats?: () => Promise<string[]> };
  }
}

async function taiJsQr(): Promise<HamJsQr> {
  const { default: jsQR } = await import("jsqr");
  return jsQR as unknown as HamJsQr;
}

export default function QuetQr() {
  const { t } = useNgonNgu();
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const tepAnh = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const nhip = useRef<number | null>(null);
  const dangXuLy = useRef(false);
  const boDoc = useRef<BoDoc | null>(null);
  const [trangThai, setTrangThai] = useState<TrangThai>({ kieu: "dangMo" });
  const [maGo, setMaGo] = useState("");
  const [mayAnh, setMayAnh] = useState<MayAnh[]>([]);
  const [mayAnhDangDung, setMayAnhDangDung] = useState<string>("");

  const dungCamera = useCallback(() => {
    if (nhip.current !== null) {
      window.clearInterval(nhip.current);
      nhip.current = null;
    }
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  const moTrang = useCallback(
    (noiDung: string) => {
      const ma = docMaTuQr(noiDung);
      if (!ma) {
        setTrangThai({ kieu: "maLa", noiDung: noiDung.slice(0, 80) });
        return false;
      }
      setTrangThai({ kieu: "docDuoc", ma });
      try {
        navigator.vibrate?.(80);
      } catch {
        /* không phải máy nào cũng rung được */
      }
      dungCamera();
      router.push(duongDanQr(ma));
      return true;
    },
    [dungCamera, router]
  );

  /** Đường 1: camera trực tiếp. `deviceId` trống = để trình duyệt chọn camera sau. */
  const batDauQuet = useCallback(
    async (deviceId?: string) => {
      if (typeof window === "undefined") return;
      if (!window.isSecureContext) {
        setTrangThai({ kieu: "loi", khoa: "camera_canHttps" });
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setTrangThai({ kieu: "loi", khoa: "camera_khongCo" });
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
        // Sau khi có quyền, trình duyệt mới chịu cho biết tên các camera.
        try {
          const ds = (await navigator.mediaDevices.enumerateDevices())
            .filter((d) => d.kind === "videoinput")
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
          setMayAnh(ds);
          const dangDung = s.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId ?? "";
          setMayAnhDangDung(dangDung);
        } catch {
          /* không liệt kê được thì thôi, camera vẫn đang chạy */
        }
      } catch (e) {
        const ten = (e as { name?: string })?.name ?? "";
        if (ten === "NotAllowedError" || ten === "SecurityError") setTrangThai({ kieu: "loi", khoa: "camera_biTuChoi" });
        else if (ten === "NotFoundError" || ten === "OverconstrainedError") setTrangThai({ kieu: "loi", khoa: "camera_khongCo" });
        else setTrangThai({ kieu: "loi", khoa: "camera_loiKhac", loi: String((e as Error)?.message ?? e) });
        return;
      }

      // Chọn bộ đọc một lần, giữ lại cho các lần quét lại.
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

      setTrangThai({ kieu: "dangQuet" });
      nhip.current = window.setInterval(async () => {
        const v = video.current;
        const b = boDoc.current;
        if (!v || !b || dangXuLy.current || v.readyState < 2) return;
        dangXuLy.current = true;
        try {
          let noiDung: string | null = null;
          if (b.kieu === "trinhDuyet") {
            const ket = await b.detector.detect(v);
            noiDung = ket[0]?.rawValue ?? null;
          } else {
            // Thu nhỏ khung hình về tối đa 640 px ngang: jsQR chạy thuần JS, khung
            // 1280 px trên điện thoại cũ mất ~150 ms mỗi lần, thu nhỏ còn ~40 ms mà
            // mã in cỡ nhãn vẫn đọc được.
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
          if (noiDung) {
            if (nhip.current !== null) {
              window.clearInterval(nhip.current);
              nhip.current = null;
            }
            moTrang(noiDung);
          }
        } catch {
          /* một khung hỏng thì bỏ qua, khung sau đọc tiếp */
        } finally {
          dangXuLy.current = false;
        }
      }, 150);
    },
    [dungCamera, moTrang]
  );

  /** Đường 2: đọc mã trong một tấm ảnh vừa chụp (hoặc chọn từ máy). */
  const docTuAnh = useCallback(
    async (tep: File) => {
      dungCamera();
      setTrangThai({ kieu: "dangDocAnh" });
      const jsQR = await taiJsQr();
      const url = URL.createObjectURL(tep);
      try {
        const anh = await new Promise<HTMLImageElement>((ok, hong) => {
          const i = new Image();
          i.onload = () => ok(i);
          i.onerror = () => hong(new Error("anh"));
          i.src = url;
        });
        // Ảnh chụp 12 MP mà đưa nguyên vào thì vừa chậm vừa dễ trượt (mã nhỏ trên
        // nền lớn). Thử ba cỡ: vừa (đa số nhãn chụp cách một gang tay), lớn (nhãn
        // nhỏ hoặc chụp xa), nhỏ (nhãn chụp rất gần, ô mã quá to).
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
          const ket = jsQR(d.data, w, h, { inversionAttempts: "attemptBoth" });
          if (ket?.data) {
            moTrang(ket.data);
            return;
          }
        }
        setTrangThai({ kieu: "anhKhongCoMa" });
      } catch {
        setTrangThai({ kieu: "anhKhongCoMa" });
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [dungCamera, moTrang]
  );

  useEffect(() => {
    // Mở camera SAU khi trang đã vẽ xong, trong một timer, chứ không gọi thẳng
    // trong effect: xin quyền camera là việc nặng và bật hộp thoại của trình
    // duyệt, để nó chen vào lượt dựng đầu tiên thì khung hình và chữ hướng dẫn
    // hiện muộn hơn hộp thoại. Cũng là điều quy tắc react-hooks/set-state-in-effect
    // đòi hỏi. Hủy timer khi rời trang để không mở camera cho một màn đã đóng.
    const id = window.setTimeout(() => {
      let daChon = "";
      try {
        daChon = window.localStorage.getItem(KHOA_CAMERA_DA_CHON) ?? "";
      } catch {
        /* chế độ riêng tư có thể chặn localStorage */
      }
      void batDauQuet(daChon || undefined);
    }, 0);
    return () => {
      window.clearTimeout(id);
      dungCamera();
    };
  }, [batDauQuet, dungCamera]);

  const doiCamera = (deviceId: string) => {
    setMayAnhDangDung(deviceId);
    try {
      window.localStorage.setItem(KHOA_CAMERA_DA_CHON, deviceId);
    } catch {
      /* không lưu được thì lần sau chọn lại */
    }
    setTrangThai({ kieu: "dangMo" });
    void batDauQuet(deviceId);
  };

  const dangChay = trangThai.kieu === "dangQuet" || trangThai.kieu === "dangMo";
  const cameraHong = trangThai.kieu === "loi";

  return (
    <div className="space-y-4">
      {/* Ô chọn tệp ẩn: capture="environment" bảo điện thoại mở thẳng camera sau. */}
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

      {!cameraHong && (
        <div className="relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black">
          <video ref={video} className="block aspect-[4/3] w-full object-cover" muted playsInline autoPlay />
          {dangChay && (
            // Khung ngắm: một hình vuông giữa màn, để người quét biết đưa nhãn vào đâu.
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="size-[60%] max-w-[320px] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}
          {(trangThai.kieu === "tat" || trangThai.kieu === "dangDocAnh") && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70">
              <CameraOff className="size-10" />
            </div>
          )}
        </div>
      )}

      {trangThai.kieu === "dangMo" && <Notice tone="info">{t("qr.dangMoCamera")}</Notice>}
      {trangThai.kieu === "dangQuet" && (
        <Notice tone="brand">
          <span className="inline-flex items-center gap-2">
            <ScanLine className="size-4" /> {t("qr.dangQuet")}
          </span>
        </Notice>
      )}
      {trangThai.kieu === "docDuoc" && <Notice tone="success">{t("qr.docDuoc", { ma: trangThai.ma })}</Notice>}
      {trangThai.kieu === "maLa" && <Notice tone="warning">{t("qr.maKhongHopLe", { noiDung: trangThai.noiDung })}</Notice>}
      {trangThai.kieu === "dangDocAnh" && <Notice tone="info">{t("qr.dangDocAnh")}</Notice>}
      {trangThai.kieu === "anhKhongCoMa" && <Notice tone="warning">{t("qr.anhKhongCoMa")}</Notice>}
      {cameraHong && (
        <Notice tone="warning">
          <p>{t(`qr.${trangThai.khoa}`, trangThai.loi ? { loi: trangThai.loi } : undefined)}</p>
          <p className="mt-2 font-medium">{t("qr.chupAnhThayThe")}</p>
        </Notice>
      )}

      {/* Nút chụp ảnh: là nút CHÍNH khi camera trực tiếp không mở được, nút phụ khi đang quét. */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={cameraHong || trangThai.kieu === "tat" || trangThai.kieu === "anhKhongCoMa" ? "primary" : "secondary"}
          onClick={() => tepAnh.current?.click()}
          icon={<ImagePlus className="size-4" />}
        >
          {t("qr.chupAnh")}
        </Button>
        {(trangThai.kieu === "maLa" || trangThai.kieu === "tat" || trangThai.kieu === "anhKhongCoMa" || cameraHong) && (
          <Button
            type="button"
            variant={cameraHong ? "secondary" : "primary"}
            onClick={() => {
              setTrangThai({ kieu: "dangMo" });
              void batDauQuet(mayAnhDangDung || undefined);
            }}
            icon={cameraHong ? <Camera className="size-4" /> : <RotateCcw className="size-4" />}
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
              setTrangThai({ kieu: "tat" });
            }}
            icon={<CameraOff className="size-4" />}
          >
            {t("qr.nutDungCamera")}
          </Button>
        )}
      </div>

      {mayAnh.length > 1 && !cameraHong && (
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

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (maGo.trim()) moTrang(maGo);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">{t("qr.nhapTay")}</span>
          <Input
            value={maGo}
            onChange={(e) => setMaGo(e.target.value)}
            placeholder={t("qr.nhapTayGoiY")}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="font-display tracking-wide"
          />
        </label>
        <Button type="submit" variant="secondary" icon={<Search className="size-4" />}>
          {t("qr.nutMo")}
        </Button>
      </form>

      <p className="text-xs text-[var(--text-muted)]">{t("qr.meoCameraDienThoai")}</p>
    </div>
  );
}
