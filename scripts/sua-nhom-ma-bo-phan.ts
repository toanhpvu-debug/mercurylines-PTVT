/**
 * Áp luật nhập mới (lib/materialImportApply.ts) cho những mặt hàng ĐÃ được thêm từ file kiểm kê
 * trước khi bộ nhập hiểu được ba manh mối sau:
 *
 *   1. Ô "Nhóm" ghi MÃ BỘ PHẬN ("E", "E1"…"E10" — lib/maVatTu.ts boPhanTuMaNhom): đó là bộ phận,
 *      không phải tên nhóm hàng.
 *   2. Tên sheet / tên file ghi CHỨC DANH người giữ ("VẬT TƯ MAU HỎNG 4E", "… BOILLER 4E.xlsx"
 *      — chucDanhTrongTen): hàng của chức danh đó, thuộc bộ phận của chức danh đó.
 *   3. Tên sheet / tên file là TỦ THUỐC ("MEDICINE", "… SPAIRE MEDICINE.xlsx" — laTenTuThuoc) mà ô
 *      Nhóm trống: hàng vào nhóm "Y tế & tủ thuốc" → An toàn chung, Phó hai giữ.
 *
 * Lần kiểm kê 16/10/2026 của M.ODYSSEY: file "MLS-11-06 … BOILLER 4E" (ô Bộ phận "Materials of
 * 4E") thêm 80 mặt hàng với nhóm tên trơn "E" cùng 19 phụ tùng BWMS / OWS / Sewage không ghi nhóm
 * — cả 99 rơi vào Boong (mã D-IMPA-07xx / 08xx, Thủy thủ trưởng, cột Nhóm "E"); file "… SPAIRE
 * MEDICINE" thêm 73 món tủ thuốc — rơi vào Boong, Thủy thủ trưởng giữ.
 *
 * Với mỗi mặt hàng thuộc nhóm tên là mã bộ phận, hoặc được thêm mới từ một dòng kiểm kê có
 * manh mối trên:
 *   - bộ phận: mã bộ phận ở ô Nhóm → bộ phận của chức danh trong tên sheet / file → tủ thuốc: Boong;
 *   - mã đổi sang khuôn của bộ phận ấy (E-IMPA-####) nếu đang mang chữ bộ phận khác — cấp số như
 *     bộ nhập file (sttTheoNhom), theo tên A→Z;
 *   - người giữ: chức danh trong tên sheet / file, chỉ khi cột responsibleRank còn trống (tủ thuốc
 *     không gán — nhóm "Y tế & tủ thuốc" tự ra Phó hai);
 *   - bỏ nhóm mã bộ phận; hàng tủ thuốc chưa có nhóm thì vào nhóm "Y tế & tủ thuốc" (tạo nếu chưa
 *     có); nhóm mã bộ phận không còn ai dùng thì xóa.
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
  NHOM_THIET_BI,
  TEN_NHOM_TU_THUOC,
  boPhanTuMaNhom,
  chucDanhThuocBoPhan,
  chucDanhTrongTen,
  doanLoai,
  laTenTuThuoc,
  sinhMaNgan,
  sttTheoNhom,
  type BoPhan,
} from "@/lib/maVatTu";

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const soSanh = new Intl.Collator("vi").compare;
/** Mặt hàng tạo lúc áp dụng kiểm kê: trong khoảng từ lúc tải file tới vài phút sau lúc áp dụng. */
const TRE_AP_DUNG_MS = 15 * 60_000;
/** Khóa nhóm tạm (khi cấp mã) cho nhóm tủ thuốc chưa có trong database. */
const NHOM_TU_THUOC_MOI = "__tu-thuoc";

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
  boNhom: boolean;
  vaoTuThuoc: boolean;
  nguon: string;
};

async function main() {
  const thatSu = process.argv.includes("--dong-y");
  console.log("=== ÁP LUẬT NHẬP MỚI CHO HÀNG ĐÃ THÊM TỪ KIỂM KÊ (mã bộ phận, chức danh, tủ thuốc) ===");
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
  const nhomTuThuoc = await prisma.category.findFirst({ where: { name: TEN_NHOM_TU_THUOC }, select: { id: true } });

  const can: { m: (typeof tatCa)[number]; boPhan: BoPhan; rank: string | null; boNhom: boolean; vaoTuThuoc: boolean; nguon: string }[] = [];
  for (const m of tatCa) {
    const boNhom = m.categoryId !== null && nhomMa.has(m.categoryId);
    const ng = nguonCua(m);
    const boPhanNhom = boPhanTuMaNhom(boNhom ? m.category!.name : null) ?? boPhanTuMaNhom(ng?.nhom);
    const chucDanh = ng ? (chucDanhTrongTen(ng.sheet) ?? chucDanhTrongTen(ng.tep)) : null;
    // Tủ thuốc: ô Nhóm trong file trống, mặt hàng chưa thuộc nhóm nào (hoặc chỉ thuộc nhóm mã bộ phận).
    const vaoTuThuoc = Boolean(ng && !ng.nhom && (m.categoryId === null || boNhom) && (laTenTuThuoc(ng.sheet) || laTenTuThuoc(ng.tep)));
    if (!boNhom && !boPhanNhom && !chucDanh && !vaoTuThuoc) continue;
    const bpCu = (m.department ?? "").toUpperCase();
    const boPhan = (boPhanNhom ??
      (chucDanh ? CHUC_DANH[chucDanh]?.boPhan : undefined) ??
      (vaoTuThuoc ? NHOM_THIET_BI.MED.boPhan : undefined) ??
      (BO_PHAN[bpCu as BoPhan] ? bpCu : null)) as BoPhan | null;
    if (!boPhan) continue;
    const rankCu = (m.responsibleRank ?? "").trim() || null;
    const rank = rankCu ?? (chucDanh && chucDanhThuocBoPhan(chucDanh, boPhan) ? chucDanh : null);
    const doi = boNhom || vaoTuThuoc || boPhan !== bpCu || !m.code.startsWith(`${boPhan}-`) || rank !== rankCu;
    if (!doi) continue;
    const nguon = ng ? `${ng.tep} / ${ng.sheet ?? "-"}` : `nhóm "${m.category?.name}"`;
    can.push({ m, boPhan, rank, boNhom, vaoTuThuoc, nguon });
  }
  if (!can.length) {
    console.log("\nKhông có mặt hàng nào phải sửa.");
    return;
  }

  // Cấp mã như bộ nhập file: mọi mã đang có giữ chỗ; dòng sắp sửa xếp theo nhóm (sau sửa) rồi tên.
  const nhomSau = (x: { m: { categoryId: number | null }; boNhom: boolean; vaoTuThuoc: boolean }): number | string | null =>
    x.vaoTuThuoc ? (nhomTuThuoc?.id ?? NHOM_TU_THUOC_MOI) : x.boNhom ? null : x.m.categoryId;
  const idSua = new Set(can.map((x) => x.m.id));
  const daCap: { ma: string; nhom: number | string | null }[] = tatCa.filter((m) => !idSua.has(m.id)).map((m) => ({ ma: m.code, nhom: m.categoryId }));
  // Dòng giữ nguyên mã đã nằm trong nhóm SAU khi sửa: mã mới của cùng nhóm nối tiếp ngay sau
  // chúng (máy đo huyết áp sang tủ thuốc → D-IMPA-0793 liền dãy 0720…0792), không mở khối mới
  // rồi nhặt lại số vừa trống — số đó có thể còn trên tem dán của món hàng cũ.
  for (const x of can) if (x.m.code.startsWith(`${x.boPhan}-`)) daCap.push({ ma: x.m.code, nhom: nhomSau(x) });
  const daDung = new Set(tatCa.map((m) => m.code));
  const ke: Sua[] = [];
  can.sort((a, b) => String(nhomSau(a) ?? "").localeCompare(String(nhomSau(b) ?? "")) || soSanh(a.m.nameVn, b.m.nameVn));
  for (const x of can) {
    const { m, boPhan, rank, boNhom, vaoTuThuoc, nguon } = x;
    let moi = m.code;
    if (!m.code.startsWith(`${boPhan}-`)) {
      const loai = doanLoai(m.materialType);
      let stt = sttTheoNhom(boPhan, loai, daCap, nhomSau(x)).stt;
      let kq = sinhMaNgan({ boPhan, loai, stt });
      while ("ma" in kq && daDung.has(kq.ma)) kq = sinhMaNgan({ boPhan, loai, stt: ++stt });
      if ("loi" in kq) throw new Error(`Không sinh được mã cho ${m.code}: ${kq.loi}`);
      moi = kq.ma;
      daDung.add(moi);
      daCap.push({ ma: moi, nhom: nhomSau(x) });
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
      boNhom,
      vaoTuThuoc,
      nguon,
    });
  }

  const theoNguon = new Map<string, number>();
  for (const s of ke) theoNguon.set(s.nguon, (theoNguon.get(s.nguon) ?? 0) + 1);
  console.log(`\n${ke.length} mặt hàng phải sửa, theo nguồn:`);
  for (const [n, so] of theoNguon) console.log(`  ${String(so).padStart(4)}  ${n}`);
  const doiMa = ke.filter((s) => s.moi !== s.cu);
  const ganRank = ke.filter((s) => s.rank && s.rank !== s.rankCu);
  const tuThuoc = ke.filter((s) => s.vaoTuThuoc);
  console.log(
    `\nĐổi bộ phận: ${ke.filter((s) => s.boPhanCu !== s.boPhan).length} · đổi mã: ${doiMa.length} · gán người giữ: ${ganRank.length} · bỏ nhóm mã bộ phận: ${ke.filter((s) => s.boNhom).length} · vào nhóm "${TEN_NHOM_TU_THUOC}": ${tuThuoc.length}`
  );
  const inDong = (s: Sua) =>
    `  ${s.cu.padEnd(13)} → ${s.moi.padEnd(13)} ${BO_PHAN[s.boPhan].ten.padEnd(5)} ${s.rank ? `[${CHUC_DANH[s.rank]?.ten ?? s.rank}] ` : ""}${s.vaoTuThuoc ? `{${TEN_NHOM_TU_THUOC}} ` : ""}${s.ten.slice(0, 50)}`;
  const xem = process.argv.includes("--het") ? ke : ke.length > 16 ? [...ke.slice(0, 10), null, ...ke.slice(-5)] : ke;
  for (const s of xem) console.log(s ? inDong(s) : `  … (${ke.length - 15} dòng nữa)`);
  const theoRank = new Map<string, number>();
  for (const s of ke) {
    const k = s.rank ?? (s.vaoTuThuoc ? "Phó hai (suy ra từ nhóm tủ thuốc)" : "(suy ra)");
    theoRank.set(k, (theoRank.get(k) ?? 0) + 1);
  }
  console.log(`Người giữ sau khi sửa: ${[...theoRank].map(([r, n]) => `${CHUC_DANH[r]?.ten ?? r} ${n}`).join(" · ")}`);

  if (!thatSu) {
    console.log("\nChưa sửa gì. Chạy lại với --dong-y để sửa thật.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      let idTuThuoc = nhomTuThuoc?.id ?? null;
      if (tuThuoc.length && idTuThuoc === null) {
        let ma = "CAT-y-te-tu-thuoc";
        for (let i = 2; await tx.category.findUnique({ where: { code: ma } }); i++) ma = `CAT-y-te-tu-thuoc-${i}`;
        idTuThuoc = (await tx.category.create({ data: { code: ma, name: TEN_NHOM_TU_THUOC } })).id;
      }
      for (const s of ke) {
        await tx.material.update({
          where: { id: s.id },
          data: {
            code: s.moi,
            department: s.boPhan,
            responsibleRank: s.rank,
            ...(s.vaoTuThuoc ? { categoryId: idTuThuoc } : s.boNhom ? { categoryId: null } : {}),
          },
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
      `đổi ${doiMa.length} mã${doiMa.length ? ` (${doiMa[0].cu} → ${doiMa[0].moi}…)` : ""}, gán người giữ ${ganRank.length}` +
      (tuThuoc.length ? `, ${tuThuoc.length} món vào nhóm "${TEN_NHOM_TU_THUOC}"` : "") +
      (nhomMa.size ? `, bỏ nhóm ${[...nhomMa.values()].map((n) => `"${n}"`).join(", ")}` : ""),
  });
  console.log(`\nĐÃ SỬA ${ke.length} mặt hàng.`);
}

main()
  .catch((e) => {
    console.error("LỖI:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
