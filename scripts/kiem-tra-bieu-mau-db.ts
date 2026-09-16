/**
 * Kiểm tra vòng đi–về của tệp biểu mẫu trong database, KHÔNG để lại dữ liệu.
 *
 * Chạy:  npx tsx scripts/kiem-tra-bieu-mau-db.ts
 *
 * Việc cần chứng minh: cột Bytes nhận trọn 40 KB nhị phân và trả lại đúng từng
 * byte, rồi ExcelJS mở được bản đọc ra. Nghe hiển nhiên, nhưng đây đúng là chỗ
 * hay hỏng lặng lẽ — một tầng nào đó diễn giải dữ liệu thành chuỗi UTF-8 thì tệp
 * vẫn "lưu được", chỉ là lúc xuất mới vỡ, và lúc đó người bấm nút không phải
 * người tải lên.
 *
 * Ghi trong một giao dịch rồi cố ý ném lỗi để PostgreSQL cuộn ngược lại — chạy
 * bao nhiêu lần cũng không đụng tới bản biểu mẫu thật.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { MA_BIEU_MAU_KIEM_KE, MIME_BIEU_MAU } from "@/lib/bieuMau";

const prisma = new PrismaClient();
const MA_THU = `${MA_BIEU_MAU_KIEM_KE}--KIEM-THU`;

let dat = 0;
let truot = 0;
function kiemTra(ten: string, dung: boolean, chiTiet = "") {
  if (dung) {
    dat++;
    console.log(`  OK    ${ten}${chiTiet ? ` — ${chiTiet}` : ""}`);
  } else {
    truot++;
    console.log(`  TRUOT ${ten}${chiTiet ? ` — ${chiTiet}` : ""}`);
  }
}

class CuonNguoc extends Error {}

async function main() {
  const duongDan = path.join(process.cwd(), "templates", "MLS-11-06.xlsx");
  let gocBuffer: Buffer;
  try {
    gocBuffer = await readFile(duongDan);
  } catch {
    console.log(
      `Khong co ${duongDan} tren may nay — bo qua bai kiem (khong phai loi).`
    );
    return;
  }
  const gocHash = createHash("sha256").update(gocBuffer).digest("hex");
  console.log(`Tep goc: ${gocBuffer.length} byte, sha256 ${gocHash.slice(0, 16)}\n`);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.bieuMauTep.create({
        data: {
          code: MA_THU,
          fileName: "kiem-thu.xlsx",
          mimeType: MIME_BIEU_MAU,
          size: gocBuffer.length,
          sha256: gocHash,
          // Ép sang Uint8Array: kiểu Bytes của Prisma nhận Uint8Array<ArrayBuffer>,
          // còn readFile trả Buffer<ArrayBufferLike> — cùng dữ liệu, khác kiểu.
          data: new Uint8Array(gocBuffer),
          uploadedBy: "kiem-thu",
        },
      });
      const docLai = await tx.bieuMauTep.findUnique({
        where: { code: MA_THU },
        select: { data: true, size: true, sha256: true },
      });
      kiemTra("doc lai duoc ban vua ghi", Boolean(docLai));
      if (!docLai) throw new CuonNguoc();

      const veBuffer = Buffer.from(docLai.data);
      kiemTra(
        "so byte khong doi",
        veBuffer.length === gocBuffer.length,
        `${veBuffer.length} / ${gocBuffer.length}`
      );
      const veHash = createHash("sha256").update(veBuffer).digest("hex");
      kiemTra(
        "tung byte khong doi (sha256 trung)",
        veHash === gocHash,
        veHash.slice(0, 16)
      );

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(veBuffer as unknown as ArrayBuffer);
      const ws = wb.worksheets[0];
      kiemTra("ExcelJS mo duoc ban doc ra", Boolean(ws), ws ? `sheet "${ws.name}"` : "");
      // Đúng ô mà route xuất kiểm kê ghi vào — nếu template đổi bố cục thì thấy ngay.
      kiemTra(
        "o A11 van la tieu de bang",
        String(ws?.getCell("A11").value ?? "").trim() === "S. No.",
        String(ws?.getCell("A11").value ?? "")
      );
      throw new CuonNguoc();
    });
  } catch (e) {
    if (!(e instanceof CuonNguoc)) throw e;
  }

  const conSot = await prisma.bieuMauTep.findUnique({ where: { code: MA_THU } });
  kiemTra("giao dich da cuon nguoc, khong con ban kiem thu", conSot === null);

  console.log(`\n=== TONG: ${dat} dat / ${truot} truot ===`);
  if (truot) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
