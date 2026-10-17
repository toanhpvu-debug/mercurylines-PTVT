/**
 * Áp luật nhập mới (lib/materialImportApply.ts) cho những mặt hàng ĐÃ được thêm từ file kiểm kê
 * trước khi bộ nhập hiểu được hai manh mối sau:
 *
 *   1. Ô "Nhóm" ghi MÃ BỘ PHẬN ("E", "E1"…"E10" — lib/maVatTu.ts boPhanTuMaNhom): đó là bộ phận,
 *      không phải tên nhóm hàng.
 *   2. Tên sheet / tên file ghi CHỨC DANH người giữ ("VẬT TƯ MAU HỎNG 4E", "… BOILLER 4E.xlsx"
 *      — chucDanhTrongTen): hàng của chức danh đó, thuộc bộ phận của chức danh đó.
 *
 * Lần kiểm kê 16/10/2026 của M.ODYSSEY (file "MLS-11-06 … BOILLER 4E", ô Bộ phận "Materials of
 * 4E") thêm 80 mặt hàng với nhóm tên trơn "E" cùng 19 phụ tùng BWMS / OWS / Sewage không ghi
 * nhóm. App không nhận ra hàng của Máy tư nên xếp cả 99 vào Boong: mã D-IMPA-07xx / 08xx, người
 * giữ suy ra Thủy thủ trưởng, cột Nhóm hiện "E".
 *
 * Với mỗi mặt hàng thuộc nhóm tên là mã bộ phận, hoặc được thêm mới từ một dòng kiểm kê có
 * manh mối trên:
 *   - bộ phận: mã bộ phận ở ô Nhóm → bộ phận của chức danh trong tên sheet / file;
 *   - mã đổi sang khuôn của bộ phận ấy (E-IMPA-####) nếu đang mang chữ bộ phận khác — cấp số như
 *     bộ nhập file (sttTheoNhom), theo tên A→Z;
 *   - người giữ: chức danh trong tên sheet / file, chỉ khi cột responsibleRank còn trống;
 *   - bỏ nhóm mã bộ phận (mặt hàng không còn nhóm); nhóm không còn ai dùng thì xóa.
 * Tồn kho, giao dịch, lịch sử kiểm kê gắn theo id mặt hàng nên giữ nguyên.
 *
 * Chạy:
 *   sua-nhom-ma-bo-phan.cmd            → chỉ LIỆT KÊ, không sửa gì
 *   sua-nhom-ma-bo-phan.cmd --dong-y   → sửa thật (một giao dịch, ghi nhật ký)
 */
import { prisma } from "@/lib/prisma";
import { ghiNhatKy } from "@/lib/audit";
import { docDongJson } from "@/lib/kiemKe";
import {
  BO_PHAN,
  CHUC_DANH,
  boPhanTuMaNhom,
  chucDanhThuocBoPhan,
  chucDanhTrongTen,
  doanLoai,
  sinhMaNgan,
  sttTheoNhom,
  type BoPhan,
} from "@/lib/maVatTu";

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const soSanh = new Intl.Collator("vi").compare;
/** Mặt hàng tạo lúc áp dụng kiểm kê: trong khoảng từ lúc tải file tới vài phút sau lúc áp dụng. */
const TRE_AP_DUNG_MS = 15 * 60_000;

type Nguon = { tep: string; sheet: string | null; nhom: string | null };
type Sua = {
  id: number;
  ten: string;
  cu: string;
  moi: string;
  boPhanCu: string | null;
  boPhan: BoPhan;
  rankCu: string | null;
  rank: string | null;
  nhomCu: string | null;
  boNhom: boolean;
  nguon: string;
};

async function main() {
  const thatSu = process.argv.includes("--dong-y");
  console.log("=== ÁP LUẬT NHẬP MỚI CHO HÀNG ĐÃ THÊM TỪ KIỂM KÊ (nhóm là mã bộ phận, chức danh trong tên) ===");
  console.log(thatSu ? "CHẾ ĐỘ: SỬA THẬT" : "CHẾ ĐỘ: chỉ liệt kê, không sửa gì");

  // Dòng "thêm mới" của các lần kiểm kê đã áp dụng — nguồn của mặt hàng do chúng tạo ra.
  const kiemKe = await prisma.kiemKeTep.findMany({
    where: { trangThai: "DA_AP_DUNG" },
    select: { fileName: true, dong: true, createdAt: true, apDungLuc: true },
    orderBy: { id: "asc" },
  });
  const nguonTheoTen = new Map<string, { tu: number; den: number; nguon: Nguon }[]>();
  for (const kk of kiemKe) {
    const tu = kk.createdAt.getTime();
    const den = (kk.apDungLuc ?? kk.createdAt).getTime() + TRE_AP_DUNG_MS;
    for (const d of docDongJson(kk.dong)) {
      if (!d.themMoi) continue;
      const k = norm(d.ten);
      const ds = nguonTheoTen.get(k) ?? [];
      ds.push({ tu, den, nguon: { tep: kk.fileName, sheet: d.sheet, nhom: d.nhom } });
      nguonTheoTen.set(k, ds);
    }
  }
  const nguonCua = (m: { nameVn: string; createdAt: Date }): Nguon | null => {
    const t = m.createdAt.getTime();
    return nguonTheoTen.get(norm(m.nameVn))?.find((x) => x.tu <= t && t <= x.den)?.nguon ?? null;
  };

  const tatCa = await prisma.material.findMany({ include: { category: true } });
  const nhomMa = new Map<number, string>();
  for (const m of tatCa) if (m.category && boPhanTuMaNhom(m.category.name)) nhomMa.set(m.category.id, m.category.name);

  const can: { m: (typeof tatCa)[number]; boPhan: BoPhan; rank: string | null; boNhom: boolean; nguon: string }[] = [];
  for (const m of tatCa) {
    const boNhom = m.categoryId !== null && nhomMa.has(m.categoryId);
    const ng = nguonCua(m);
    const boPhanNhom = boPhanTuMaNhom(boNhom ? m.category!.name : null) ?? boPhanTuMaNhom(ng?.nhom);
    const chucDanh = ng ? (chucDanhTrongTen(ng.sheet) ?? chucDanhTrongTen(ng.tep)) : null;
    if (!boNhom && !boPhanNhom && !chucDanh) continue;
    const bpCu = (m.department ?? "").toUpperCase();
    const boPhan = (boPhanNhom ?? (chucDanh ? CHUC_DANH[chucDanh]?.boPhan : undefined) ?? (BO_PHAN[bpCu as BoPhan] ? bpCu : null)) as BoPhan | null;
    if (!boPhan) continue;
    const rankCu = (m.responsibleRank ?? "").trim() || null;
    const rank = rankCu ?? (chucDanh && chucDanhThuocBoPhan(chucDanh, boPhan) ? chucDanh : null);
    const doi = boNhom || boPhan !== bpCu || !m.code.startsWith(`${boPhan}-`) || rank !== rankCu;
    if (!doi) continue;
    const nguon = ng ? `${ng.tep} / ${ng.sheet ?? "-"}` : `nhóm "${m.category?.name}"`;
    can.push({ m, boPhan, rank, boNhom, nguon });
  }
  if (!can.length) {
    console.log("\nKhông có mặt hàng nào phải sửa.");
    return;
  }

  // Cấp mã như bộ nhập file: mọi mã đang có giữ chỗ; dòng sắp sửa xếp theo nhóm (sau sửa) rồi tên.
  const idSua = new Set(can.map((x) => x.m.id));
  const daCap = tatCa.filter((m) => !idSua.has(m.id)).map((m) => ({ ma: m.code, nhom: m.categoryId as number | null }));
  const daDung = new Set(tatCa.map((m) => m.code));
  const ke: Sua[] = [];
  can.sort((a, b) => {
    const na = a.boNhom ? null : a.m.categoryId;
    const nb = b.boNhom ? null : b.m.categoryId;
    return String(na ?? "").localeCompare(String(nb ?? "")) || soSanh(a.m.nameVn, b.m.nameVn);
  });
  for (const { m, boPhan, rank, boNhom, nguon } of can) {
    const nhomMoi = boNhom ? null : m.categoryId;
    let moi = m.code;
    if (!m.code.startsWith(`${boPhan}-`)) {
      const loai = doanLoai(m.materialType);
      let stt = sttTheoNhom(boPhan, loai, daCap, nhomMoi).stt;
      let kq = sinhMaNgan({ boPhan, loai, stt });
      while ("ma" in kq && daDung.has(kq.ma)) kq = sinhMaNgan({ boPhan, loai, stt: ++stt });
      if ("loi" in kq) throw new Error(`Không sinh được mã cho ${m.code}: ${kq.loi}`);
      moi = kq.ma;
      daDung.add(moi);
      daCap.push({ ma: moi, nhom: nhomMoi });
    }
    ke.push({
      id: m.id,
      ten: m.nameVn,
      cu: m.code,
      moi,
      boPhanCu: m.department,
      boPhan,
      rankCu: (m.responsibleRank ?? "").trim() || null,
      rank,
      nhomCu: m.category?.name ?? null,
      boNhom,
      nguon,
    });
  }

  const theoNguon = new Map<string, number>();
  for (const s of ke) theoNguon.set(s.nguon, (theoNguon.get(s.nguon) ?? 0) + 1);
  console.log(`\n${ke.length} mặt hàng phải sửa, theo nguồn:`);
  for (const [n, so] of theoNguon) console.log(`  ${String(so).padStart(4)}  ${n}`);
  const doiMa = ke.filter((s) => s.moi !== s.cu);
  const ganRank = ke.filter((s) => s.rank && s.rank !== s.rankCu);
  console.log(
    `\nĐổi bộ phận: ${ke.filter((s) => s.boPhanCu !== s.boPhan).length} · đổi mã: ${doiMa.length} · gán người giữ: ${ganRank.length} · bỏ nhóm: ${ke.filter((s) => s.boNhom).length}`
  );
  const inDong = (s: Sua) =>
    `  ${s.cu.padEnd(13)} → ${s.moi.padEnd(13)} ${BO_PHAN[s.boPhan].ten.padEnd(5)} ${s.rank ? `[${CHUC_DANH[s.rank]?.ten ?? s.rank}] ` : ""}${s.ten.slice(0, 56)}`;
  const xem = ke.length > 16 ? [...ke.slice(0, 10), null, ...ke.slice(-5)] : ke;
  for (const s of xem) console.log(s ? inDong(s) : `  … (${ke.length - 15} dòng nữa)`);
  const theoRank = new Map<string, number>();
  for (const s of ke) theoRank.set(s.rank ?? "(suy ra)", (theoRank.get(s.rank ?? "(suy ra)") ?? 0) + 1);
  console.log(`Người giữ sau khi sửa: ${[...theoRank].map(([r, n]) => `${CHUC_DANH[r]?.ten ?? r} ${n}`).join(" · ")}`);

  if (!thatSu) {
    console.log("\nChưa sửa gì. Chạy lại với --dong-y để sửa thật.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const s of ke) {
        await tx.material.update({
          where: { id: s.id },
          data: { code: s.moi, department: s.boPhan, responsibleRank: s.rank, ...(s.boNhom ? { categoryId: null } : {}) },
        });
      }
      for (const id of nhomMa.keys()) {
        if ((await tx.material.count({ where: { categoryId: id } })) === 0) await tx.category.delete({ where: { id } });
      }
    },
    { timeout: 60_000 }
  );
  await ghiNhatKy({
    action: "sua-nhom-ma-bo-phan",
    method: "SCRIPT",
    path: "sua-nhom-ma-bo-phan.cmd",
    detail:
      `${ke.length} mặt hàng thêm từ kiểm kê → bộ phận theo mã nhóm / chức danh trong tên sheet-file; ` +
      `đổi ${doiMa.length} mã (${doiMa[0]?.cu} → ${doiMa[0]?.moi}…), gán người giữ ${ganRank.length}` +
      (nhomMa.size ? `, bỏ nhóm ${[...nhomMa.values()].map((n) => `"${n}"`).join(", ")}` : ""),
  });
  console.log(`\nĐÃ SỬA ${ke.length} mặt hàng${nhomMa.size ? `, bỏ nhóm ${[...nhomMa.values()].map((n) => `"${n}"`).join(", ")}` : ""}.`);
}

main()
  .catch((e) => {
    console.error("LỖI:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
