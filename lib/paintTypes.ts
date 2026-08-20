// Danh sách loại sơn — hằng số dùng chung cho cả server component lẫn client component.
// KHÔNG để trong app/paint-actions.ts vì file "use server" chỉ được export hàm async.

export const PAINT_TYPES = [
  { value: "PRIMER", label: "Sơn lót (Primer)" },
  { value: "ANTI_CORROSIVE", label: "Chống ăn mòn (Anti-corrosive)" },
  { value: "ANTI_FOULING", label: "Chống hà (Anti-fouling)" },
  { value: "TOPCOAT", label: "Sơn phủ (Topcoat)" },
  { value: "DECK", label: "Sơn boong (Deck paint)" },
  { value: "TANK", label: "Sơn két (Tank coating)" },
  { value: "OTHER", label: "Khác" },
] as const;

export const PAINT_TYPE_VALUES: string[] = PAINT_TYPES.map((t) => t.value);

export const PAINT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PAINT_TYPES.map((t) => [t.value, t.label])
);
