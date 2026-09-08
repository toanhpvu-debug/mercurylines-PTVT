/**
 * Xóa dữ liệu mẫu để bắt đầu nhập dữ liệu thật của đội tàu.
 *
 * Chạy:
 *   lam-sach-du-lieu-mau.cmd                    → chỉ LIỆT KÊ sẽ xóa gì, không đụng dữ liệu
 *   lam-sach-du-lieu-mau.cmd --dong-y           → xóa thật (nhóm mặc định)
 *   lam-sach-du-lieu-mau.cmd --nhom=son,dau     → chọn nhóm khác mặc định
 *   lam-sach-du-lieu-mau.cmd --xoa-tau=MLS-008   → xóa hẳn một/nhiều tàu (kèm kho và tồn của nó)
 *
 * Vì sao mặc định là chạy thử: đây là lệnh KHÔNG hoàn tác được. Người dùng gõ
 * nhầm một tham số mà lệnh xóa ngay thì mất dữ liệu thật. Chạy thử in ra đúng
 * số dòng của từng bảng để đối chiếu trước, rồi mới thêm --dong-y.
 *
 * Không bao giờ đụng tới: tài khoản người dùng, biểu mẫu công ty, và cấu hình
 * bản cài (SiteConfig, SyncState). Đó là những thứ khai một lần lúc cài, xóa đi
 * là phải khai lại toàn bộ chứ không phải "làm sạch".
 */
import { prisma } from "@/lib/prisma";
import { TEN_BANG_DB, sqlDatLaiBoDem } from "@/lib/sync";

/* eslint-disable @typescript-eslint/no-explicit-any */
const b = (ten: string) => (prisma as any)[ten];

/**
 * Nhóm dữ liệu và THỨ TỰ XÓA trong từng nhóm: con trước, cha sau. Xóa cha
 * trước là vấp khóa ngoại, mà vấp giữa chừng thì dữ liệu còn lại dở dang.
 */
const NHOM: Record<string, { mo_ta: string; bang: string[] }> = {
  "vat-tu": {
    mo_ta: "Vật tư, nhóm vật tư, tồn kho, giao dịch, yêu cầu, đơn mua",
    bang: [
      "inventoryTransaction",
      "inventory",
      "vesselMaterial",
      "materialRequestEvent",
      "materialRequestItem",
      "purchaseOrderItem",
      "purchaseOrder",
      "materialRequest",
      "material",
      "category",
    ],
  },
  "nha-cung-cap": {
    mo_ta: "Nhà cung cấp",
    bang: ["supplier"],
  },
  "chang-buoc": {
    mo_ta: "Dụng cụ chằng buộc container và báo cáo kiểm đếm",
    bang: ["lashingReportLine", "lashingReport", "lashingGear"],
  },
  son: {
    mo_ta: "Sơn: danh mục, tồn, khu vực, sơ đồ, nhật ký thi công",
    bang: [
      "paintJobLine",
      "paintJob",
      "paintTransaction",
      "paintStock",
      "paintSchemeLayer",
      "paintArea",
      "paintProduct",
    ],
  },
  dau: {
    mo_ta: "Dầu đốt · dầu nhờn · hóa chất: danh mục, tồn, phiếu nhận, tiêu thụ",
    bang: [
      "consumableTransaction",
      "consumableReceipt",
      "consumableStock",
      "consumableProduct",
    ],
  },
  "bao-cao": {
    mo_ta: "File báo cáo tàu đã tải lên (bản ghi; file trong uploads/ giữ nguyên)",
    bang: ["reportDocument"],
  },
  kho: {
    mo_ta: "Kho của từng tàu",
    bang: ["warehouse"],
  },
};

const NHOM_MAC_DINH = ["vat-tu", "nha-cung-cap", "chang-buoc"];

function thamSo(ten: string): string | null {
  const arg = process.argv.slice(2).find((a) => a.startsWith(`--${ten}=`));
  return arg ? arg.slice(ten.length + 3) : null;
}

async function main() {
  const thatSu = process.argv.includes("--dong-y");
  const chonNhom = thamSo("nhom");
  const nhomChay = chonNhom ? chonNhom.split(",").map((x) => x.trim()) : NHOM_MAC_DINH;
  const maTau = (thamSo("xoa-tau") ?? "")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);

  for (const n of nhomChay) {
    if (!NHOM[n]) {
      console.error(
        `Không có nhóm "${n}". Các nhóm: ${Object.keys(NHOM).join(", ")}`
      );
      process.exit(1);
    }
  }

  console.log("=== LÀM SẠCH DỮ LIỆU MẪU ===");
  console.log(thatSu ? "CHẾ ĐỘ: XÓA THẬT" : "CHẾ ĐỘ: chạy thử (không xóa gì)");
  console.log("");

  // Đếm trước để in ra và để so lại sau khi xóa.
  let tong = 0;
  for (const n of nhomChay) {
    const { mo_ta, bang } = NHOM[n];
    console.log(`${n} — ${mo_ta}`);
    for (const ten of bang) {
      const so = await b(ten).count();
      tong += so;
      if (so) console.log(`  ${ten.padEnd(24)} ${so}`);
    }
  }

  const tauXoa = maTau.length
    ? await prisma.vessel.findMany({ where: { code: { in: maTau } } })
    : [];
  if (maTau.length) {
    console.log("\nxóa hẳn tàu:");
    for (const ma of maTau) {
      const v = tauXoa.find((x) => x.code === ma);
      console.log(v ? `  ${v.code} — ${v.name}` : `  ${ma} — KHÔNG THẤY, bỏ qua`);
    }
    tong += tauXoa.length;
  }

  if (tong === 0) {
    console.log("\nKhông có dòng nào để xóa.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\nTổng cộng ${tong} dòng.`);
  console.log("Giữ nguyên: tài khoản người dùng, biểu mẫu công ty, cấu hình bản cài.");
  if (!nhomChay.includes("kho") && !maTau.length) {
    console.log("Giữ nguyên: tàu và kho của từng tàu.");
  }

  if (!thatSu) {
    console.log(
      "\nĐây mới là chạy thử. Đối chiếu số ở trên, thấy đúng thì chạy lại kèm --dong-y:\n" +
        `  lam-sach-du-lieu-mau.cmd --dong-y${chonNhom ? ` --nhom=${chonNhom}` : ""}${
          maTau.length ? ` --xoa-tau=${maTau.join(",")}` : ""
        }`
    );
    console.log("\nSao lưu trước khi xóa: sao-luu-du-lieu.cmd");
    await prisma.$disconnect();
    return;
  }

  // Xóa trong MỘT transaction: hỏng giữa chừng thì quay lại nguyên trạng, chứ
  // không để lại một database xóa được nửa chừng.
  console.log("\nĐang xóa...");
  const daXoa: [string, number][] = [];
  await prisma.$transaction(async (tx) => {
    const t = (ten: string) => (tx as any)[ten];
    for (const n of nhomChay) {
      for (const ten of NHOM[n].bang) {
        const kq = await t(ten).deleteMany({});
        if (kq.count) daXoa.push([ten, kq.count]);
      }
    }
    // Tàu xóa sau cùng: kho, tồn, giao dịch của nó phải đi trước. Những bảng
    // gắn tàu đều khai onDelete: Cascade nên xóa tàu là dọn theo, nhưng chỉ khi
    // các nhóm ở trên đã xóa xong phần dùng chung.
    for (const v of tauXoa) {
      await tx.vessel.delete({ where: { id: v.id } });
      daXoa.push([`vessel:${v.code}`, 1]);
    }
  });

  for (const [ten, so] of daXoa) {
    console.log(`  ${ten.padEnd(24)} xóa ${so}`);
  }

  // Đặt lại bộ đếm id trong ĐÚNG dải của bản cài này, để dữ liệu thật nhập vào
  // bắt đầu từ đầu dải chứ không nối tiếp id của dữ liệu mẫu vừa xóa.
  const site = await prisma.siteConfig.findUnique({ where: { id: 1 } });
  const dauDai = site ? Number(site.idRangeStart) : 0;
  for (const ten of new Set(nhomChay.flatMap((n) => NHOM[n].bang))) {
    const db = TEN_BANG_DB[ten];
    if (db) await prisma.$executeRawUnsafe(sqlDatLaiBoDem(db, dauDai));
  }
  console.log(
    `\nĐã đặt lại bộ đếm id trong dải của bản cài (${dauDai > 0 ? `từ ${dauDai.toLocaleString("vi-VN")}` : "văn phòng: 1 → 999.999"}).`
  );

  console.log("\nXong. Giờ nhập dữ liệu thật: /materials/import cho danh mục vật tư.");
  await prisma.$disconnect();
}

main();
