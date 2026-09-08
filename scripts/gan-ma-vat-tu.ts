/**
 * Gán bộ phận · nhóm thiết bị · chức danh quản lý cho danh mục vật tư đang có,
 * và đề xuất mã theo quy ước mới (xem lib/maVatTu.ts).
 *
 * Chạy:
 *   gan-ma-vat-tu.cmd                → chỉ ĐỀ XUẤT, in ra xem trước, không sửa gì
 *   gan-ma-vat-tu.cmd --dong-y       → ghi ba cột phân loại vào database
 *
 * Script này KHÔNG đụng tới mã vật tư — đó là việc của doi-ma-vat-tu.cmd. Ba
 * cột phân loại chỉ là thông tin thêm, ghi vào không ảnh hưởng dữ liệu đang
 * chạy; còn mã thì đã in lên nhãn dán ngoài kho và nằm trên phiếu đã ký, phải
 * đổi bằng đúng một đường để không có hai nơi cùng sinh mã theo hai quy ước.
 *
 * Suy ra bộ phận/nhóm từ NHÓM VẬT TƯ của từng dòng — đó là thông tin phân loại
 * duy nhất mà file kiểm kê gốc mang theo. Dòng nào không suy ra được thì để
 * nguyên và liệt kê riêng, KHÔNG đoán bừa: gán nhầm chức danh là món hàng biến
 * mất khỏi danh sách kiểm kê của người thật sự đang giữ nó.
 */
import { prisma } from "@/lib/prisma";
import {
  CHUC_DANH,
  NHOM_THIET_BI,
  chuanHoaImpa,
  sinhMaImpa,
  sinhMaPhuTung,
  sinhMaVatTu,
  type BoPhan,
} from "@/lib/maVatTu";

/**
 * Nhóm vật tư trong danh mục → (bộ phận, nhóm thiết bị, chức danh giữ).
 *
 * Khớp theo mã nhóm (`Category.code`) chứ không theo tên: tên nhóm sửa được
 * trong giao diện, mã thì không.
 */
const THEO_NHOM: Record<
  string,
  { boPhan: BoPhan; nhom: string; chucDanh: string }
> = {
  // "@ME" = lấy họ máy chính THEO TÀU dùng món hàng đó (BME hay UEC), vì đội
  // tàu chạy cả hai họ. Xem giaiMa() bên dưới.
  "CAT-main-engine": { boPhan: "E", nhom: "@ME", chucDanh: "2E" },
  "CAT-aux-engine": { boPhan: "E", nhom: "AEG", chucDanh: "3E" },
  "CAT-oil-separator": { boPhan: "E", nhom: "PUR", chucDanh: "4E" },
  "CAT-air-compressor": { boPhan: "E", nhom: "CMP", chucDanh: "3E" },
  "CAT-bwms": { boPhan: "E", nhom: "BWM", chucDanh: "3E" },
  "CAT-sewage-treatment": { boPhan: "E", nhom: "SEW", chucDanh: "4E" },
  "CAT-water-tank": { boPhan: "E", nhom: "AUX", chucDanh: "4E" },
  "CAT-engine-stores": { boPhan: "E", nhom: "TOL", chucDanh: "CE" },
  // Điện là bộ phận RIÊNG (L), không nằm trong buồng máy nữa. Người giữ kho
  // điện trên đội tàu Mercury Lines là THỢ ĐIỆN, không phải máy ba.
  //
  // Tàu nào không có thợ điện thì đổi dòng này sang "ETO" (sĩ quan điện) hoặc
  // "2E"/"3E" — CHUC_DANH cho phép sĩ quan máy kiêm nhiệm bộ phận điện, nên cả
  // ba lựa chọn đều hợp lệ. Chỉ cần đổi ở đây rồi chạy lại script.
  "CAT-electrical-stores": { boPhan: "L", nhom: "ELS", chucDanh: "ELC" },
  "CAT-boong-deck": { boPhan: "D", nhom: "DST", chucDanh: "BSN" },
  // Phục vụ cũng là bộ phận riêng (C), người giữ là bếp trưởng.
  "CAT-phuc-vu-catering": { boPhan: "C", nhom: "UTN", chucDanh: "CCK" },
};

type DeXuat = {
  id: number;
  maCu: string;
  ten: string;
  boPhan: BoPhan;
  nhom: string;
  chucDanh: string;
  maMoi: string | null;
  ghiChu: string | null;
};

async function main() {
  const thatSu = process.argv.includes("--dong-y");
  // Cờ --doi-ma đã BỎ. Script này từng ghi đè mã theo một quy ước khác
  // (D-BSN-SPA-UEC-0001) trong khi danh mục đang chạy khuôn [bộ phận]-IMPA/SPR.
  // Để lại thì ai đó gõ nhầm một cờ là xáo trộn toàn bộ mã trong kho. Chặn hẳn
  // và chỉ sang đúng script lo việc mã.
  if (process.argv.includes("--doi-ma")) {
    console.error(
      "Cờ --doi-ma đã bỏ khỏi script này.\n\n" +
        "Script này chỉ gán BỘ PHẬN · NHÓM THIẾT BỊ · CHỨC DANH.\n" +
        "Đổi mã vật tư là việc của:  doi-ma-vat-tu.cmd"
    );
    process.exit(1);
  }

  const materials = await prisma.material.findMany({
    orderBy: { id: "asc" },
    include: {
      category: true,
      // Cần biết món hàng này đang dùng cho tàu nào, để suy ra họ máy chính.
      vesselMaterials: {
        include: {
          vessel: {
            select: { code: true, name: true, mainEngineGroup: true },
          },
        },
      },
    },
  });

  console.log("=== GAN MA VAT TU THEO CHUC DANH ===");
  console.log(
    thatSu
      ? "CHE DO: ghi phan loai (ma vat tu giu nguyen)"
      : "CHE DO: chi de xuat, khong sua gi"
  );
  console.log(`Danh muc: ${materials.length} vat tu\n`);

  const deXuat: DeXuat[] = [];
  const khongSuyDuoc: { code: string; ten: string; nhom: string }[] = [];
  // Số thứ tự đang dùng theo từng tiền tố, để mã phụ tùng không trùng nhau.
  const dem = new Map<string, number>();

  for (const m of materials) {
    const maNhom = m.category?.code ?? "";
    const luat = THEO_NHOM[maNhom];
    if (!luat) {
      khongSuyDuoc.push({
        code: m.code,
        ten: m.nameVn,
        nhom: m.category?.name ?? "(chưa có nhóm)",
      });
      continue;
    }

    // Nhóm thiết bị: bình thường lấy thẳng từ bảng ánh xạ, riêng phụ tùng máy
    // chính thì phải hỏi con tàu.
    let nhomThietBi = luat.nhom;
    let ghiChuNhom: string | null = null;
    if (nhomThietBi === "@ME") {
      const hoMay = [
        ...new Set(
          m.vesselMaterials
            .map((vm) => vm.vessel.mainEngineGroup)
            .filter((x): x is string => !!x)
        ),
      ];
      const tauChuaKhai = m.vesselMaterials
        .filter((vm) => !vm.vessel.mainEngineGroup)
        .map((vm) => vm.vessel.code);
      if (hoMay.length === 1) {
        nhomThietBi = hoMay[0];
        if (tauChuaKhai.length) {
          ghiChuNhom = `theo họ máy ${hoMay[0]}; tàu ${tauChuaKhai.join(", ")} chưa khai máy chính`;
        }
      } else if (hoMay.length > 1) {
        // Một part no. không thể vừa lắp MAN B&W vừa lắp UEC. Gặp trường hợp
        // này nghĩa là danh mục đang gộp hai mặt hàng khác nhau vào một dòng.
        ghiChuNhom = `dùng cho cả ${hoMay.join(" và ")} — phải tách thành hai dòng, mỗi họ máy một mã`;
        nhomThietBi = "";
      } else {
        ghiChuNhom = m.vesselMaterials.length
          ? `chưa khai máy chính cho tàu ${tauChuaKhai.join(", ")}`
          : "chưa gán cho tàu nào nên không biết máy chính họ nào";
        nhomThietBi = "";
      }
    }

    const impa = chuanHoaImpa(m.impa);
    let maMoi: string | null = null;
    let ghiChu: string | null = ghiChuNhom;

    // LOẠI HÀNG quyết định khuôn mã, và loại hàng lấy từ cột materialType chứ
    // KHÔNG suy từ "có mã IMPA hay không". Một cái bơm dự phòng vẫn là phụ
    // tùng dù nhà cung cấp có gán cho nó một mã IMPA; ngược lại, một cuộn băng
    // dính không có mã IMPA vẫn là vật tư tiêu hao chứ không phải phụ tùng.
    if (m.materialType === "SPARE") {
      if (!nhomThietBi) {
        // Không biết nhóm thì KHÔNG sinh mã: mã phụ tùng mà thiếu nhóm thiết bị
        // là mã không trả lời được câu "của máy nào".
        deXuat.push({
          id: m.id,
          maCu: m.code,
          ten: m.nameVn,
          boPhan: luat.boPhan,
          nhom: "",
          chucDanh: luat.chucDanh,
          maMoi: null,
          ghiChu,
        });
        continue;
      }
      const tienTo = `${luat.boPhan}-${luat.chucDanh}-SPA-${nhomThietBi}-`;
      const stt = (dem.get(tienTo) ?? 0) + 1;
      dem.set(tienTo, stt);
      const kq = sinhMaPhuTung({
        boPhan: luat.boPhan,
        chucDanh: luat.chucDanh,
        nhomThietBi,
        stt,
      });
      if ("ma" in kq) maMoi = kq.ma;
      else ghiChu = kq.loi;
    } else if (impa) {
      const kq = sinhMaImpa({
        boPhan: luat.boPhan,
        chucDanh: luat.chucDanh,
        impa,
      });
      if ("ma" in kq) maMoi = kq.ma;
      else ghiChu = kq.loi;
    } else {
      // Vật tư tiêu hao không có mã IMPA dùng được: đánh số thứ tự trong khuôn
      // STO. Gồm cả những dòng mà file kiểm kê gốc ghi mã cụt ("51.08...").
      const tienTo = `${luat.boPhan}-${luat.chucDanh}-STO-`;
      const stt = (dem.get(tienTo) ?? 0) + 1;
      dem.set(tienTo, stt);
      const kq = sinhMaVatTu({
        boPhan: luat.boPhan,
        chucDanh: luat.chucDanh,
        stt,
      });
      if ("ma" in kq) maMoi = kq.ma;
      else ghiChu = kq.loi;
      if (m.impa) {
        ghiChu = `mã IMPA "${m.impa}" không đủ 6 số — tạm xếp vào khuôn STO`;
      }
    }

    deXuat.push({
      id: m.id,
      maCu: m.code,
      ten: m.nameVn,
      boPhan: luat.boPhan,
      nhom: nhomThietBi,
      chucDanh: luat.chucDanh,
      maMoi,
      ghiChu,
    });
  }

  // ─── Tổng hợp theo chức danh: đây là con số người dùng cần nhất ───
  const theoChucDanh = new Map<string, number>();
  for (const d of deXuat) {
    theoChucDanh.set(d.chucDanh, (theoChucDanh.get(d.chucDanh) ?? 0) + 1);
  }
  console.log("Vat tu theo chuc danh quan ly:");
  for (const [cd, so] of [...theoChucDanh].sort((a, z) => z[1] - a[1])) {
    const t = CHUC_DANH[cd];
    console.log(`  ${cd.padEnd(4)} ${(t?.ten ?? cd).padEnd(20)} ${String(so).padStart(4)} mặt hàng`);
  }

  const theoLoai = new Map<string, number>();
  for (const d of deXuat) {
    const loai = d.maMoi?.split("-")[2] ?? "(khong sinh duoc)";
    theoLoai.set(loai, (theoLoai.get(loai) ?? 0) + 1);
  }
  console.log("\nVat tu theo loai hang (doan thu ba cua ma):");
  for (const [l, so] of [...theoLoai].sort((a, z) => z[1] - a[1])) {
    const ten =
      l === "IMP"
        ? "vat tu co ma IMPA"
        : l === "STO"
          ? "vat tu khong co ma IMPA"
          : l === "SPA"
            ? "phu tung thay the"
            : l;
    console.log(`  ${l.padEnd(4)} ${ten.padEnd(28)} ${String(so).padStart(4)}`);
  }

  const theoNhom = new Map<string, number>();
  for (const d of deXuat) theoNhom.set(d.nhom, (theoNhom.get(d.nhom) ?? 0) + 1);
  console.log("\nVat tu theo nhom thiet bi:");
  for (const [nh, so] of [...theoNhom].sort((a, z) => z[1] - a[1])) {
    console.log(
      `  ${nh.padEnd(4)} ${(NHOM_THIET_BI[nh]?.ten ?? nh).padEnd(38)} ${String(so).padStart(4)}`
    );
  }

  console.log("\nVi du ma moi (10 dong dau):");
  for (const d of deXuat.slice(0, 10)) {
    console.log(`  ${d.maCu.padEnd(14)} → ${(d.maMoi ?? "(không sinh được)").padEnd(20)} ${d.ten.slice(0, 40)}`);
  }

  const canXem = deXuat.filter((d) => d.ghiChu);
  if (canXem.length) {
    console.log(`\n${canXem.length} dong can xem lai:`);
    for (const d of canXem.slice(0, 10)) {
      console.log(`  ${d.maCu} — ${d.ten.slice(0, 40)}: ${d.ghiChu}`);
    }
    if (canXem.length > 10) console.log(`  ... va ${canXem.length - 10} dong nua`);
  }

  if (khongSuyDuoc.length) {
    console.log(`\n${khongSuyDuoc.length} dong KHONG suy ra duoc bo phan (nhom vat tu la):`);
    const nhomLa = new Set(khongSuyDuoc.map((x) => x.nhom));
    for (const n of nhomLa) {
      const so = khongSuyDuoc.filter((x) => x.nhom === n).length;
      console.log(`  "${n}": ${so} dong — them vao bang THEO_NHOM trong scripts/gan-ma-vat-tu.ts`);
    }
  }

  // Mã mới có bị trùng nhau không — phải biết TRƯỚC khi ghi.
  const dem2 = new Map<string, number>();
  for (const d of deXuat) {
    if (!d.maMoi) continue;
    dem2.set(d.maMoi, (dem2.get(d.maMoi) ?? 0) + 1);
  }
  const trung = [...dem2].filter(([, n]) => n > 1);
  if (trung.length) {
    console.log(`\n${trung.length} MA MOI BI TRUNG NHAU (thuong do hai dong cung mot ma IMPA):`);
    for (const [ma, n] of trung.slice(0, 10)) console.log(`  ${ma} × ${n}`);
    console.log("  → hai dong cung mot ma IMPA la cung mot mat hang, nen gop lai truoc.");
  }

  if (!thatSu) {
    console.log(
      "\nDay moi la de xuat. Doi chieu thay dung thi chay lai:\n" +
        "  gan-ma-vat-tu.cmd --dong-y     (ghi bo phan - nhom thiet bi - chuc danh)\n\n" +
        "Doi MA vat tu la viec cua mot script khac:\n" +
        "  doi-ma-vat-tu.cmd"
    );
    await prisma.$disconnect();
    return;
  }

  let ghi = 0;
  for (const d of deXuat) {
    await prisma.material.update({
      where: { id: d.id },
      data: {
        department: d.boPhan,
        // Không có nhóm (phụ tùng máy chính chưa xác định được họ máy) thì để
        // trống hẳn, đừng ghi chuỗi rỗng — trống là "chưa biết", còn chuỗi rỗng
        // trông như đã phân loại xong.
        equipGroup: d.nhom || null,
        responsibleRank: d.chucDanh,
      },
    });
    ghi++;
  }
  console.log(`\nDa ghi ${ghi} dong phan loai (ma vat tu giu nguyen).`);
  await prisma.$disconnect();
}

main();
