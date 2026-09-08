import "server-only";

/**
 * Chặn dò mật khẩu ở /login.
 *
 * Vì sao phải có:
 *
 *  - /login là endpoint DUY NHẤT không cần xác thực mà vẫn ghi được vào
 *    database. Mỗi lần gõ sai là một dòng AuditLog. Không có gì chặn thì một
 *    script chạy qua đêm bơm hàng triệu dòng vào bảng nhật ký — bảng mà quản
 *    trị phải đọc khi có sự cố thật, và là bảng lớn nhất trong bản sao lưu.
 *  - Mỗi lần thử tốn một `bcrypt.compare`. Hàm này cố ý chậm (đó là điểm mạnh
 *    của nó khi lưu mật khẩu) nhưng chạy đồng bộ trên CPU, nên nó cũng là cách
 *    rẻ nhất để một người lạ làm cả app đứng với mọi người còn lại.
 *
 * Giữ trong BỘ NHỚ của tiến trình, cố ý không ghi database: đếm số lần gõ sai
 * mà phải ghi database thì chính việc chống bơm dữ liệu lại đi bơm dữ liệu.
 * Đổi lại, khởi động lại app là mất hết bộ đếm, và nếu sau này chạy nhiều bản
 * song song (nhiều container sau load balancer) thì mỗi bản đếm riêng — trần
 * thật sự nhân lên theo số bản. Bản cài hiện tại chạy MỘT tiến trình `next
 * start`, nên chưa phải lo; ngày nào dựng thêm bản thứ hai thì chỗ này phải
 * chuyển sang Redis, đừng để nó âm thầm mất tác dụng.
 */

// Bao lâu không gõ sai thì quên hết những lần sai trước. Người quên mật khẩu
// gõ sai 3 lần lúc sáng rồi trưa gõ sai 3 lần nữa không nên bị cộng dồn thành
// 6 — đó là người dùng thật đang chật vật, không phải máy dò.
const CUA_SO_MS = 15 * 60_000;

// Khóa theo EMAIL: chặn dò mật khẩu của một tài khoản cụ thể.
//
// Khóa theo email (chứ không theo cặp email+IP) có một cái giá phải nói rõ:
// người lạ biết email của thuyền trưởng có thể cố tình gõ sai 8 lần để khóa
// tài khoản ấy 5 phút. Vẫn chọn cách này vì cách kia — khóa theo cặp
// email+IP — vô dụng đúng ở nơi app này chạy: cả văn phòng ra Internet bằng
// một địa chỉ NAT duy nhất, nên "cặp email+IP" thực chất vẫn là "email".
// Bù lại, giữ thời gian khóa NGẮN (5 phút) để người dùng thật chỉ mất một
// tách cà phê, còn máy dò thì tụt xuống 8 lần thử mỗi 5 phút.
const TRAN_EMAIL = 8;
const KHOA_EMAIL_MS = 5 * 60_000;

// Khóa theo IP: đây mới là thứ CHẶN ĐƯỢC bảng nhật ký phình to.
//
// Trần theo email không chặn được: script gửi mỗi email một lần cho một triệu
// email khác nhau thì không email nào chạm trần 8, mà vẫn ghi đủ một triệu
// dòng. Trần theo IP thì chặn được — mỗi địa chỉ ghi nhiều nhất 41 dòng mỗi
// 15 phút, tức khoảng 4.000 dòng một ngày kể cả khi bị dò cả ngày.
//
// 40 đặt rộng có chủ ý: cả công ty đi chung một địa chỉ NAT, sáng thứ Hai vài
// chục người gõ sai mật khẩu là chuyện có thật, không nên khóa cả văn phòng.
const TRAN_IP = 40;
const KHOA_IP_MS = 15 * 60_000;

// Trần số khóa giữ trong bộ nhớ. Bản thân bộ đếm cũng là chỗ để bơm: người lạ
// gửi mỗi lần một email khác nhau thì mỗi email sinh một khóa mới, và cái Map
// này lớn dần cho tới khi hết RAM — đúng kiểu lỗi mà đoạn mã chống bơm dữ liệu
// tự tạo ra cho mình. 10.000 khóa ≈ vài MB, dư xa cho một đội tàu vài chục
// người, và khi chạm trần thì xóa bớt khóa CŨ NHẤT (xem ghiNhan).
const TRAN_SO_KHOA = 10_000;

type BoDem = {
  /** Số lần gõ sai kể từ lần cuối được xóa. */
  hong: number;
  /** Thời điểm lần gõ sai gần nhất — dùng để quên dần theo CUA_SO_MS. */
  lanCuoi: number;
  /** Khóa tới thời điểm này (ms). 0 nghĩa là không bị khóa. */
  khoaDen: number;
  /** Đã ghi một dòng nhật ký cho lần khóa này chưa. */
  daGhiKhoa: boolean;
};

const theoEmail = new Map<string, BoDem>();
const theoIp = new Map<string, BoDem>();

function moi(): BoDem {
  return { hong: 0, lanCuoi: 0, khoaDen: 0, daGhiKhoa: false };
}

/**
 * Lấy bộ đếm và tự dọn nếu đã quá cửa sổ.
 *
 * Luôn `delete` rồi `set` lại chứ không sửa tại chỗ: Map giữ nguyên thứ tự
 * CHÈN, nên xóa-rồi-chèn biến thứ tự chèn thành thứ tự dùng gần đây. Nhờ vậy
 * lúc chạm TRAN_SO_KHOA chỉ cần xóa từ đầu Map là bỏ đúng những khóa nguội
 * nhất, không phải quét hay sắp xếp gì.
 */
function layVaDon(bang: Map<string, BoDem>, khoa: string, bayGio: number): BoDem {
  const cu = bang.get(khoa);
  bang.delete(khoa);
  if (!cu) return moi();
  // Còn trong thời gian khóa thì giữ nguyên, dù đã quá cửa sổ đếm.
  if (bayGio < cu.khoaDen) return cu;
  // Hết khóa, hoặc im lặng đủ lâu → đếm lại từ đầu.
  if (cu.khoaDen > 0 || bayGio - cu.lanCuoi > CUA_SO_MS) return moi();
  return cu;
}

function catBot(bang: Map<string, BoDem>) {
  if (bang.size <= TRAN_SO_KHOA) return;
  const canXoa = bang.size - TRAN_SO_KHOA;
  let i = 0;
  for (const khoa of bang.keys()) {
    bang.delete(khoa);
    if (++i >= canXoa) break;
  }
}

export type KetQuaChan = {
  /** Có chặn không — chặn thì ĐỪNG chạy bcrypt và ĐỪNG ghi nhật ký từng lần. */
  chan: boolean;
  /** Còn phải chờ bao nhiêu giây. Chỉ có nghĩa khi chan = true. */
  conLaiGiay: number;
  /**
   * Lần chặn ĐẦU TIÊN của đợt khóa này — chỗ gọi ghi đúng MỘT dòng nhật ký
   * rồi thôi. Không có cờ này thì mỗi lần bị chặn lại ghi một dòng, và bảng
   * nhật ký vẫn phình đúng như trước, chỉ đổi nội dung dòng.
   */
  lanDauBiKhoa: boolean;
  /** "email" hay "ip" — để ghi vào nhật ký cho quản trị biết đường tra. */
  vi: "email" | "ip" | null;
};

/**
 * Hỏi trước khi kiểm mật khẩu. Không thay đổi bộ đếm ngoài việc đánh dấu đã
 * ghi nhật ký cho đợt khóa.
 */
export function kiemTraChan(email: string, ip: string | null): KetQuaChan {
  const bayGio = Date.now();
  const khoaIp = ip ?? "khong-ro";
  for (const [bang, khoa, vi] of [
    [theoEmail, email, "email"],
    [theoIp, khoaIp, "ip"],
  ] as const) {
    const o = bang.get(khoa);
    if (!o || bayGio >= o.khoaDen) continue;
    const lanDau = !o.daGhiKhoa;
    o.daGhiKhoa = true;
    return {
      chan: true,
      conLaiGiay: Math.ceil((o.khoaDen - bayGio) / 1000),
      lanDauBiKhoa: lanDau,
      vi,
    };
  }
  return { chan: false, conLaiGiay: 0, lanDauBiKhoa: false, vi: null };
}

/** Gọi sau mỗi lần đăng nhập hỏng (sai mật khẩu, sai email, tài khoản khóa). */
export function ghiNhanHong(email: string, ip: string | null) {
  const bayGio = Date.now();
  for (const [bang, khoa, tran, khoaMs] of [
    [theoEmail, email, TRAN_EMAIL, KHOA_EMAIL_MS],
    [theoIp, ip ?? "khong-ro", TRAN_IP, KHOA_IP_MS],
  ] as const) {
    const o = layVaDon(bang, khoa, bayGio);
    o.hong += 1;
    o.lanCuoi = bayGio;
    if (o.hong >= tran && bayGio >= o.khoaDen) {
      o.khoaDen = bayGio + khoaMs;
      o.daGhiKhoa = false;
    }
    bang.set(khoa, o);
    catBot(bang);
  }
}

/**
 * Gọi sau khi đăng nhập THÀNH CÔNG — xóa bộ đếm của cả email lẫn IP.
 *
 * Xóa cả IP là có chủ ý: đăng nhập được chứng minh đầu bên kia là người có
 * tài khoản thật, không phải máy dò. Người đã đăng nhập được vẫn có thể bơm
 * nhật ký (39 lần sai, 1 lần đúng, lặp lại) nhưng đó là người ĐÃ XÁC THỰC —
 * họ vốn đã bơm được nhật ký bằng thao tác bình thường, vì proxy.ts ghi mọi
 * request có sửa dữ liệu. Lỗ hổng cần bịt ở đây là lỗ hổng KHÔNG cần đăng
 * nhập, và nó đã bịt.
 */
export function xoaSauKhiThanhCong(email: string, ip: string | null) {
  theoEmail.delete(email);
  theoIp.delete(ip ?? "khong-ro");
}
