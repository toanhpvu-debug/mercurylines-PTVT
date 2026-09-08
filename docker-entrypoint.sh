#!/bin/sh
set -e

mkdir -p /data

if [ -z "$SESSION_SECRET" ]; then
  if [ ! -f /data/.session-secret ]; then
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" > /data/.session-secret
  fi
  export SESSION_SECRET="$(cat /data/.session-secret)"
fi

npx prisma migrate deploy

# Trước đây chỗ này dùng cờ /data/.seeded để nhớ "đã seed rồi". Sai ở chỗ cờ nằm
# trong volume mercury-data (gắn vào /data của container web) còn dữ liệu nghiệp vụ
# nằm trong volume mercury-db của PostgreSQL — hai volume tách rời nhau. Chỉ cần
# dựng lại riêng container web mà không kèm volume cũ (docker run gõ tay, đổi tên
# volume, lỡ xóa mercury-data trong khi mercury-db vẫn còn) là cờ biến mất còn
# database thì vẫn đầy dữ liệu thật. Seed chạy lại khi đó sẽ dựng lại 15 tàu mẫu
# mà người dùng đã xóa, ghi đè materialType/equipment của các vật tư mẫu, và HỒI
# SINH ba tài khoản demo admin@/master@/crew@example.com kèm mật khẩu mặc định —
# tức là mở sẵn một lối đăng nhập cho người lạ.
#
# Vì vậy không tin vào cờ nữa mà hỏi thẳng database: đó là nguồn sự thật duy nhất
# luôn đi cùng chính dữ liệu cần bảo vệ, không thể lệch khỏi nó.
#
# Nhưng "có dữ liệu" KHÔNG đồng nghĩa "seed đã chạy XONG", và cờ /data/.seeded cũ
# tuy đặt sai chỗ thì vẫn diễn đạt đúng nghĩa đó (chỉ được ghi sau khi seed trả về 0).
# prisma/seed.ts ghi User trước tiên, rồi mới lần lượt tới Vessel, Warehouse, Category,
# Material, Supplier và SAU CÙNG là FormStandard. Seed vỡ ở đoạn giữa — mất kết nối một
# nhịp, container bị OOM-kill, hoặc người vận hành tưởng treo nên bấm Ctrl+C — là lần
# khởi động sau đã đếm được User khác 0. Nếu chỉ nhìn User/Vessel thì entrypoint sẽ báo
# "đã có dữ liệu" và BỎ QUA SEED VĨNH VIỄN: database kẹt ở trạng thái dở dang, đăng nhập
# được nhưng không có danh mục vật tư, không có nhà cung cấp, và FormStandard trống nên
# mọi lệnh in PO/RFQ đều không ra biểu mẫu — khởi động lại bao nhiêu lần cũng không tự
# khỏi, vì điều kiện luôn cho ra "co-du-lieu". Vì vậy phải hỏi thêm bảng mà seed ghi sau
# cùng: FormStandard có dòng nghĩa là seed đã chạy tới dòng cuối. Chạy lại một seed dở
# dang thì an toàn, mọi lệnh ghi trong seed.ts đều là upsert.
KET_QUA_DB="$(node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const soNguoiDung = await prisma.user.count();
  const soTau = await prisma.vessel.count();
  const soBieuMau = await prisma.formStandard.count();
  if (soNguoiDung === 0 && soTau === 0) {
    console.log("trong");
  } else if (soBieuMau === 0) {
    console.log("do-dang");
  } else {
    console.log("co-du-lieu");
  }
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
')"

# Chỉ lấy DÒNG CUỐI của stdout rồi mới so. Một bản @prisma/client hay một biến môi
# trường debug nào đó in thêm dòng vào stdout là phép so nguyên khối lệch ngay, mà
# nhánh lệch lại chính là nhánh bỏ qua seed — hỏng đúng chiều nguy hiểm nhất: bản cài
# hoàn toàn mới không có nổi một tài khoản để đăng nhập, còn log thì trấn an "đã có
# dữ liệu". Tách làm hai lệnh chứ không nối ống thẳng vào node: trong sh mã thoát của
# cả đường ống là mã thoát của `tail`, nối ống sẽ nuốt mất lỗi của node và vô hiệu
# hóa `set -e` ngay ở chỗ cần nó nhất.
TINH_TRANG_DB="$(printf '%s\n' "$KET_QUA_DB" | tail -n 1)"

# Hỏi hụt (mất kết nối, lệch schema) thì `set -e` cho container dừng ngay tại lệnh
# node ở trên. Cố tình không có nhánh "không biết thì cứ seed": đoán sai một lần là ghi
# đè dữ liệu thật, còn dừng lại chỉ tốn công đọc log. Nhánh `*` bên dưới theo đúng
# nguyên tắc đó — nhận về chuỗi lạ thì dừng hẳn, không im lặng rơi vào nhánh bỏ qua.
case "$TINH_TRANG_DB" in
  trong)
    echo "Database còn trống — nạp dữ liệu mẫu."
    npx prisma db seed
    ;;
  do-dang)
    echo "Seed lần trước chưa chạy xong (chưa có FormStandard) — chạy lại seed."
    npx prisma db seed
    ;;
  co-du-lieu)
    echo "Database đã có dữ liệu — bỏ qua seed."
    ;;
  *)
    echo "Không đọc được tình trạng database (nhận về: '$TINH_TRANG_DB') — dừng lại để tránh ghi đè dữ liệu thật." >&2
    exit 1
    ;;
esac

exec npm run start
