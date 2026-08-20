/* eslint-disable @next/next/no-img-element */
// Logo nhận diện Mercury Lines — dùng file gốc của công ty (D:\code1\abc-removebg-preview.png,
// nền trong suốt) đã tách thành 2 bản trong public/: biểu tượng riêng và bản đầy đủ kèm wordmark.

export function MercuryMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo-mercury-mark.png"
      alt="Mercury Lines"
      className={className}
    />
  );
}

export function MercuryLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo-mercury-lines.png"
      alt="Mercury Lines"
      className={`h-12 w-auto ${className ?? ""}`}
    />
  );
}
