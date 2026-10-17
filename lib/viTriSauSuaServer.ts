import "server-only";

import { prisma } from "@/lib/prisma";
import { nhomCuaVatTu } from "@/lib/phanNhomBanChat";
import { chucDanhChiuTrachNhiem } from "@/lib/chucDanhChiuTrachNhiem";
import { DEPARTMENTS } from "@/lib/departments";
import type { ViTriSauSua } from "@/lib/viTriSauSua";

/**
 * Chỗ MỚI của các mặt hàng vừa sửa — đọc lại từ database và xếp bằng ĐÚNG hai hàm trang Danh mục
 * dùng (nhomCuaVatTu, chucDanhChiuTrachNhiem), nên trang đi theo tới đâu là hàng nằm đúng ở đó.
 * Sửa hàng loạt: lấy nhóm có nhiều dòng nhất (hòa thì theo thứ tự mục của bảng); dòng của nhóm đó
 * đứng đầu `ids` (dòng đầu là chỗ cuộn tới), người giữ là của dòng đầu.
 */
export async function viTriSauSua(ids: number[]): Promise<ViTriSauSua | undefined> {
  const ms = await prisma.material.findMany({ where: { id: { in: ids } }, include: { category: true } });
  if (!ms.length) return undefined;
  const theoNhom = new Map<string, { id: number; chucDanh: string | null }[]>();
  for (const id of ids) {
    const m = ms.find((x) => x.id === id);
    if (!m) continue;
    const x = { ...m, categoryName: m.category?.name ?? null, categoryCode: m.category?.code ?? null };
    const nhom = nhomCuaVatTu(x).nhom;
    const ds = theoNhom.get(nhom) ?? [];
    ds.push({ id, chucDanh: chucDanhChiuTrachNhiem(x)?.chucDanh ?? null });
    theoNhom.set(nhom, ds);
  }
  const thuTu = (k: string) => DEPARTMENTS.findIndex((d) => d.key === k);
  const [nhom, ds] = [...theoNhom].sort((a, b) => b[1].length - a[1].length || thuTu(a[0]) - thuTu(b[0]))[0];
  const dau = new Set(ds.map((x) => x.id));
  return { ids: [...ds.map((x) => x.id), ...ids.filter((id) => !dau.has(id) && ms.some((m) => m.id === id))], nhom, chucDanh: ds[0].chucDanh };
}
