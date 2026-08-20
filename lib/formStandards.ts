// Kiểu nhận diện công ty theo biểu mẫu (dùng cho FormDocHeader). Dữ liệu thật nằm ở bảng FormStandard.
export type FormStandardInfo = {
  code: string;
  label: string;
  companyName: string;
  address: string;
  repAddress?: string | null;
  tel?: string | null;
  email?: string | null;
  website?: string | null;
};

// Thông tin công ty KHÔNG hardcode trong mã nguồn (repo công khai) — đọc từ biến môi trường
// theo quy ước FORM_<CODE>_<TRƯỜNG>, ví dụ FORM_MLS_COMPANY_NAME, FORM_NAVIS_TEL (xem .env.example).
// Bỏ trống thì dùng giá trị mẫu bên dưới, sửa lại được ngay trong app tại trang /purchasing/forms.
// File này chỉ được dùng phía server (lib/formStandardsDb.ts, prisma/seed.ts) nên process.env luôn có.
function env(code: string, field: string): string | undefined {
  const v = process.env[`FORM_${code}_${field}`];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function standardFromEnv(
  code: string,
  fallback: Omit<FormStandardInfo, "code">
): FormStandardInfo {
  return {
    code,
    label: env(code, "LABEL") ?? fallback.label,
    companyName: env(code, "COMPANY_NAME") ?? fallback.companyName,
    address: env(code, "ADDRESS") ?? fallback.address,
    repAddress: env(code, "REP_ADDRESS") ?? fallback.repAddress ?? null,
    tel: env(code, "TEL") ?? fallback.tel ?? null,
    email: env(code, "EMAIL") ?? fallback.email ?? null,
    website: env(code, "WEBSITE") ?? fallback.website ?? null,
  };
}

// Fallback cuối cùng nếu bảng FormStandard trống hoặc tàu tham chiếu code không tồn tại.
export const DEFAULT_STANDARD: FormStandardInfo = standardFromEnv("MLS", {
  label: "MLS — Biểu mẫu mặc định",
  companyName: "TÊN CÔNG TY QUẢN LÝ TÀU",
  address: "Head office: (địa chỉ trụ sở)",
  repAddress: "Rep Add: (địa chỉ văn phòng đại diện)",
  tel: "(+84) 000 000 0000",
  email: "tech@example.com",
  website: "https://example.com",
});

// Hai chuẩn khởi tạo mặc định (dùng để seed).
export const SEED_STANDARDS: FormStandardInfo[] = [
  DEFAULT_STANDARD,
  standardFromEnv("NAVIS", {
    label: "NAVIS — Biểu mẫu thứ hai",
    companyName: "TÊN CÔNG TY QUẢN LÝ TÀU THỨ HAI",
    address: "Head office: (địa chỉ trụ sở)",
    tel: "(+84) 000 000 0000",
    email: "tech2@example.com",
  }),
];
