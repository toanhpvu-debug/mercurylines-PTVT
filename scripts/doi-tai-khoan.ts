/**
 * Đổi email, mật khẩu hoặc tên của một tài khoản.
 *
 * Chạy:
 *   doi-tai-khoan.cmd admin@example.com --email-moi=admin@mercurylines.com
 *   doi-tai-khoan.cmd admin@mercurylines.com --mat-khau
 *   doi-tai-khoan.cmd master@example.com --ten="Nguyễn Văn A" --mat-khau
 *
 * Vì sao cần script này: trong app KHÔNG có chỗ nào đổi mật khẩu. Trang Người
 * dùng chỉ đặt mật khẩu lúc tạo tài khoản, sau đó thì chịu. Quên mật khẩu quản
 * trị là mất luôn đường vào hệ thống, mà đây là app quản lý vật tư của cả đội
 * tàu — không có đường vòng nào khác.
 *
 * Mật khẩu KHÔNG nhận qua tham số dòng lệnh mà gõ vào lúc chạy: tham số dòng
 * lệnh nằm lại trong lịch sử lệnh (doskey, PSReadLine) và hiện ra trong danh
 * sách tiến trình đang chạy. Gõ vào thì không để lại dấu vết nào.
 *
 * Mọi lần đổi đều ghi vào nhật ký thao tác (bảng AuditLog) — nội dung mật khẩu
 * thì không, đương nhiên.
 */
import { createInterface } from "readline";
import { stdin, stdout } from "process";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

const DINH_DANG_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAI_TOI_THIEU = 8;

function thamSo(ten: string): string | null {
  const arg = process.argv.slice(2).find((a) => a.startsWith(`--${ten}=`));
  return arg ? arg.slice(ten.length + 3) : null;
}

/** Đọc một dòng từ bàn phím. Không che ký tự — xem ghi chú ở nơi gọi. */
function hoi(cauHoi: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  return new Promise((tra) => {
    rl.question(cauHoi, (dap) => {
      rl.close();
      tra(dap);
    });
  });
}

/**
 * Đọc mật khẩu khi lệnh được gọi từ script khác (stdin là ống dẫn, không phải
 * bàn phím) — dùng cho việc tự động hóa: `echo matkhau | doi-tai-khoan.cmd ...`.
 *
 * Không hỏi lại lần hai ở đường này: bên gọi đã biết chính xác chuỗi mình gửi,
 * hỏi lại chỉ là hỏi cùng một biến hai lần.
 */
function docTuOngDan(): Promise<string> {
  return new Promise((tra) => {
    let buf = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (x) => (buf += x));
    stdin.on("end", () => {
      // Bỏ BOM và ký tự xuống dòng: PowerShell ghi ra ống dẫn kèm BOM UTF-8,
      // và mỗi hệ điều hành kết thúc dòng một kiểu. Không dọn thì mật khẩu lưu
      // vào database dài hơn chuỗi người ta gõ đúng một ký tự vô hình — đăng
      // nhập sẽ sai mà không ai hiểu vì sao.
      const dong = buf.replace(/^﻿/, "").split("\n")[0] ?? "";
      tra(dong.replace(/\r$/, ""));
    });
  });
}

async function main() {
  const emailHienTai = process.argv
    .slice(2)
    .find((a) => !a.startsWith("--"))
    ?.trim()
    .toLowerCase();
  if (!emailHienTai) {
    console.error(
      "Thiếu email của tài khoản cần đổi.\n\n" +
        "  doi-tai-khoan.cmd admin@example.com --email-moi=admin@mercurylines.com\n" +
        "  doi-tai-khoan.cmd admin@mercurylines.com --mat-khau\n" +
        '  doi-tai-khoan.cmd crew@example.com --ten="Nguyễn Văn A"'
    );
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: emailHienTai } });
  if (!user) {
    const ds = await prisma.user.findMany({
      select: { email: true, role: true },
      orderBy: { id: "asc" },
    });
    console.error(
      `Không thấy tài khoản "${emailHienTai}". Các tài khoản đang có:\n` +
        ds.map((u) => `  ${u.email} (${u.role})`).join("\n")
    );
    process.exit(1);
  }

  const emailMoi = thamSo("email-moi")?.trim().toLowerCase() || null;
  const tenMoi = thamSo("ten")?.trim() || null;
  const doiMatKhau = process.argv.includes("--mat-khau");

  if (!emailMoi && !tenMoi && !doiMatKhau) {
    console.error(
      "Không có gì để đổi. Thêm --email-moi=… , --ten=… hoặc --mat-khau."
    );
    process.exit(1);
  }

  if (emailMoi) {
    if (!DINH_DANG_EMAIL.test(emailMoi)) {
      console.error(`Email "${emailMoi}" không hợp lệ.`);
      process.exit(1);
    }
    const trung = await prisma.user.findUnique({ where: { email: emailMoi } });
    if (trung && trung.id !== user.id) {
      console.error(`Email "${emailMoi}" đã có tài khoản khác dùng.`);
      process.exit(1);
    }
  }

  console.log("=== ĐỔI TÀI KHOẢN ===");
  console.log(`Tài khoản : ${user.email} (${user.role}) — ${user.name}`);
  if (emailMoi) console.log(`Email mới : ${emailMoi}`);
  if (tenMoi) console.log(`Tên mới   : ${tenMoi}`);

  let bam: string | null = null;
  if (doiMatKhau) {
    // Gõ hai lần và so lại: gõ nhầm một ký tự mà chỉ hỏi một lần thì người ta
    // khóa chính mình ra ngoài, và không có đường nào vào để sửa.
    const goTay = !!stdin.isTTY;
    const lan1 = goTay
      ? await hoi("Mật khẩu mới (ít nhất 8 ký tự): ")
      : await docTuOngDan();
    if (lan1.length < DAI_TOI_THIEU) {
      console.error(`\nMật khẩu phải có ít nhất ${DAI_TOI_THIEU} ký tự.`);
      process.exit(1);
    }
    if (goTay) {
      const lan2 = await hoi("Gõ lại mật khẩu:               ");
      if (lan1 !== lan2) {
        console.error("\nHai lần gõ không giống nhau. Chưa đổi gì cả.");
        process.exit(1);
      }
    }
    bam = await bcrypt.hash(lan1, 10);
    console.log(`Mật khẩu mới: ${lan1.length} ký tự (không in ra nội dung).`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(emailMoi ? { email: emailMoi } : {}),
      ...(tenMoi ? { name: tenMoi } : {}),
      ...(bam ? { password: bam } : {}),
    },
  });

  // Ghi nhật ký: đổi tài khoản quản trị là thao tác phải truy lại được sau này.
  // Chỉ ghi ĐÃ ĐỔI GÌ, không ghi mật khẩu.
  const daDoi = [
    emailMoi ? `email ${user.email} → ${emailMoi}` : null,
    tenMoi ? `tên "${user.name}" → "${tenMoi}"` : null,
    bam ? "mật khẩu" : null,
  ].filter(Boolean);
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      email: emailMoi ?? user.email,
      role: user.role,
      method: "SCRIPT",
      path: "doi-tai-khoan.cmd",
      action: "doi-tai-khoan",
      detail: `Đổi ${daDoi.join(" · ")} (chạy từ dòng lệnh trên máy chủ)`,
    },
  });

  console.log(`\nĐã đổi: ${daDoi.join(" · ")}.`);
  if (bam) {
    console.log(
      "Phiên đăng nhập cũ vẫn còn hiệu lực tới khi hết hạn — muốn cắt ngay thì" +
        "\nkhóa rồi mở lại tài khoản ở trang Người dùng."
    );
  }
  await prisma.$disconnect();
}

main();
