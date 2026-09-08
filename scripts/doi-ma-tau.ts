/**
 * Đổi tiền tố mã tàu, ví dụ ML-001 → MLS-001.
 *
 * Chạy:
 *   doi-ma-tau.cmd                       → chỉ LIỆT KÊ, không sửa gì
 *   doi-ma-tau.cmd --dong-y              → đổi thật (mặc định ML- → MLS-)
 *   doi-ma-tau.cmd --tu=ML- --sang=MLS- --dong-y
 *
 * Mã tàu không nằm một chỗ: nó còn được nhúng vào MÃ KHO của chính tàu đó
 * (`ML-001-ENG`, `-DECK`, `-STORE`), và vào cấu hình bản cài trên tàu
 * (`SiteConfig.vesselCode`). Đổi mỗi bảng Vessel thì mã kho lệch hẳn với mã tàu
 * — nhìn vào kho không còn biết của tàu nào, mà bộ định tuyến kho khi nhập danh
 * mục lại dò theo đuôi mã.
 *
 * KHÔNG đụng tới SỐ HIỆU CHỨNG TỪ đã phát hành (số yêu cầu vật tư `MR-ML001-…`,
 * số đơn mua): đó là số đã in lên giấy và đã có người ký. Sửa lại là sửa hồ sơ.
 * Chứng từ lập SAU khi đổi sẽ tự mang mã mới vì chúng đọc mã tàu lúc lập.
 *
 * Dải id đồng bộ vẫn giữ nguyên: nó tính theo phần SỐ của mã tàu (001 → dải
 * 1.000.000) nên đổi phần chữ không ảnh hưởng.
 */
import { prisma } from "@/lib/prisma";
import { ghiNhatKy } from "@/lib/audit";

function thamSo(ten: string, macDinh: string): string {
  const arg = process.argv.slice(2).find((a) => a.startsWith(`--${ten}=`));
  return arg ? arg.slice(ten.length + 3) : macDinh;
}

async function main() {
  const thatSu = process.argv.includes("--dong-y");
  const tu = thamSo("tu", "ML-");
  const sang = thamSo("sang", "MLS-");

  if (!tu || !sang || tu === sang) {
    console.error("Tiền tố cũ và mới phải khác nhau và không được để trống.");
    process.exit(1);
  }

  const tau = await prisma.vessel.findMany({
    orderBy: { code: "asc" },
    include: { warehouses: { orderBy: { code: "asc" } } },
  });

  console.log("=== ĐỔI TIỀN TỐ MÃ TÀU ===");
  console.log(thatSu ? "CHẾ ĐỘ: ĐỔI THẬT" : "CHẾ ĐỘ: chỉ liệt kê, không sửa gì");
  console.log(`Tiền tố: "${tu}" → "${sang}"\n`);

  const doiTau: { id: number; cu: string; moi: string; ten: string }[] = [];
  const doiKho: { id: number; cu: string; moi: string }[] = [];
  const boQua: string[] = [];

  const maTauDaCo = new Set(tau.map((t) => t.code));
  for (const t of tau) {
    if (!t.code.startsWith(tu)) {
      boQua.push(`${t.code} — không bắt đầu bằng "${tu}"`);
      continue;
    }
    const moi = sang + t.code.slice(tu.length);
    if (maTauDaCo.has(moi)) {
      boQua.push(`${t.code} — mã "${moi}" đã có tàu khác dùng`);
      continue;
    }
    maTauDaCo.add(moi);
    doiTau.push({ id: t.id, cu: t.code, moi, ten: t.name });
    // Mã kho nhúng mã tàu ở đầu — đổi theo cho khớp.
    for (const w of t.warehouses) {
      if (!w.code.startsWith(t.code)) continue;
      doiKho.push({
        id: w.id,
        cu: w.code,
        moi: moi + w.code.slice(t.code.length),
      });
    }
  }

  console.log(`Tàu sẽ đổi (${doiTau.length}):`);
  for (const d of doiTau) {
    console.log(`  ${d.cu.padEnd(9)} → ${d.moi.padEnd(10)} ${d.ten}`);
  }
  console.log(`\nKho đổi theo (${doiKho.length}), 6 dòng đầu:`);
  for (const d of doiKho.slice(0, 6)) {
    console.log(`  ${d.cu.padEnd(14)} → ${d.moi}`);
  }
  if (doiKho.length > 6) console.log(`  ... và ${doiKho.length - 6} kho nữa`);

  const site = await prisma.siteConfig.findUnique({ where: { id: 1 } });
  const siteMoi =
    site?.vesselCode && site.vesselCode.startsWith(tu)
      ? sang + site.vesselCode.slice(tu.length)
      : null;
  if (siteMoi) {
    console.log(`\nCấu hình bản cài: ${site!.vesselCode} → ${siteMoi}`);
  }

  if (boQua.length) {
    console.log(`\nBỏ qua ${boQua.length} tàu:`);
    for (const b of boQua) console.log(`  ${b}`);
  }

  // Số hiệu chứng từ đã phát hành: chỉ BÁO, không đụng.
  const soChungTu = await prisma.materialRequest.count();
  if (soChungTu) {
    console.log(
      `\nGiữ nguyên ${soChungTu} số yêu cầu vật tư đã phát hành (MR-…): đó là số` +
        "\nđã in lên giấy và đã có người ký. Chứng từ lập sau sẽ mang mã tàu mới."
    );
  }

  if (!doiTau.length) {
    console.log("\nKhông có gì để đổi.");
    await prisma.$disconnect();
    return;
  }

  if (!thatSu) {
    console.log(
      "\nĐây mới là liệt kê. Đối chiếu thấy đúng thì chạy lại:\n" +
        `  doi-ma-tau.cmd --dong-y${tu !== "ML-" || sang !== "MLS-" ? ` --tu=${tu} --sang=${sang}` : ""}`
    );
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const d of doiTau) {
      await tx.vessel.update({ where: { id: d.id }, data: { code: d.moi } });
    }
    for (const d of doiKho) {
      await tx.warehouse.update({ where: { id: d.id }, data: { code: d.moi } });
    }
    if (siteMoi) {
      await tx.siteConfig.update({
        where: { id: 1 },
        data: { vesselCode: siteMoi },
      });
    }
  });

  await ghiNhatKy({
    action: "doi-ma-tau",
    method: "SCRIPT",
    path: "doi-ma-tau.cmd",
    detail:
      `Đổi tiền tố mã tàu "${tu}" → "${sang}": ${doiTau.length} tàu, ` +
      `${doiKho.length} kho${siteMoi ? ", và cấu hình bản cài" : ""}. ` +
      "Số hiệu chứng từ đã phát hành giữ nguyên.",
  });

  console.log(`\nĐã đổi ${doiTau.length} tàu và ${doiKho.length} kho.`);
  await prisma.$disconnect();
}

main();
