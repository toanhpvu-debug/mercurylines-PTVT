/**
 * Kiểm phần database của Phụ tùng thiết yếu MLS-11-04, KHÔNG để lại dữ liệu.
 *
 * Chạy:  node --conditions=react-server --import ./node_modules/tsx/dist/loader.mjs scripts/kiem-tra-thiet-yeu-db.ts
 * (cờ react-server để nạp được lib/thietYeuServer.ts có "server-only"; bộ
 * kiem-chung-nhanh.ps1 chạy mọi script theo cách này).
 *
 * Trong một giao dịch: tạo danh mục thử cho tàu đầu tiên (đọc từ tệp MLS-11-04
 * thật trên Desktop nếu có), một mục đã lưu tháng này, một mục chỉ có tháng
 * trước, một mục gắn mặt hàng đang có tồn kho trên tàu — rồi so bảng
 * layBangThietYeu dựng ra với số mong đợi, thử xóa-thay (số tháng xóa theo), và
 * cố ý ném lỗi để PostgreSQL cuộn ngược.
 */
import os from "node:os";
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { docHangMLS1104, soTuToiThieu, tachHang, thangHopLe, type MucThietYeuDoc } from "@/lib/thietYeu";
import { layBangThietYeu } from "@/lib/thietYeuServer";

const prisma = new PrismaClient();
let dat = 0;
let truot = 0;
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) {
    dat++;
    console.log(`  OK    ${ten}`);
  } else {
    truot++;
    console.log(`  TRUOT ${ten}\n    duoc: ${JSON.stringify(thuc)}\n    mong: ${JSON.stringify(mong)}`);
  }
}
class CuonNguoc extends Error {}

async function mucThu(): Promise<MucThietYeuDoc[]> {
  const desktop = path.join(os.homedir(), "Desktop");
  const tep = existsSync(desktop) ? readdirSync(desktop).find((f) => /^MLS-11-04 DM.*\.doc$/i.test(f)) : undefined;
  if (tep) {
    const { default: WordExtractor } = await import("word-extractor");
    const kq = docHangMLS1104(tachHang((await new WordExtractor().extract(path.join(desktop, tep))).getBody()));
    console.log(`  Doc ${tep}: ${kq.muc.length} muc`);
    return kq.muc;
  }
  const m = (stt: string, moTa: string): MucThietYeuDoc => ({ nhom: "A. Thu", stt, moTa, partNo: null, toiThieu: "01 set", toiThieuSo: 1, tonDau: null, nhan: null, tieuThu: null, hienCo: null, viTri: null });
  return [m("1", "Muc 1"), m("2", "Muc 2"), m("3", "Muc 3"), m("4", "Muc 4")];
}

async function main() {
  const tau = await prisma.vessel.findFirst({ orderBy: { code: "asc" }, select: { id: true, code: true } });
  if (!tau) {
    console.log("Chua co tau nao — bo qua (khong phai loi).");
    return;
  }
  // Mặt hàng đang có tồn trong kho của tàu này (để thử nguồn KHO).
  const ton = await prisma.inventory.findFirst({
    where: { warehouse: { vesselId: tau.id }, quantity: { gt: 0 } },
    select: { materialId: true },
  });
  const muc = await mucThu();
  const thang = thangHopLe(null);
  const [y, mo] = thang.split("-").map(Number);
  const thangTruoc = `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, "0")}`;
  console.log(`  Tau ${tau.code}, thang ${thang}, thang truoc ${thangTruoc}, ton kho thu: ${ton ? `material #${ton.materialId}` : "khong co"}`);

  try {
    await prisma.$transaction(
      async (tx) => {
        const truocDo = await tx.phuTungThietYeu.count({ where: { vesselId: tau.id } });
        const ids: number[] = [];
        for (let i = 0; i < muc.length; i++) {
          const m = muc[i];
          const moi = await tx.phuTungThietYeu.create({
            data: {
              vesselId: tau.id,
              nhom: m.nhom,
              thuTu: 100000 + i,
              stt: m.stt,
              moTa: m.moTa,
              partNo: m.partNo,
              toiThieu: m.toiThieu,
              toiThieuSo: m.toiThieuSo,
              hienCo: i === 3 ? 7 : null,
              materialId: i === 2 && ton ? ton.materialId : null,
            },
            select: { id: true },
          });
          ids.push(moi.id);
        }
        await tx.phuTungThietYeuThang.create({ data: { itemId: ids[0], thang, tonDau: 2, nhan: 1, tieuThu: 1, hienCo: 2, viTri: "Kho may" } });
        await tx.phuTungThietYeuThang.create({ data: { itemId: ids[1], thang: thangTruoc, hienCo: 4, viTri: "Ke A" } });

        const bang = (await layBangThietYeu(tau.id, thang, tx)).filter((d) => ids.includes(d.id));
        kiemTra("so dong = so muc da tao", bang.length, muc.length);
        kiemTra("giu thu tu nhap", bang.map((d) => d.id), ids);
        const [d0, d1, d2, d3] = bang;
        kiemTra("muc 1: DA_LUU dung so", [d0.nguon, d0.tonDau, d0.nhan, d0.tieuThu, d0.hienCo, d0.viTri], ["DA_LUU", 2, 1, 1, 2, "Kho may"]);
        kiemTra("muc 2: UOC theo thang truoc", [d1.nguon, d1.tonDau, d1.nhan, d1.tieuThu, d1.hienCo, d1.viTri], ["UOC", 4, null, null, 4, "Ke A"]);
        if (ton) {
          const tong = await tx.inventory.aggregate({ where: { warehouse: { vesselId: tau.id }, materialId: ton.materialId }, _sum: { quantity: true } });
          const sauThang = await tx.inventoryTransaction.count({ where: { vesselId: tau.id, materialId: ton.materialId, occurredAt: { gte: new Date(y, mo, 1) } } });
          kiemTra("muc 3: nguon KHO", d2.nguon, "KHO");
          if (sauThang === 0) kiemTra("muc 3: hien co = ton kho hien tai", d2.hienCo, Math.round((tong._sum.quantity ?? 0) * 100) / 100);
          kiemTra("muc 3: ban dau = cuoi - nhan + dung", d2.tonDau, Math.round(((d2.hienCo ?? 0) - (d2.nhan ?? 0) + (d2.tieuThu ?? 0)) * 100) / 100);
          kiemTra("muc 3: ma vat tu gan kho", typeof d2.maVatTu, "string");
        }
        kiemTra("muc 4: UOC tu so luc nhap", [d3.nguon, d3.tonDau, d3.hienCo], ["UOC", 7, 7]);
        kiemTra("toi thieu quy doi", bang.every((d) => d.toiThieuSo === soTuToiThieu(d.toiThieu)), true);

        // Truy vấn của Dashboard.
        const dash = await tx.phuTungThietYeu.count({ where: { vesselId: tau.id, toiThieuSo: { gt: 0 }, id: { in: ids } } });
        kiemTra("dashboard dem muc co toi thieu", dash, muc.filter((m) => m.toiThieuSo > 0).length);

        // Upsert tháng (lưu lại lần hai không tạo bản trùng).
        await tx.phuTungThietYeuThang.upsert({
          where: { itemId_thang: { itemId: ids[0], thang } },
          update: { hienCo: 1 },
          create: { itemId: ids[0], thang, hienCo: 1 },
        });
        kiemTra("upsert thang khong trung", await tx.phuTungThietYeuThang.count({ where: { itemId: ids[0] } }), 1);

        // Thay danh mục: xóa mục thì số tháng xóa theo (FK cascade).
        await tx.phuTungThietYeu.deleteMany({ where: { id: { in: ids } } });
        kiemTra("xoa muc → xoa so thang", await tx.phuTungThietYeuThang.count({ where: { itemId: { in: ids } } }), 0);
        kiemTra("danh muc cu cua tau con nguyen", await tx.phuTungThietYeu.count({ where: { vesselId: tau.id } }), truocDo);
        throw new CuonNguoc();
      },
      { timeout: 120_000, maxWait: 20_000 }
    );
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }
  kiemTra(
    "da cuon nguoc (khong con muc thu)",
    await prisma.phuTungThietYeu.count({ where: { vesselId: tau.id, thuTu: { gte: 100000 } } }),
    0
  );
}

main()
  .catch((e) => {
    truot++;
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
    process.exit(truot ? 1 : 0);
  });
