/**
 * Ghép tên lớp CSS, bỏ qua giá trị rỗng / false / null.
 *
 * Thay cho gói `clsx`: cả app chỉ cần đúng việc này, thêm một gói phụ thuộc
 * cho sáu dòng mã là không đáng. Không gộp lớp Tailwind trùng nhau (kiểu
 * tailwind-merge) — nơi gọi tự chịu trách nhiệm không truyền hai lớp mâu thuẫn.
 */
export function cn(...phan: (string | false | null | undefined | 0)[]): string {
  return phan.filter(Boolean).join(" ");
}
