import { LogoLockup } from "@/components/MercuryLogo";

/**
 * Ô logo ở góc trên trái các chứng từ in theo biểu mẫu công ty (MLS-11-01,
 * MLS-11-05, MLS-11-13) — dựng đúng như ô trái của header trong tệp Word mẫu:
 * logo Mercury Lines phía trên, dòng "MERCURY LINES / COMPANY LIMITED" nhỏ và
 * đậm phía dưới.
 *
 * Dùng bản vector chính chủ (components/MercuryLogo.tsx) thay vì ảnh PNG 138×42
 * lấy từ tệp Word: cùng một logo, nhưng in ra sắc nét ở mọi cỡ. Lớp
 * `logo-bieu-mau` được globals.css ghim màu navy trong .print-area — chứng từ
 * luôn là tờ giấy trắng, kể cả khi màn hình đang ở chế độ tối.
 */
export default function LogoBieuMau() {
  return (
    <div className="logo-bieu-mau flex flex-col items-center justify-center gap-1 text-center">
      <LogoLockup height={30} className="h-[30px] w-auto" />
      <p className="text-[9px] font-bold uppercase leading-[1.15] tracking-wide">
        Mercury Lines
        <br />
        Company Limited
      </p>
    </div>
  );
}
