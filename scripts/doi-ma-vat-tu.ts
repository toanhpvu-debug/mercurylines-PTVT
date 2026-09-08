/**
 * Đổi mã vật tư sang khuôn theo BỘ PHẬN:
 *
 *   D-IMPA-####   vật tư boong          D-SPR-####   phụ tùng boong
 *   E-IMPA-####   vật tư máy            E-SPR-####   phụ tùng máy
 *   L-IMPA-####   vật tư điện           L-SPR-####   phụ tùng điện
 *   C-IMPA-####   vật tư phục vụ        C-SPR-####   phụ tùng phục vụ
 *
 * Chạy:
 *   doi-ma-vat-tu.cmd                          → chỉ LIỆT KÊ, không sửa gì
 *   doi-ma-vat-tu.cmd --dong-y                 → đổi thật, đánh số lại từ 0001 cho mỗi khuôn
 *   doi-ma-vat-tu.cmd --dong-y --giu-so        → đổi thật, giữ nguyên số thứ tự cũ
 *   doi-ma-vat-tu.cmd --dong-y --theo-nhom     → xếp lại theo KHỐI của từng nhóm vật tư
 *
 * `--theo-nhom` là cách xếp có trật tự nhất: trong mỗi khuôn, mỗi nhóm vật tư
 * chiếm một dải số riêng bắt đầu ở mốc trăm, rộng gấp đôi số hàng đang có, và
 * trong mỗi nhóm hàng xếp theo tên A→Z.
 *
 *   D-IMPA-0001 … 0300   Boong (Deck)              142 mặt hàng
 *   D-IMPA-0301 … 0400   Thiết bị an toàn            2 mặt hàng
 *   D-IMPA-0401 … 0500   Vật tư bảo hộ & an toàn    35 mặt hàng
 *
 * Chỗ trống trong mỗi dải chính là điểm của cách xếp này: nhập thêm hàng vào
 * một nhóm thì mã mới vẫn rơi đúng vào dải của nhóm đó (xem `sttTheoNhom` trong
 * lib/maVatTu.ts), không phải đánh số lại cả danh mục — mà đánh số lại là phải
 * in lại nhãn dán ngoài kho.
 *
 * Chạy lại `--theo-nhom` khi nào? Khi trang nhập file báo "đã kín khối", hoặc
 * sau một đợt nhập lớn muốn xếp cho gọn. KHÔNG chạy định kỳ cho vui: mỗi lần
 * chạy là mọi nhãn đã in thành sai.
 *
 * Khuôn cũ `ML-IMP-####` / `ML-SPR-####` có tiền tố `ML` là hằng số — mọi dòng
 * trong database này đều của Mercury Lines, nên bốn ký tự đó không nói thêm
 * điều gì. Thay bằng chữ cái bộ phận thì mã trả lời được ngay câu hỏi đầu tiên
 * khi cầm một thùng hàng trong kho: của bộ phận nào.
 *
 * Bộ phận lấy từ cột `Material.department` (do gan-ma-vat-tu.cmd gán). Dòng nào
 * chưa có thì suy từ nhóm vật tư như giao diện vẫn làm; vẫn không ra thì để
 * nguyên mã cũ và liệt kê riêng — đoán bừa bộ phận là xếp món hàng vào tay
 * người không giữ nó.
 *
 * MẶC ĐỊNH ĐÁNH SỐ LẠI từ 0001 cho từng khuôn: số cũ là một dãy chung cho cả
 * vật tư lẫn phụ tùng của mọi bộ phận, mang sang khuôn mới thì mỗi bộ phận có
 * một dãy số thủng lỗ chỗ và không nói lên điều gì. Cần giữ số cũ để lần lại
 * nhãn đã dán thì thêm --giu-so.
 */
import { prisma } from "@/lib/prisma";
import { ghiNhatKy } from "@/lib/audit";
import { BO_PHAN, boCucKhoi, doanLoai, type BoPhan } from "@/lib/maVatTu";
import { departmentOfMaterial } from "@/lib/departments";

/** Nhóm hiển thị (6 nhóm của giao diện) → bộ phận trong mã (4 chữ cái). */
const THEO_NHOM_HIEN_THI: Record<string, BoPhan> = {
  DECK: "D",
  ENGINE: "E",
  ELEC: "L",
  SERVICE: "C",
  // Bảo hộ lao động thuộc bộ phận boong — đại phó và thủy thủ trưởng cấp phát.
  SAFETY: "D",
  // "Khác" chỉ còn lại với vật tư (phụ tùng không đoán được đã bị đẩy sang Máy),
  // mà vật tư không rõ nhóm thì gần như luôn là hàng boong.
  OTHER: "D",
};

async function main() {
  const thatSu = process.argv.includes("--dong-y");
  const giuSo = process.argv.includes("--giu-so");
  const theoNhom = process.argv.includes("--theo-nhom");

  const materials = await prisma.material.findMany({
    orderBy: { code: "asc" },
    include: { category: true },
  });

  console.log("=== ĐỔI MÃ VẬT TƯ THEO BỘ PHẬN ===");
  console.log(thatSu ? "CHẾ ĐỘ: ĐỔI THẬT" : "CHẾ ĐỘ: chỉ liệt kê, không sửa gì");
  console.log(
    theoNhom
      ? "Số thứ tự: xếp theo KHỐI của từng nhóm vật tư (mỗi nhóm một dải số riêng)"
      : giuSo
        ? "Số thứ tự: giữ nguyên số cũ"
        : "Số thứ tự: đánh lại từ 0001 cho mỗi khuôn"
  );
  console.log(`Danh mục: ${materials.length} mặt hàng\n`);

  const doi: { id: number; cu: string; moi: string; ten: string }[] = [];
  const boQua: { code: string; ten: string; viSao: string }[] = [];

  // ─── Bước 1: chốt bộ phận và loại hàng cho từng dòng ───
  type Dong = {
    id: number;
    code: string;
    ten: string;
    tienTo: string;
    nhom: string;
    tenNhom: string;
  };
  const xepDuoc: Dong[] = [];

  for (const m of materials) {
    // Bộ phận: cột đã gán trước, không có thì suy từ nhóm như giao diện.
    let bp = (m.department ?? "") as BoPhan | "";
    if (!bp || !BO_PHAN[bp as BoPhan]) {
      const key = departmentOfMaterial(
        [m.category?.name, m.equipment, m.nameVn],
        m.materialType
      );
      bp = THEO_NHOM_HIEN_THI[key] ?? "";
    }
    if (!bp) {
      boQua.push({
        code: m.code,
        ten: m.nameVn,
        viSao: "không suy ra được bộ phận — chạy gan-ma-vat-tu.cmd trước",
      });
      continue;
    }
    xepDuoc.push({
      id: m.id,
      code: m.code,
      ten: m.nameVn,
      tienTo: `${bp}-${doanLoai(m.materialType)}-`,
      nhom: String(m.categoryId ?? ""),
      // Dòng chưa xếp nhóm gom chung vào một "nhóm" và bị đẩy xuống cuối dãy:
      // chúng chưa nói được gì về vị trí, không nên chen vào giữa các khối.
      tenNhom: m.category?.name ?? "\uffff(chưa xếp nhóm)",
    });
  }

  // Mã của những dòng KHÔNG đổi được vẫn phải giữ chỗ, nếu không một dòng khác
  // sẽ được cấp đúng mã chúng đang mang.
  const daDung = new Set(boQua.map((b) => b.code));

  // ─── Bước 2: cấp số ───
  const ghiNhan = (d: Dong, so: number) => {
    const moi = `${d.tienTo}${String(so).padStart(4, "0")}`;
    daDung.add(moi);
    if (moi !== d.code) doi.push({ id: d.id, cu: d.code, moi, ten: d.ten });
  };

  /** Bố cục khối đã cấp, để in ra cho người dùng đối chiếu. */
  const soDoKhoi: { khuon: string; nhom: string; dau: number; cuoi: number; so: number }[] = [];

  if (theoNhom) {
    // Xếp lại theo KHỐI: mỗi nhóm vật tư một dải số riêng, bắt đầu ở mốc trăm,
    // rộng gấp đôi số hàng đang có để còn chỗ nhập thêm. Trong mỗi nhóm, hàng
    // xếp theo tên A→Z.
    const theoKhuonRoiNhom = new Map<string, Map<string, Dong[]>>();
    for (const d of xepDuoc) {
      if (!theoKhuonRoiNhom.has(d.tienTo)) theoKhuonRoiNhom.set(d.tienTo, new Map());
      const bang = theoKhuonRoiNhom.get(d.tienTo)!;
      if (!bang.has(d.nhom)) bang.set(d.nhom, []);
      bang.get(d.nhom)!.push(d);
    }
    const soSanh = new Intl.Collator("vi").compare;
    for (const [tienTo, bang] of theoKhuonRoiNhom) {
      // Thứ tự nhóm theo TÊN chứ không theo số lượng: tên thì người tra cứu
      // đoán được, còn số lượng thì đổi mỗi lần nhập thêm hàng.
      const thuTuNhom = [...bang.entries()].sort((a, b) =>
        soSanh(a[1][0].tenNhom, b[1][0].tenNhom)
      );
      const boCuc = boCucKhoi(
        thuTuNhom.map(([nhom, ds]) => ({ nhom, soMatHang: ds.length }))
      );
      for (const [nhom, ds] of thuTuNhom) {
        const khoi = boCuc.get(nhom)!;
        if (khoi.cuoi > 9999) {
          for (const d of ds) {
            boQua.push({
              code: d.code,
              ten: d.ten,
              viSao: `khuôn ${tienTo}#### hết chỗ (cần tới số ${khoi.cuoi})`,
            });
            daDung.add(d.code);
          }
          continue;
        }
        ds.sort((a, b) => soSanh(a.ten, b.ten));
        ds.forEach((d, i) => ghiNhan(d, khoi.dau + i));
        soDoKhoi.push({
          khuon: tienTo,
          nhom: ds[0].tenNhom.replace(/^￿/, ""),
          dau: khoi.dau,
          cuoi: khoi.cuoi,
          so: ds.length,
        });
      }
    }
  } else {
    const dem = new Map<string, number>();
    for (const d of xepDuoc) {
      let so: number;
      if (giuSo) {
        const cu = d.code.match(/(\d{1,6})\s*$/);
        if (!cu) {
          boQua.push({
            code: d.code,
            ten: d.ten,
            viSao: "mã cũ không có phần số nên không giữ số được",
          });
          daDung.add(d.code);
          continue;
        }
        so = Number(cu[1]);
        const moi = `${d.tienTo}${String(so).padStart(4, "0")}`;
        if (moi !== d.code && daDung.has(moi)) {
          boQua.push({
            code: d.code,
            ten: d.ten,
            viSao: `mã ${moi} đã có dòng khác dùng`,
          });
          daDung.add(d.code);
          continue;
        }
      } else {
        so = (dem.get(d.tienTo) ?? 0) + 1;
        dem.set(d.tienTo, so);
      }
      ghiNhan(d, so);
    }
  }

  // ─── Tổng hợp theo khuôn ───
  const theoKhuon = new Map<string, number>();
  for (const d of doi) {
    const k = d.moi.split("-").slice(0, 2).join("-");
    theoKhuon.set(k, (theoKhuon.get(k) ?? 0) + 1);
  }
  if (soDoKhoi.length) {
    console.log("Sơ đồ khối — mỗi nhóm một dải số riêng, còn chỗ trống để nhập thêm:");
    let khuonTruoc = "";
    for (const k of soDoKhoi) {
      if (k.khuon !== khuonTruoc) {
        console.log(`
  ${k.khuon}####`);
        khuonTruoc = k.khuon;
      }
      const dai = `${String(k.dau).padStart(4, "0")} … ${String(k.cuoi).padStart(4, "0")}`;
      console.log(
        `    ${dai}  ${String(k.so).padStart(4)} mặt hàng  ${k.nhom.slice(0, 38)}`
      );
    }
    console.log("");
  }
  console.log("Số mã theo từng khuôn:");
  for (const [k, n] of [...theoKhuon].sort()) {
    const bp = k.split("-")[0] as BoPhan;
    const loai = k.endsWith("SPR") ? "phụ tùng" : "vật tư";
    console.log(`  ${(k + "-####").padEnd(14)} ${BO_PHAN[bp].ten} · ${loai}`.padEnd(46) + String(n).padStart(4));
  }

  console.log(`\nSẽ đổi ${doi.length} mã. Ví dụ:`);
  for (const d of doi.slice(0, 12)) {
    console.log(`  ${d.cu.padEnd(14)} → ${d.moi.padEnd(14)} ${d.ten.slice(0, 42)}`);
  }
  if (doi.length > 12) console.log(`  ... và ${doi.length - 12} dòng nữa`);

  if (boQua.length) {
    console.log(`\nBỏ qua ${boQua.length} dòng:`);
    for (const b of boQua.slice(0, 10)) {
      console.log(`  ${b.code} — ${b.ten.slice(0, 40)}: ${b.viSao}`);
    }
    if (boQua.length > 10) console.log(`  ... và ${boQua.length - 10} dòng nữa`);
  }

  if (!doi.length) {
    console.log("\nKhông có gì để đổi.");
    await prisma.$disconnect();
    return;
  }

  if (!thatSu) {
    console.log(
      "\nĐây mới là liệt kê. Đối chiếu thấy đúng thì chạy lại:\n" +
        `  doi-ma-vat-tu.cmd --dong-y${theoNhom ? " --theo-nhom" : ""}${giuSo ? " --giu-so" : ""}`
    );
    await prisma.$disconnect();
    return;
  }

  // Đổi qua MÃ TẠM rồi mới sang mã đích, trong một transaction.
  //
  // Bắt buộc phải đi hai vòng: mã cũ và mã mới dùng chung không gian tên, nên
  // đổi thẳng thì dòng này có thể chiếm mã mà dòng kia còn đang giữ ("đổi số
  // ghế khi phòng đã kín"). Đưa hết sang mã tạm — chuỗi không ai dùng — rồi mới
  // đặt mã đích, thì không có va chạm nào ở giữa chừng.
  await prisma.$transaction(async (tx) => {
    for (const d of doi) {
      await tx.material.update({
        where: { id: d.id },
        data: { code: `~TAM~${d.id}` },
      });
    }
    for (const d of doi) {
      await tx.material.update({ where: { id: d.id }, data: { code: d.moi } });
    }
  });

  await ghiNhatKy({
    action: "doi-ma-vat-tu",
    method: "SCRIPT",
    path: "doi-ma-vat-tu.cmd",
    detail:
      `Đổi ${doi.length} mã sang khuôn [bộ phận]-IMPA/SPR-####` +
      (giuSo ? " (giữ số cũ)" : " (đánh số lại từ 0001)"),
  });

  console.log(`\nĐã đổi ${doi.length} mã.`);
  await prisma.$disconnect();
}

main();
