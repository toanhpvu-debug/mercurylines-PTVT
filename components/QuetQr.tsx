"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraOff, RotateCcw, ScanLine, Search } from "lucide-react";
import { docMaTuQr, duongDanQr } from "@/lib/qr";
import { Button, Input, Notice } from "@/components/ui";
import { useNgonNgu } from "@/lib/i18n/client";

/**
 * Màn quét mã QR bằng camera của điện thoại / máy tính.
 *
 * Hai bộ đọc, chọn theo trình duyệt:
 *   - BarcodeDetector của trình duyệt (Chrome/Edge trên Android và máy tính):
 *     đọc thẳng từ khung hình video, nhanh và không tốn thêm mã.
 *   - jsQR (thư viện thuần JS, nằm trong bản cài): cho iPhone/Safari và trình
 *     duyệt không có BarcodeDetector. Chỉ tải khi cần (import động) để trang
 *     không phải gánh thêm ~50 KB ở nơi không dùng tới.
 * Cả hai chạy hoàn toàn trên máy — app trên tàu không có mạng vẫn quét được.
 *
 * Trình duyệt chỉ cho mở camera trên địa chỉ https hoặc localhost. Mở qua địa
 * chỉ http trong mạng nội bộ tàu thì không có cách nào bật camera từ trang web
 * — lúc đó bảo người dùng quét bằng ứng dụng Camera có sẵn: nhãn ghi địa chỉ
 * trang nên quét là mở, không cần màn này.
 */

type BoDoc =
  | { kieu: "trinhDuyet"; detector: { detect(v: HTMLVideoElement): Promise<Array<{ rawValue: string }>> } }
  | {
      kieu: "jsqr";
      jsQR: (data: Uint8ClampedArray, w: number, h: number, o?: { inversionAttempts: "dontInvert" }) => { data: string } | null;
      canvas: HTMLCanvasElement;
    };

type TrangThai =
  | { kieu: "dangMo" }
  | { kieu: "dangQuet" }
  | { kieu: "docDuoc"; ma: string }
  | { kieu: "maLa"; noiDung: string }
  | { kieu: "loi"; khoa: "camera_khongCo" | "camera_biTuChoi" | "camera_canHttps" | "camera_loiKhac"; loi?: string }
  | { kieu: "tat" };

declare global {
  interface Window {
    BarcodeDetector?: new (o: { formats: string[] }) => {
      detect(v: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
    } & { getSupportedFormats?: () => Promise<string[]> };
  }
}

export default function QuetQr() {
  const { t } = useNgonNgu();
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const nhip = useRef<number | null>(null);
  const dangXuLy = useRef(false);
  const boDoc = useRef<BoDoc | null>(null);
  const [trangThai, setTrangThai] = useState<TrangThai>({ kieu: "dangMo" });
  const [maGo, setMaGo] = useState("");

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

  const batDauQuet = useCallback(async () => {
    // Trạng thái khởi tạo đã là "dangMo" nên không đặt lại ở đây; nút Quét lại
    // tự đặt trước khi gọi.
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setTrangThai({ kieu: "loi", khoa: "camera_canHttps" });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setTrangThai({ kieu: "loi", khoa: "camera_khongCo" });
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      stream.current = s;
      const v = video.current;
      if (!v) return;
      v.srcObject = s;
      await v.play();
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
        const { default: jsQR } = await import("jsqr");
        boDoc.current = { kieu: "jsqr", jsQR, canvas: document.createElement("canvas") };
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
  }, [moTrang]);

  useEffect(() => {
    // Mở camera SAU khi trang đã vẽ xong, trong một timer, chứ không gọi thẳng
    // trong effect: xin quyền camera là việc nặng và bật hộp thoại của trình
    // duyệt, để nó chen vào lượt dựng đầu tiên thì khung hình và chữ hướng dẫn
    // hiện muộn hơn hộp thoại. Cũng là điều quy tắc react-hooks/set-state-in-effect
    // đòi hỏi. Hủy timer khi rời trang để không mở camera cho một màn đã đóng.
    const id = window.setTimeout(() => {
      void batDauQuet();
    }, 0);
    return () => {
      window.clearTimeout(id);
      dungCamera();
    };
  }, [batDauQuet, dungCamera]);

  const dangChay = trangThai.kieu === "dangQuet" || trangThai.kieu === "dangMo";

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black">
        <video ref={video} className="block aspect-[4/3] w-full object-cover" muted playsInline autoPlay />
        {dangChay && (
          // Khung ngắm: một hình vuông giữa màn, để người quét biết đưa nhãn vào đâu.
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="size-[60%] max-w-[320px] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {trangThai.kieu === "tat" && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            <CameraOff className="size-10" />
          </div>
        )}
      </div>

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
      {trangThai.kieu === "loi" && (
        <Notice tone="danger">{t(`qr.${trangThai.khoa}`, trangThai.loi ? { loi: trangThai.loi } : undefined)}</Notice>
      )}

      <div className="flex flex-wrap gap-2">
        {(trangThai.kieu === "maLa" || trangThai.kieu === "tat" || trangThai.kieu === "loi") && (
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setTrangThai({ kieu: "dangMo" });
              batDauQuet();
            }}
            icon={<RotateCcw className="size-4" />}
          >
            {t("qr.nutQuetLai")}
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
