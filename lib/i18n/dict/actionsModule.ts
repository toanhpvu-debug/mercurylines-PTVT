import { tuDien } from "./_kieu";

/**
 * Thông báo trả về từ các server action NGOÀI app/actions.ts (paint-actions,
 * consumable-actions, quyen-actions) và từ API route. Tách khỏi `actions` để
 * hai người dịch song song không cùng sửa một file.
 */
export const actionsModule = tuDien({}, {});
