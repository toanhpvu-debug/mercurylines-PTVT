/**
 * Đối chiếu luật SỬA / HỦY / XÓA yêu cầu vật tư trên dữ liệu THẬT.
 *
 * Chạy:  npx tsx scripts/kiem-tra-sua-yeu-cau.ts
 *
 * Bài kiểm ma trận phân quyền (kiem-tra-phan-quyen.ts) đã phủ hàm canEditRequest
 * bằng dữ liệu dựng tay. File này bổ sung đúng phần bài kia không chạm tới: các
 * TRUY VẤN mà server action và API route sẽ chạy — đếm dòng đơn mua trỏ vào một
 * yêu cầu — có thật sự chạy được trên schema hiện tại không, và với dữ liệu đang
 * có thì mỗi yêu cầu rơi vào nhánh nào. Một truy vấn Prisma sai quan hệ vẫn qua
 * được tsc nhưng vỡ lúc chạy.
 *
 * Chỉ ĐỌC, không ghi gì. Không in bí mật kết nối.
 */
import { PrismaClient } from "@prisma/client";
import { canEditRequest } from "@/lib/roles";
import { REQUEST_ALLOWED_FROM } from "@/lib/requestStatus";

const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.materialRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      requestNo: true,
      vesselId: true,
      status: true,
      requestedById: true,
      _count: { select: { items: true } },
    },
  });
  if (!requests.length) {
    console.log("Khong co yeu cau nao trong database — bo qua.");
    return;
  }

  // Đúng truy vấn mà deleteMaterialRequest và updateRequestStatus sẽ chạy.
  const soDongDonMua = new Map<number, number>();
  for (const r of requests) {
    soDongDonMua.set(
      r.id,
      await prisma.purchaseOrderItem.count({
        where: {
          requestItem: { requestId: r.id },
          po: { status: { not: "CANCELLED" } },
        },
      })
    );
  }

  const admin = { id: -1, role: "ADMIN", vesselId: null };
  console.log(
    "so yeu cau".padEnd(22) +
      "trang thai".padEnd(22) +
      "dong".padEnd(6) +
      "PO".padEnd(4) +
      "admin sua".padEnd(11) +
      "huy duoc"
  );
  console.log("-".repeat(78));
  for (const r of requests) {
    const po = soDongDonMua.get(r.id) ?? 0;
    const suaDuoc = canEditRequest(admin, r);
    const huyTheoTrangThai = REQUEST_ALLOWED_FROM.CANCELLED.includes(r.status);
    // Hủy từ IN_PROCUREMENT còn phải không vướng dòng đơn mua — đúng luật ở
    // updateRequestStatus.
    const huyDuoc =
      huyTheoTrangThai && !(r.status === "IN_PROCUREMENT" && po > 0);
    console.log(
      r.requestNo.padEnd(22) +
        r.status.padEnd(22) +
        String(r._count.items).padEnd(6) +
        String(po).padEnd(4) +
        (suaDuoc ? "co" : "khong").padEnd(11) +
        (huyDuoc ? "co" : "khong")
    );
  }
  console.log(
    "\nTruy van dem dong don mua chay duoc tren schema hien tai: OK" +
      `\nDa doc ${requests.length} yeu cau, khong ghi gi.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
