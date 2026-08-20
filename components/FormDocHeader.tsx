import type { FormStandardInfo } from "@/lib/formStandards";
import { MercuryMark } from "@/components/MercuryLogo";

// Đầu chứng từ (letterhead) theo biểu mẫu công ty — dùng chung cho PO, RFQ, Service Order.
// Biểu mẫu MLS dùng logo nhận diện Mercury Lines; biểu mẫu khác dùng huy hiệu chữ lồng.
export default function FormDocHeader({
  standard,
  title,
  docNo,
  docDate,
}: {
  standard: FormStandardInfo;
  title: string;
  docNo?: string;
  docDate?: string;
}) {
  const monogram = standard.code.slice(0, 2).toUpperCase() || "—";
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {standard.code === "MLS" ? (
            <MercuryMark className="h-14 w-auto shrink-0" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0c2a5c] to-[#1d4ed8] text-lg font-black tracking-tight text-white">
              {monogram}
            </div>
          )}
          <div>
            <p className="text-lg font-extrabold leading-tight text-[#0a1f44]">
              {standard.companyName}
            </p>
            <p className="text-[11px] leading-snug text-slate-600">
              {standard.address}
            </p>
            {standard.repAddress && (
              <p className="text-[11px] leading-snug text-slate-600">
                {standard.repAddress}
              </p>
            )}
            {(standard.tel || standard.email || standard.website) && (
              <p className="text-[11px] leading-snug text-slate-600">
                {[
                  standard.tel ? `Tel: ${standard.tel}` : null,
                  standard.email ? `Email: ${standard.email}` : null,
                  standard.website ?? null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
            )}
          </div>
        </div>
        {(docNo || docDate) && (
          <div className="shrink-0 text-right text-[11px] text-slate-600">
            {docNo && (
              <p>
                No: <span className="font-semibold text-[#0a1f44]">{docNo}</span>
              </p>
            )}
            {docDate && <p>Date: {docDate}</p>}
          </div>
        )}
      </div>

      {/* Đường kẻ đôi kiểu letterhead */}
      <div className="mt-3 h-[3px] w-full bg-[#0c2a5c]" />
      <div className="mt-[2px] h-px w-full bg-sky-400" />

      <div className="mt-4 text-center">
        <p className="inline-block rounded bg-blue-50 px-8 py-1.5 text-base font-bold uppercase tracking-[0.35em] text-[#0a1f44]">
          {title}
        </p>
      </div>
    </div>
  );
}
