/**
 * NHẬP gói đồng bộ do bên kia xuất ra.
 *
 * Dùng upsert theo id: bản ghi chưa có thì tạo, đã có thì cập nhật. Nhập lại
 * cùng một gói không sinh bản ghi trùng.
 *
 * Chạy:  dong-bo-nhap.cmd <đường dẫn file .json>
 *        thiếu tham số thì tự lấy file mới nhất trong thư mục dong-bo/
 */
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import path from "path";

import { prisma } from "@/lib/prisma";
import {
  BANG_CUA_TAU,
  BANG_CON,
  BANG_DUNG_CHUNG,
  PHIEN_BAN_GOI,
  TEN_BANG_DB,
  khoiPhucKhiDoc,
  sqlDatLaiBoDem,
  type GoiDongBo,
} from "@/lib/sync";

/* eslint-disable @typescript-eslint/no-explicit-any */
const b = (ten: string) => (prisma as any)[ten];

const THU_MUC = path.resolve(process.cwd(), "dong-bo");

function timFile(): string | null {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (arg) return path.resolve(arg);
  if (!existsSync(THU_MUC)) return null;
  // Sắp theo THỜI GIAN SỬA FILE, không theo tên: tên có tiền tố tàu
  // (dongbo-VANPHONG-… so với dongbo-ML-001-…) nên sắp theo tên sẽ lấy nhầm gói cũ.
  const files = readdirSync(THU_MUC)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const p = path.join(THU_MUC, f);
      return { p, mtime: statSync(p).mtimeMs };
    })
    .sort((a, z) => z.mtime - a.mtime);
  return files.length ? files[0].p : null;
}

async function main() {
  const duongDan = timFile();
  if (!duongDan || !existsSync(duongDan)) {
    console.error(
      "Không thấy file gói đồng bộ.\n" +
        "Dùng: dong-bo-nhap.cmd <đường dẫn file .json>\n" +
        `hoặc đặt file vào thư mục ${THU_MUC}`
    );
    process.exit(1);
  }

  const goi = JSON.parse(readFileSync(duongDan, "utf8")) as GoiDongBo;
  if (goi.phienBan !== PHIEN_BAN_GOI) {
    console.error(
      `Gói ở phiên bản ${goi.phienBan}, bản cài này đọc phiên bản ${PHIEN_BAN_GOI}. Cập nhật app rồi thử lại.`
    );
    process.exit(1);
  }

  const site = await prisma.siteConfig.findUnique({ where: { id: 1 } });
  if (!site) {
    console.error(
      "Chưa khai báo bản cài này là của tàu nào hay là văn phòng."
    );
    console.error("Chạy khai-bao-ban-cai.cmd trước.");
    process.exit(1);
  }
  const laTau = !!site.vesselCode;

  console.log("=== NHẬP GÓI ĐỒNG BỘ ===");
  console.log(`File     : ${path.basename(duongDan)}`);
  console.log(`Từ       : ${goi.vesselCode ?? "văn phòng"}`);
  console.log(`Tạo lúc  : ${new Date(goi.taoLuc).toLocaleString("vi-VN")}`);
  console.log(`Số bản ghi: ${goi.soBanGhi}\n`);

  // Chặn nhập nhầm chiều — nhập gói của chính mình sẽ ghi đè dữ liệu mới bằng dữ liệu cũ.
  if (laTau && goi.huong === "TAU_LEN_VAN_PHONG") {
    console.error(
      "Gói này là dữ liệu TÀU GỬI LÊN, phải nhập ở văn phòng chứ không phải trên tàu."
    );
    process.exit(1);
  }
  if (!laTau && goi.huong === "VAN_PHONG_VE_TAU") {
    console.error(
      "Gói này là danh mục VĂN PHÒNG GỬI XUỐNG, phải nhập trên tàu chứ không phải ở văn phòng."
    );
    process.exit(1);
  }

  // Thứ tự nhập phải tôn trọng khóa ngoại — dùng đúng thứ tự lúc xuất.
  const thuTu =
    goi.huong === "TAU_LEN_VAN_PHONG"
      ? [...BANG_CUA_TAU.map((x) => x.ten), ...BANG_CON.map((x) => x.ten)]
      : BANG_DUNG_CHUNG.map((x) => x.ten);

  let tao = 0;
  let capNhat = 0;
  const loi: string[] = [];

  for (const ten of thuTu) {
    const rows = (goi.duLieu[ten] ?? []).map(khoiPhucKhiDoc) as Record<
      string,
      unknown
    >[];
    if (!rows.length) continue;
    let t = 0;
    let c = 0;
    for (const row of rows) {
      const id = row.id as number;
      try {
        const daCo = await b(ten).findUnique({ where: { id } });
        if (daCo) {
          await b(ten).update({ where: { id }, data: row });
          c++;
        } else {
          await b(ten).create({ data: row });
          t++;
        }
      } catch (e) {
        loi.push(`${ten}#${id}: ${(e as Error).message.split("\n")[0]}`);
      }
    }
    tao += t;
    capNhat += c;
    console.log(`  ${ten.padEnd(24)} tạo ${String(t).padStart(4)}  cập nhật ${String(c).padStart(4)}`);
  }

  // Đặt lại bộ đếm id: bản ghi nhập vào mang id có sẵn nên sequence không tự
  // nhảy theo. Đặt trong ĐÚNG DẢI của bản cài này — xem sqlDatLaiBoDem().
  const dauDai = Number(site.idRangeStart);
  for (const ten of thuTu) {
    const db = TEN_BANG_DB[ten];
    if (!db) continue;
    await prisma.$executeRawUnsafe(sqlDatLaiBoDem(db, dauDai));
  }

  // findFirst + update/create thay cho upsert: vesselCode cho phép null nên
  // không dùng được khóa unique ghép của Prisma.
  const mocNhan = await prisma.syncState.findFirst({
    where: { huong: "NHAN_VE", vesselCode: goi.vesselCode },
  });
  if (mocNhan) {
    await prisma.syncState.update({
      where: { id: mocNhan.id },
      data: { lastSyncAt: new Date(goi.taoLuc), lastCount: goi.soBanGhi },
    });
  } else {
    await prisma.syncState.create({
      data: {
        huong: "NHAN_VE",
        vesselCode: goi.vesselCode,
        lastSyncAt: new Date(goi.taoLuc),
        lastCount: goi.soBanGhi,
      },
    });
  }

  console.log(`\nTạo mới ${tao} · cập nhật ${capNhat} bản ghi.`);
  if (loi.length) {
    console.log(`\n${loi.length} bản ghi lỗi:`);
    for (const l of loi.slice(0, 15)) console.log("  - " + l);
    if (loi.length > 15) console.log(`  ... và ${loi.length - 15} lỗi nữa`);
  }
  await prisma.$disconnect();
  process.exit(loi.length ? 1 : 0);
}

main();
