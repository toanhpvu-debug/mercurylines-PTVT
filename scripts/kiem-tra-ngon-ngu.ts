/**
 * Kiểm tra từ điển hai ngôn ngữ (lib/i18n/dict).
 *
 * Chạy:  kiem-tra-ngon-ngu.cmd
 *
 * tsc đã ép hai bảng cùng bộ khóa; script này soát những thứ tsc không thấy:
 *   - chuỗi trống ở bất kỳ bảng nào;
 *   - tham số {ten} lệch nhau giữa hai bảng (vi có {n} mà en quên);
 *   - bảng tiếng Anh còn chép nguyên chuỗi tiếng Việt (có dấu tiếng Việt);
 *   - hàm tra(): lùi về tiếng Việt khi thiếu, trả về khóa khi không có.
 * Không đụng database.
 */
import { TU_DIEN, tra } from "@/lib/i18n";

let dat = 0;
let truot = 0;
const loi = (msg: string) => {
  truot++;
  console.log(`  TRUOT ${msg}`);
};

const CO_DAU_VIET =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/;
const thamSo = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

let tongKhoa = 0;
for (const [ns, bang] of Object.entries(TU_DIEN)) {
  const vi = bang.vi as Record<string, string>;
  const en = bang.en as Record<string, string>;
  for (const [k, v] of Object.entries(vi)) {
    tongKhoa++;
    const e = en[k];
    if (!v.trim()) loi(`${ns}.${k}: chuoi tieng Viet trong`);
    else if (e === undefined) loi(`${ns}.${k}: thieu ban tieng Anh`);
    else if (!e.trim()) loi(`${ns}.${k}: chuoi tieng Anh trong`);
    else if (thamSo(v) !== thamSo(e))
      loi(`${ns}.${k}: tham so lech — vi {${thamSo(v)}} / en {${thamSo(e)}}`);
    else if (CO_DAU_VIET.test(e))
      loi(`${ns}.${k}: ban tieng Anh con chu Viet: "${e}"`);
    else dat++;
  }
  for (const k of Object.keys(en)) {
    if (!(k in vi)) loi(`${ns}.${k}: co o tieng Anh ma khong co o tieng Viet`);
  }
}

console.log(`\nTu dien: ${Object.keys(TU_DIEN).length} khong gian ten, ${tongKhoa} khoa`);

// Hàm tra
function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  if (JSON.stringify(thuc) === JSON.stringify(mong)) dat++;
  else loi(`${ten}\n        duoc  ${JSON.stringify(thuc)}\n        mong  ${JSON.stringify(mong)}`);
}
kiemTra("tra vi", tra("vi", "chung.luu"), "Lưu");
kiemTra("tra en", tra("en", "chung.luu"), "Save");
kiemTra("tham so", tra("en", "dashboard.nCanhBao", { n: 3 }), "3 alerts");
kiemTra("tham so thieu giu nguyen", tra("vi", "dashboard.vatTuSo"), "Vật tư #{id}");
kiemTra("thieu khoa -> tra ve khoa", tra("en", "chung.khongCoKhoaNay"), "chung.khongCoKhoaNay");
kiemTra("sai khong gian ten -> tra ve khoa", tra("en", "xyz.abc"), "xyz.abc");

console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
process.exit(truot ? 1 : 0);
