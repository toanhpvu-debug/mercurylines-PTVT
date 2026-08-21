/**
 * XUẤT gói đồng bộ.
 *
 * Chạy trên TÀU  → xuất dữ liệu của tàu đã thay đổi, gửi về văn phòng.
 * Chạy ở VĂN PHÒNG → xuất danh mục dùng chung mới, gửi xuống tàu.
 *
 * Chỉ ĐỌC database, không sửa gì (trừ việc ghi lại mốc đồng bộ khi thành công).
 * Chỉ lấy bản ghi thay đổi SAU lần xuất trước; lần đầu thì lấy tất cả.
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

import { prisma } from "@/lib/prisma";
import {
  BANG_CUA_TAU,
  BANG_CON,
  BANG_DUNG_CHUNG,
  PHIEN_BAN_GOI,
  chuanHoaDeGhi,
  type GoiDongBo,
} from "@/lib/sync";

/* eslint-disable @typescript-eslint/no-explicit-any */
const b = (ten: string) => (prisma as any)[ten];

const THU_MUC = path.resolve(process.cwd(), "dong-bo");

async function main() {
  const site = await prisma.siteConfig.findUnique({ where: { id: 1 } });
  if (!site) {
    console.error(
      "Chưa khai báo bản cài này là của tàu nào hay là văn phòng.\n" +
        "Chạy khai-bao-ban-cai.cmd trước."
    );
    process.exit(1);
  }
  const laTau = !!site.vesselCode;
  const huong = laTau ? "TAU_LEN_VAN_PHONG" : "VAN_PHONG_VE_TAU";

  console.log("=== XUẤT GÓI ĐỒNG BỘ ===");
  console.log(
    laTau ? `Bản cài của tàu ${site.vesselCode}` : "Bản cài văn phòng"
  );

  // Mốc lần xuất trước — chỉ lấy thay đổi sau mốc đó.
  // findFirst chứ không findUnique: vesselCode cho phép null (bản văn phòng),
  // mà khóa unique ghép của Prisma không nhận null.
  const moc = await prisma.syncState.findFirst({
    where: { huong: "GUI_DI", vesselCode: site.vesselCode },
  });
  const tuMoc = moc?.lastSyncAt ?? null;
  console.log(
    tuMoc
      ? `Lấy thay đổi sau ${tuMoc.toLocaleString("vi-VN")}`
      : "Lần đầu — lấy toàn bộ"
  );
  // Chốt mốc TRƯỚC khi đọc: bản ghi tạo trong lúc đang xuất sẽ thuộc lần sau,
  // không bị bỏ sót.
  const mocMoi = new Date();

  const duLieu: Record<string, unknown[]> = {};
  let tong = 0;

  if (laTau) {
    const vessel = await prisma.vessel.findUnique({
      where: { code: site.vesselCode! },
    });
    if (!vessel) {
      console.error(`Không thấy tàu ${site.vesselCode} trong database.`);
      process.exit(1);
    }
    // Bảng gắn với tàu
    for (const { ten, moc: cotMoc } of BANG_CUA_TAU) {
      const where: Record<string, unknown> = { vesselId: vessel.id };
      if (tuMoc) where[cotMoc] = { gt: tuMoc };
      const rows = await b(ten).findMany({ where });
      duLieu[ten] = rows.map(chuanHoaDeGhi);
      tong += rows.length;
      if (rows.length) console.log(`  ${ten.padEnd(24)} ${rows.length}`);
    }
    // Bảng con — lấy theo bản ghi cha vừa xuất
    for (const { ten, cha, khoa } of BANG_CON) {
      const idCha = (duLieu[cha] ?? []).map((r) => (r as { id: number }).id);
      if (!idCha.length) {
        duLieu[ten] = [];
        continue;
      }
      const rows = await b(ten).findMany({ where: { [khoa]: { in: idCha } } });
      duLieu[ten] = rows.map(chuanHoaDeGhi);
      tong += rows.length;
      if (rows.length) console.log(`  ${ten.padEnd(24)} ${rows.length}`);
    }
  } else {
    // Văn phòng: xuất danh mục dùng chung
    for (const { ten, moc: cotMoc } of BANG_DUNG_CHUNG) {
      const where = tuMoc ? { [cotMoc]: { gt: tuMoc } } : {};
      const rows = await b(ten).findMany({ where });
      duLieu[ten] = rows.map(chuanHoaDeGhi);
      tong += rows.length;
      if (rows.length) console.log(`  ${ten.padEnd(24)} ${rows.length}`);
    }
  }

  if (tong === 0) {
    console.log("\nKhông có thay đổi nào cần gửi.");
    await prisma.$disconnect();
    return;
  }

  const goi: GoiDongBo = {
    phienBan: PHIEN_BAN_GOI,
    huong,
    vesselCode: site.vesselCode,
    tuMoc: tuMoc ? tuMoc.toISOString() : null,
    taoLuc: mocMoi.toISOString(),
    duLieu,
    soBanGhi: tong,
  };

  mkdirSync(THU_MUC, { recursive: true });
  const dau = laTau ? site.vesselCode : "VANPHONG";
  const ten = `dongbo-${dau}-${mocMoi.toISOString().slice(0, 19).replace(/[:T]/g, "")}.json`;
  const duongDan = path.join(THU_MUC, ten);
  writeFileSync(duongDan, JSON.stringify(goi, null, 1), "utf8");

  // Ghi mốc SAU khi file đã nằm trên đĩa — hỏng giữa chừng thì lần sau xuất lại.
  if (moc) {
    await prisma.syncState.update({
      where: { id: moc.id },
      data: { lastSyncAt: mocMoi, lastCount: tong },
    });
  } else {
    await prisma.syncState.create({
      data: {
        huong: "GUI_DI",
        vesselCode: site.vesselCode,
        lastSyncAt: mocMoi,
        lastCount: tong,
      },
    });
  }

  console.log(`\nĐã xuất ${tong} bản ghi.`);
  console.log(`File: ${duongDan}`);
  console.log("Gửi file này về nơi nhận rồi chạy dong-bo-nhap ở bên đó.");
  await prisma.$disconnect();
}

main();
