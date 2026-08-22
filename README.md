# Mercury Materials — Hệ thống quản lý vật tư đội tàu Mercury Lines

Web app quản lý vật tư cho đội tàu: Dashboard cảnh báo tồn kho thấp, quản lý đội tàu, danh mục vật tư, nhập/xuất kho theo từng kho trên tàu, và luồng yêu cầu vật tư có phê duyệt (DRAFT → APPROVED → IN_PROCUREMENT...).

**Công nghệ:** Next.js 16 (App Router, TypeScript, Tailwind CSS 4) + Prisma 6 + SQLite.

**Giao diện:** tông xanh navy hàng hải chuyên nghiệp — sidebar navy gradient với logo nhận diện Mercury Lines (SVG vector, `components/MercuryLogo.tsx`), thẻ trắng viền xanh nhạt, nút chính xanh dương. Chứng từ mua sắm (PO, RFQ) in theo kiểu letterhead hiện đại của biểu mẫu công ty: logo chữ lồng, kẻ đôi navy, bảng hàng có đầu bảng navy (giữ màu khi in nhờ `print-color-adjust: exact`), khổ **A4 dọc**; các báo cáo MLS-11-01/11-13 vẫn in A4 ngang.

## Database: PostgreSQL

Dữ liệu nghiệp vụ nằm trong **PostgreSQL 17**. Trước đây dự án dùng SQLite (một file
`prisma/dev.db`); bản SQLite gốc vẫn được giữ trong `E:\backup-mercury` để đối chiếu.

### Chuyển từ SQLite sang PostgreSQL

```
1. Điền DATABASE_URL trong .env  (xem .env.example)
2. tao-bang-postgres.cmd         — tạo 26 bảng theo schema
3. chuyen-sang-postgres.cmd      — chép toàn bộ dữ liệu từ prisma/dev.db sang
```

Script chuyển dữ liệu ([`scripts/chuyen-sang-postgres.ts`](scripts/chuyen-sang-postgres.ts))
dùng Prisma ở **cả hai đầu** — có một Prisma Client riêng chỉ để đọc SQLite, sinh từ
[`prisma/schema.sqlite-doc.prisma`](prisma/schema.sqlite-doc.prisma) — nên không phải tự
chuyển kiểu dữ liệu: SQLite lưu `DateTime` thành số epoch và `Boolean` thành 0/1, Prisma
đọc ra `Date`/`boolean` rồi ghi sang Postgres đúng kiểu.

Ba điểm đáng lưu ý trong script:

- Chép **theo đúng thứ tự khóa ngoại** (Vessel trước User vì `User.vesselId` trỏ tới Vessel);
  xoá thì đi ngược lại.
- **Đặt lại bộ đếm id (sequence)** sau khi chép. Chép id sẵn có không làm sequence nhảy theo
  — không đặt lại thì bản ghi tạo sau sẽ trùng id và lỗi khóa chính. Đây là lỗi kinh điển khi
  chuyển sang PostgreSQL.
- **Đối chiếu số lượng từng bảng** giữa hai bên ở cuối, báo rõ bảng nào lệch.

Script chỉ **đọc** file SQLite, không sửa. Mặc định dừng nếu Postgres đã có dữ liệu; thêm
`--ghi-de` để xoá sạch bên Postgres rồi chép lại.

### Cài PostgreSQL trên máy Windows

```bash
winget install --id PostgreSQL.PostgreSQL.17 --silent --accept-package-agreements --override "--unattendedmodeui none --mode unattended --superpassword MAT_KHAU --serverport 5432"
```

Cài xong nó chạy dạng **dịch vụ Windows** (`postgresql-x64-17`), tự bật cùng máy. Tạo
database và tài khoản riêng cho app — **không dùng tài khoản `postgres` cho ứng dụng**:

```sql
CREATE ROLE mercury LOGIN PASSWORD 'MAT_KHAU_RIENG';
CREATE DATABASE mercury OWNER mercury ENCODING 'UTF8';
```

### Migration

15 migration cũ là SQL kiểu SQLite, không chạy được trên PostgreSQL, nên đã gộp thành **một
migration khởi tạo** cho Postgres. Bản cũ giữ ở `prisma/migrations-sqlite-cu` (đã gitignore).

## Chạy trên máy (development)

```bash
cp .env.example .env   # rồi điền SESSION_SECRET (lệnh sinh khóa ghi sẵn trong file)
npm install
npx prisma migrate dev
npx prisma db seed   # 15 tàu, 45 kho, 10 vật tư, dữ liệu tồn kho mẫu
npm run dev          # http://localhost:3000
```

Hai thứ **không nằm trong repo** vì thuộc dữ liệu riêng của từng công ty:

- **`.env`** — khóa session, mật khẩu seed, thông tin công ty in trên PO/RFQ. Chép từ `.env.example`.
- **`templates/MLS-11-06.xlsx`** — biểu mẫu Excel gốc dùng cho chức năng *Xuất kiểm kê*. Xem [`templates/README.md`](templates/README.md). Thiếu file này thì mọi chức năng khác vẫn chạy, chỉ nút xuất kiểm kê báo lỗi nhắc chép file vào.

### Script tiện dụng (bấm đúp trên Windows)

Bấm đúp thẳng trong thư mục gốc của app, không cần mở terminal:

| File | Việc |
|---|---|
| **`chay-app.cmd`** | **Dùng hằng ngày.** Chạy bản production, tự mở trình duyệt. Chỉ build lại khi mã nguồn đổi — không đổi thì sẵn sàng trong ~2 giây |
| **`dung-app.cmd`** | Tắt app đang chạy ở cổng 3000 (khi lỡ mất cửa sổ, hoặc app còn chạy ngầm từ lần trước) |
| `doi-chieu-danh-muc.cmd` | Đối chiếu danh mục vật tư từng tàu với file kiểm kê gốc |
| `sao-luu-du-lieu.cmd` | Nén bản chụp PostgreSQL (`pg_dump`) + file upload + `.env` + biểu mẫu thành bản sao lưu, kèm dấu vân tay để đối chiếu |
| `khoi-phuc-du-lieu.cmd` | Đưa dữ liệu trở lại từ một bản sao lưu — tự chụp đường lùi trước, đối chiếu vân tay sau |
| `kiem-tra-phan-quyen.cmd` | Chạy ma trận phân quyền: duyệt yêu cầu, phần sơn, dầu/hóa chất (508 phép thử, không đụng database) |
| `kiem-tra-doc-phieu.cmd` | Kiểm tra bộ tách dữ liệu phiếu nhận từ chữ OCR / bảng dán (7 tình huống) |
| `dong-bo-github.cmd` | Đẩy thay đổi mã nguồn lên GitHub |
| `run-dev.cmd` | Chỉ khi đang **sửa code** (có hot-reload). Chậm hơn production ~50 lần |
| `khai-bao-ban-cai.cmd` | Khai báo bản cài này là của tàu nào (`ML-001`) hay là văn phòng (`VANPHONG`) — chạy một lần sau khi cài |
| `dong-bo-xuat.cmd` | Xuất gói đồng bộ (`.json`) để gửi sang bên kia |
| `dong-bo-nhap.cmd` | Nhập gói đồng bộ bên kia gửi tới |
| `run-start.cmd` | Ép build lại từ đầu rồi chạy (~2 phút) |

`chay-app.cmd` tự kiểm tra trước khi chạy và báo bằng tiếng Việt nếu thiếu điều kiện:
thiếu `node_modules`, thiếu `.env`, hoặc cổng 3000 đang bị chiếm
(trường hợp này nó **không** giết tiến trình đang chạy mà chỉ hướng dẫn dùng `dung-app.cmd`).

Node.js được dò động qua [`scripts/node-env.cmd`](scripts/node-env.cmd): ưu tiên Node cài
trong hệ thống, không có thì lấy bản mới nhất đi kèm Playwright, rồi mới đến các vị trí cài
thông thường. Trước đây đường dẫn Playwright bị ghim cứng kèm số phiên bản ở 4 file — Playwright
cập nhật là cả 4 hỏng cùng lúc.
**GitHub chỉ giữ mã nguồn, không giữ dữ liệu vận hành.** Đẩy code lên GitHub bao nhiêu lần
cũng không sao lưu được tồn kho, đơn mua hay file báo cáo đã tải lên — việc đó là của
`sao-luu-du-lieu.cmd`.

## Sao lưu & khôi phục

Hai chiều của cùng một việc, chạy bằng cách bấm đúp:

```
sao-luu-du-lieu.cmd     ->  E:\backup-mercury\backup-<ngày giờ>.zip
khoi-phuc-du-lieu.cmd   <-  chọn một bản trong danh sách rồi đưa dữ liệu trở lại
```

Bản sao lưu gồm bản chụp PostgreSQL (`pg_dump` định dạng custom), `uploads/`, `.env`,
`templates/*.xlsx`, kèm `CACH-KHOI-PHUC.txt` hướng dẫn làm tay khi máy mới chưa có thư mục dự án.

### Bản sao lưu chỉ có giá trị khi khôi phục được thật

Ba thứ được làm để việc khôi phục dùng được lúc cần chứ không chỉ "có script":

**Dấu vân tay.** Mỗi bản sao lưu kèm `database/van-tay.json` — số dòng *và* md5 nội dung từng
bảng. Sau khi khôi phục, script đối chiếu lại: khớp mới báo thành công. Chỉ so số dòng thì một
bản ghi bị sửa nội dung vẫn lọt qua.

**Đường lùi.** Trước khi ghi đè, script tự chụp dữ liệu hiện tại thành
`truoc-khi-khoi-phuc-<giờ>.dump`. Chọn nhầm ngày là chuyện hay xảy ra; không có đường lùi thì
một cú bấm sai xóa sạch dữ liệu thật. Lùi lại bằng chính script đó:

```bash
khoi-phuc-du-lieu.cmd -File "E:\backup-mercury\truoc-khi-khoi-phuc-20260821-222112.dump"
```

**Không làm nửa vời.** Chụp đường lùi thất bại thì dừng, không khôi phục. `pg_restore` lỗi thì
dừng ngay và in đúng lệnh để lùi lại, thay vì để database dở dang. App phải tắt trước
(`dung-app.cmd`) vì `pg_restore --clean` xóa rồi tạo lại toàn bộ bảng.

Đã diễn tập trên chính dữ liệu thật: khôi phục xong, cả 29 bảng / 2.682 dòng khớp md5 với dấu
vân tay ghi trước đó, kể cả bộ đếm id; rồi lùi lại từ file `.dump` cũng khớp y như vậy.

`.env` **không** bị ghi đè tự động — file này chứa mật khẩu database của *máy đang chạy*, ghi đè
bằng `.env` của máy khác là app mất kết nối ngay. Bản trong sao lưu được để cạnh ở
`.env.tu-ban-sao-luu` để tự đối chiếu.

### Vì sao nên chạy production thay vì development

Đo trên máy với dữ liệu thật (606 vật tư · 693 dòng tồn kho), tổng thời gian tải 10 trang:

| Trang | Development | Production |
|---|---|---|
| Tồn kho | 15.772 ms | **130 ms** |
| Vật tư | 15.025 ms | **282 ms** |
| Dashboard | 1.189 ms | **133 ms** |
| **Tổng 10 trang** | **38.863 ms** | **786 ms** |

Khởi động production: ~2 giây. Chế độ development biên dịch lại theo yêu cầu nên chậm là
đúng thiết kế — nó dành cho lúc sửa code, không phải lúc làm việc.

Bản production trên máy:

```bash
npm run build
npm run start
```

## Chạy bằng Docker (khuyên dùng để triển khai)

```bash
docker compose up -d --build
```

`docker compose` dựng hai container: `db` (PostgreSQL 17) và `web` (app). App chạy tại
`http://localhost:3000`. Dữ liệu PostgreSQL nằm trong volume `mercury-db` nên **không mất
khi rebuild/restart**; file báo cáo tải lên nằm trong volume `mercury-data`. `web` chỉ khởi
động sau khi `db` báo khỏe (healthcheck `pg_isready`), lần đầu tự chạy migration + seed.

## Triển khai online

App cần một PostgreSQL và một thư mục lưu file tải lên. Các lựa chọn đã chuẩn bị sẵn:

| Nền tảng | Cách làm |
|---|---|
| **Hostinger VPS** | Có sẵn cấu hình + hướng dẫn từng bước ở [`deploy/HOSTINGER.md`](deploy/HOSTINGER.md) (Docker + Caddy tự cấp HTTPS). |
| **VPS bất kỳ** (đã có Docker) | Copy thư mục dự án lên server → đặt `POSTGRES_PASSWORD` trong `.env` → `docker compose up -d --build`. |
| **Railway / Render / Fly.io** | Tạo service Postgres của nền tảng → trỏ `DATABASE_URL` vào đó → deploy `Dockerfile`, mount đĩa cho `UPLOAD_DIR`. |
| **Vercel** | Chạy được, nhưng phải dùng Postgres hosted (Neon/Supabase/…) và lưu file tải lên ở object storage, vì serverless không có đĩa bền vững. |

Biến môi trường: `DATABASE_URL` (chuỗi kết nối PostgreSQL), `SESSION_SECRET` (xem mục Đăng
nhập & phân quyền), `UPLOAD_DIR` (thư mục lưu file báo cáo, mặc định Docker `/data/uploads`),
và `POSTGRES_PASSWORD` khi dùng container `db` của `docker-compose`.

## Làm việc khi mất mạng — mỗi tàu một bản, đồng bộ về văn phòng

Tàu đi biển không có internet ổn định, nên app **không** phụ thuộc vào mạng: mỗi tàu chạy một
bản app + PostgreSQL riêng ngay trên máy tàu. Toàn bộ nghiệp vụ (nhập xuất kho, yêu cầu vật
tư, sơn, chằng buộc, báo cáo) làm bình thường khi mất mạng hoàn toàn. Khi có mạng trở lại thì
trao đổi **gói đồng bộ** dạng một file `.json` — gửi qua email, USB, hay bất cứ cách nào.

Chia được như vậy vì 13 bảng nghiệp vụ đều gắn với **một tàu cụ thể**: tàu A không bao giờ ghi
vào dữ liệu tàu B, nên gộp lại gần như không có xung đột. Chỉ danh mục dùng chung (vật tư,
nhóm, sơn, nhà cung cấp, biểu mẫu) là do văn phòng quản lý và tàu chỉ nhận về.

### Khai báo bản cài (làm MỘT LẦN sau khi cài)

```bash
khai-bao-ban-cai.cmd ML-001
```

Trên máy văn phòng thì chạy `khai-bao-ban-cai.cmd VANPHONG`.

Lệnh này còn đặt **dải id riêng** cho tàu — điểm mấu chốt để gộp dữ liệu. Văn phòng giữ dải
`1 → 999.999`, mỗi tàu một triệu id: ML-001 từ `1.000.000`, ML-002 từ `2.000.000`… Nhờ vậy hai
tàu cùng tạo bản ghi mới sẽ không đụng id nhau khi gửi về văn phòng. Chưa khai báo thì các
lệnh đồng bộ từ chối chạy.

### Vòng đồng bộ

| Bước | Chạy ở | Lệnh | Kết quả |
|---|---|---|---|
| 1 | Tàu | `dong-bo-xuat.cmd` | Tạo `dong-bo/dongbo-ML-001-….json` — dữ liệu tàu đã thay đổi |
| 2 | Văn phòng | `dong-bo-nhap.cmd <file>` | Gộp dữ liệu tàu vào cơ sở dữ liệu văn phòng |
| 3 | Văn phòng | `dong-bo-xuat.cmd` | Tạo `dong-bo/dongbo-VANPHONG-….json` — danh mục dùng chung mới |
| 4 | Tàu | `dong-bo-nhap.cmd <file>` | Tàu nhận danh mục cập nhật |

Không truyền tham số thì `dong-bo-nhap.cmd` tự lấy file `.json` **mới nhất theo thời gian**
trong thư mục `dong-bo/`.

Vài điểm đã tính sẵn:

- **Chỉ gửi phần thay đổi.** Lần xuất đầu lấy tất cả, các lần sau chỉ lấy bản ghi đổi sau mốc
  lần trước (lưu ở bảng `SyncState`). Mốc mới được chốt *trước* khi đọc dữ liệu và chỉ ghi lại
  *sau* khi file đã nằm trên đĩa, nên hỏng giữa chừng thì lần sau xuất lại, không mất bản ghi.
- **Nhập lại cùng một gói không sinh dữ liệu trùng.** Nhập theo id: chưa có thì tạo, có rồi thì
  cập nhật. Gửi nhầm gói hai lần vẫn an toàn.
- **Chặn nhập nhầm chiều.** Gói của tàu chỉ nhập được ở văn phòng và ngược lại — tránh việc
  dữ liệu cũ ghi đè dữ liệu mới.
- **Bộ đếm id luôn nằm trong dải của bản cài.** Sau khi văn phòng nhập gói tàu, id lớn nhất
  trong bảng là id của tàu; nếu đặt bộ đếm theo id lớn nhất chung thì bản ghi văn phòng tạo
  sau đó sẽ rơi vào dải tàu và đụng độ ở lần đồng bộ sau. Vì vậy bộ đếm chỉ xét những id
  thuộc dải của chính bản cài này.

Thư mục `dong-bo/` chứa dữ liệu thật của công ty nên **không** được đưa lên Git (đã có trong
`.gitignore`).

## Đăng nhập & phân quyền

App yêu cầu đăng nhập (session cookie ký JWT, hạn 7 ngày). Tài khoản seed sẵn dùng chung mật khẩu đặt ở biến môi trường `SEED_PASSWORD`; bỏ trống thì seed dùng tạm `ChangeMe@123` và in cảnh báo — **đổi ngay sau lần đăng nhập đầu tiên**:

| Chức danh | Vai trò trong hệ thống | Phạm vi | Quyền |
|---|---|---|---|
| Quản trị hệ thống | `ADMIN` | Toàn đội | Toàn quyền + quản lý người dùng (trang **Người dùng**: tạo tài khoản, đổi chức danh, gán tàu, khóa/mở khóa) |
| Quản lý kỹ thuật | `TECH_MANAGER` | Toàn đội (văn phòng) | **Duyệt cấp công ty** các yêu cầu tàu đã duyệt, xem toàn đội |
| Thuyền trưởng | `MASTER` | Tàu mình (hoặc toàn đội nếu không gán tàu) | **Duyệt cấp tàu mọi bộ phận**, nhập/xuất kho, danh mục tàu |
| Máy trưởng | `CHIEF_ENGINEER` | Tàu mình | **Duyệt cấp tàu bộ phận Máy/Điện**, nhập/xuất kho, danh mục tàu |
| Đại phó | `CHIEF_OFFICER` | Tàu mình | Lập và trình yêu cầu vật tư; **quản lý sơn của tàu** (nhập/xuất sơn, khu vực, sơ đồ, nhật ký thi công) và gửi yêu cầu cấp sơn. Không duyệt |
| Phó 2 | `SECOND_OFFICER` | Tàu mình | Lập và trình yêu cầu vật tư. Không duyệt |
| Phó 3 | `THIRD_OFFICER` | Tàu mình | Lập và trình yêu cầu vật tư. Không duyệt |
| Máy 2 | `SECOND_ENGINEER` | Tàu mình | Lập và trình yêu cầu vật tư. Không duyệt |
| Máy 3 | `THIRD_ENGINEER` | Tàu mình | Lập và trình yêu cầu vật tư. Không duyệt |
| Máy 4 | `FOURTH_ENGINEER` | Tàu mình | Lập và trình yêu cầu vật tư. Không duyệt |
| Thuyền viên | `CREW` | Tàu mình | Lập và trình yêu cầu vật tư. Không duyệt |

### Quản lý sơn — quyền của bộ phận boong

Trên tàu, sơn và bảo quản vỏ là việc của **bộ phận boong**, mà đại phó là trưởng bộ phận —
kho sơn nằm dưới quyền đại phó. Vì vậy đại phó thao tác được toàn bộ phần Sơn của tàu mình:
nhập/xuất sơn, khu vực sơn, sơ đồ sơn, nhật ký thi công, định mức tối thiểu.

Quyền này là **quyền riêng của phần sơn** (`VAN_HANH_SON`), không dùng lại quyền danh mục vật
tư của tàu — cho đại phó quyền đó là mở rộng ngoài ý muốn sang một nghiệp vụ khác. Ai có:

| | Sơn của tàu mình | Danh mục sơn toàn đội · chép sơ đồ giữa tàu |
|---|---|---|
| Quản trị, Thuyền trưởng | ✓ | ✓ |
| Đại phó | ✓ (kể cả thêm loại sơn mới) | ✗ |
| Máy trưởng (sơn buồng máy) | ✓ | ✗ |
| Sĩ quan còn lại, thuyền viên, quản lý kỹ thuật | ✗ (chỉ xem) | ✗ |

#### Nhập / xuất sơn: từng dòng, hàng loạt từ Excel, và loại sơn mới

Ở trang sơn của tàu, mục **Nhập / xuất sơn** có hai đường:

| | Dùng khi | Cột số lượng nghĩa là |
|---|---|---|
| **Từng dòng (thủ công)** | Nhận vài lon, xuất cho một việc | (gõ tay) |
| **Hàng loạt từ file Excel** hoặc dán bảng từ PDF | Nhận nguyên phiếu giao hàng, xuất theo phiếu lĩnh | **cộng thêm / trừ đi** |
| Trang **Nhập danh mục sơn từ file** (quản trị · thuyền trưởng) | Dựng danh mục ban đầu, chốt kiểm kê | **tồn chốt lại** = đúng số trong file |

Hai nghĩa của cột số lượng nằm ở hai chỗ khác nhau có chủ ý — lẫn "cộng thêm 10" với "đặt tồn
bằng 10" là sai tồn kho mà không ai biết sai từ đâu, nên form nói rõ ngay trên đầu.

Form thủ công có hai chế độ: **chọn từ danh mục**, hoặc **khai một loại sơn mới** ngay tại chỗ
(tên, hãng, hệ sơn, màu, ĐVT, dung tích). Đường nhập hàng loạt từ file đã tự tạo loại chưa có
trong danh mục; bắt đường thủ công phải sang trang Danh mục sơn khai trước rồi quay lại là bắt
làm hai lần cùng một việc, mà lúc nhận sơn ở cầu cảng thì loại mới là chuyện thường. Gõ trùng
tên một loại đang có thì dùng lại loại đó (bỏ qua hoa thường và khoảng trắng thừa), không tạo
bản trùng. Loại mới thì chưa có tồn nên ô thao tác chỉ còn "Nhận sơn lên tàu".

Mục **Nhập / xuất sơn** mở sẵn chứ không gập lại — đây là việc làm hằng ngày, gập lại thì phải
bấm thêm một lần mỗi lần dùng và dễ tưởng là không có chức năng.

Vài điểm của phần hàng loạt:

- **Loại sơn chưa có trong danh mục thì tạo mới luôn.** Sơn mới nhận lên tàu thường chưa nằm
  sẵn trong danh mục; bắt khai báo trước rồi mới nhập được là đẩy người dùng sang gõ tay từng
  dòng. Đại phó cũng **thêm mới** được một loại sơn bằng tay, nhưng **sửa** một loại đang dùng
  chung thì không — thêm loại mới không ảnh hưởng tàu khác, còn sửa định nghĩa dùng chung thì
  đổi luôn sơ đồ sơn và tồn kho của cả đội.
- **Dòng trùng loại trong cùng file được gộp trước khi ghi** — file thật hay có cùng một loại
  ở nhiều dòng (nhiều lô, nhiều thùng).
- **Xuất mà có dòng thiếu tồn thì dừng cả lô**, báo rõ dòng nào, không ghi dòng nào. Ghi được
  nửa phiếu rồi báo lỗi là để lại tồn kho sai mà không biết sửa từ đâu.
- Cột nhận diện tự động: tên sơn, hãng, loại, mã màu, tên màu, ĐVT, dung tích, độ phủ, DFT,
  dung môi, số lượng — cùng bộ đọc với trang nhập danh mục.

**Yêu cầu cấp sơn** (nút *Gửi yêu cầu phê duyệt* ở trang sơn của tàu) **không** dựng một đường
phê duyệt riêng. Nó tạo một yêu cầu vật tư bình thường và đi đúng dây chuyền đang có:

```
Đại phó lập  →  Thuyền trưởng duyệt cấp tàu  →  Công ty duyệt  →  Mua sắm
```

Bộ phận của yêu cầu lấy theo chức danh người lập, nên yêu cầu của đại phó (boong) về đúng bàn
thuyền trưởng, còn yêu cầu sơn buồng máy của máy trưởng nằm trong thẩm quyền máy trưởng. Dựng
đường duyệt thứ hai chỉ để phục vụ sơn là tự tạo thêm một bộ quy tắc nữa phải giữ cho khớp với
bộ đang có.

Bảng xin cấp điền sẵn phần thiếu so với định mức (định mức − tồn) cho những loại đang dưới
mức, và ghi tồn hiện tại vào cột ROB của chứng từ để người duyệt thấy ngay còn bao nhiêu mà
xin thêm bấy nhiêu.

Sáu chức danh sĩ quan có **quyền giống hệt nhau** ở phần yêu cầu vật tư — tách chức danh khỏi quyền như vậy để
chứng từ và nhật ký ghi đúng "Máy 2 · Nguyễn Văn A" thay vì "CREW", mà ma trận phân quyền
không nở ra theo số chức danh.

### Danh tính và thời điểm của người yêu cầu

Ô "Người yêu cầu" trước đây là **ô gõ tay**, nghĩa là chứng từ ghi được bất kỳ tên nào và
không đối chiếu được với ai thật sự bấm nút. Nay tên và chức danh lấy thẳng từ **tài khoản
đang đăng nhập**, ghi lại vào yêu cầu ngay lúc lập:

- Chức danh được **chép lại** vào bản ghi chứ không tra ngược qua tài khoản. Sĩ quan hết hạn
  hợp đồng rời tàu, đổi chức danh, hay bị xóa tài khoản thì chứng từ đã in vẫn phải đúng.
- Thời điểm hiển thị đến **phút** ở cả danh sách lẫn chi tiết (*Lập lúc* và *Trình duyệt lúc*),
  không chỉ ngày — hai yêu cầu cùng ngày phải phân biệt được cái nào trước.
- Ô ký đầu tiên trên biểu mẫu in ghi đúng chức danh (`2nd Engineer / Máy 2`) thay vì luôn in
  cứng "Chief Officer / Chief Engineer".
- Bộ phận được **chọn sẵn theo chức danh**: Máy 2 mở form là đã ở bộ phận Máy, Phó 3 ở Boong.
  Chọn nhầm bộ phận nghĩa là yêu cầu đi lạc sang người duyệt khác.

### Phân cấp phê duyệt yêu cầu vật tư

Yêu cầu đi qua **hai cấp duyệt**, đúng cơ cấu trách nhiệm thật:

```
Sĩ quan lập yêu cầu (CREW)
      │  Trình duyệt
      ▼
Chờ tàu duyệt ──── thuyền trưởng (mọi bộ phận) · máy trưởng (Máy/Điện)
      │  Tàu duyệt & chuyển lên công ty
      ▼
Chờ công ty duyệt ──── quản lý kỹ thuật (TECH_MANAGER)
      │  Công ty duyệt
      ▼
Đã duyệt ──► Chuyển mua sắm
```

Bị từ chối ở cấp nào cũng quay về **Từ chối**; người lập sửa rồi **Trình lại**, vết từ chối
cũ được xóa để bảng đỏ không đứng nguyên trên một yêu cầu đang chờ duyệt.

Vài quyết định đáng nói:

- **Thuyền trưởng duyệt được cả yêu cầu buồng máy, máy trưởng thì không duyệt yêu cầu boong.**
  Trên tàu thuyền trưởng là người chịu trách nhiệm cao nhất; ngược lại, nếu mỗi bộ phận chỉ
  đúng một người duyệt thì máy trưởng đi bờ là yêu cầu buồng máy nằm kẹt.
- **Công ty giảm được số lượng tàu đã duyệt nhưng không tăng.** Số lượng chỉ đi một chiều
  xuống qua từng cấp: xin → tàu duyệt → công ty duyệt. Cho phép tăng thì cấp dưới ký một
  đằng, mua một nẻo.
- **Từ chối cũng phải đúng cấp.** Không có kiểm tra này thì máy trưởng từ chối được yêu cầu
  đang nằm trên bàn của công ty, và ngược lại.
- Nút bấm trên giao diện và quyền thật ở server dùng **chung một hàm** (`capDuyetChoPhep`
  trong [`lib/auth.ts`](lib/auth.ts)), nên không thể lệch nhau: ai không có nút thì gọi thẳng
  server action cũng bị chặn.

Ma trận phân quyền (11 chức danh × 4 bộ phận × 5 trạng thái × cùng/khác tàu) có bài kiểm tra
chạy lại được bằng `kiem-tra-phan-quyen.cmd` — gọi đúng hàm mà server dùng, kỳ vọng viết tay
theo quy định chứ không suy ra từ chính hàm đang kiểm tra.

Biểu mẫu in MLS-11-05 có sẵn bốn ô ký; hai cấp duyệt điền vào đúng ô của mình — ô *Captain*
ghi người duyệt trên tàu (kèm chữ "Máy trưởng" nếu là máy trưởng ký), ô *Tech. & Pur Dept*
ghi quản lý kỹ thuật công ty.

**Phạm vi theo tàu:** mỗi tài khoản có thể được gán một *tàu phụ trách* (trang Người dùng). Tài khoản gán tàu chỉ nhìn thấy và thao tác trên đúng tàu đó ở mọi trang — Dashboard, Đội tàu, Tồn kho, Yêu cầu — kể cả gõ thẳng URL tàu khác cũng nhận 404; ràng buộc được áp ở tầng truy vấn dữ liệu và trong từng server action/API. ADMIN và TECH_MANAGER luôn toàn đội. MASTER không gán tàu = vai trò văn phòng, quản lý toàn đội. CREW hoặc CHIEF_ENGINEER chưa gán tàu sẽ không thấy dữ liệu tàu nào (có banner nhắc liên hệ quản trị viên) — máy trưởng là chức danh trên **một** con tàu nên không có ngoại lệ "không gán tàu thì toàn đội". Danh mục vật tư là dữ liệu tham chiếu chung nên mọi vai trò đều xem được.

Quyền được kiểm tra ở 3 lớp: `proxy.ts` (chặn truy cập chưa đăng nhập), từng trang (ẩn form không có quyền), và **trong mỗi server action/API** (đọc vai trò mới nhất từ database — đổi vai trò/khóa tài khoản có hiệu lực ngay với mọi thao tác ghi).

Biến môi trường: `SESSION_SECRET` (bắt buộc — Docker tự sinh và lưu vào volume nếu bỏ trống); `COOKIE_SECURE=false` nếu chạy sau HTTP thuần không có HTTPS.

## Danh mục & yêu cầu vật tư theo biểu mẫu công ty

Danh mục và yêu cầu vật tư được dựng theo 3 mẫu Excel của công ty (MLS-11-05A/05B/11-06):

- **Danh mục vật tư** (`/materials`) xếp theo **bộ phận tàu** như form công ty:
  🛳 Boong → ⚙️ Máy → ⚡ Điện → 🧺 Phục vụ/Tiêu hao → 🦺 An toàn. Trong mỗi bộ phận, vật tư
  (Store) đứng trước, phụ tùng (Spare) xếp sau và **gom theo từng thiết bị** — Máy chính,
  Máy đèn, Air Compressor, Oil Separator, BWMS… Cùng cách phân nhóm với trang Tồn kho
  (dùng chung [`lib/departments.ts`](lib/departments.ts)).

  Hai quy tắc đáng lưu ý trong cách phân nhóm: thiết bị của phụ tùng lấy từ trường
  `equipment`, **không có thì lấy tên Nhóm (Category)** — file kiểm kê MLS-11-06 ghi thiết bị
  ở cột "Nhóm" chứ không phải trường riêng; và phụ tùng không đoán được bộ phận thì xếp vào
  **Máy** chứ không phải "Khác", vì trên tàu phụ tùng gần như luôn thuộc buồng máy.

- **Danh mục vật tư** (`/materials`) phân biệt **Vật tư (Store)** và **Phụ tùng (Spare part)** — có tab lọc; phụ tùng gắn với **Thiết bị/máy** (Equipment) và có Part No, Maker; vật tư có Mã IMPA. ADMIN thêm/sửa với đầy đủ trường theo form. Xóa/ngừng sử dụng: ADMIN có nút **Ngừng sử dụng** (giữ lịch sử, ẩn khỏi yêu cầu mới) và **Xóa vĩnh viễn** (chỉ khi vật tư chưa có tồn kho và chưa dùng trong yêu cầu nào).
  - **Danh mục riêng từng tàu:** có **bộ chọn tàu** — chọn *Danh mục gốc (toàn đội)* để quản lý định nghĩa chung, hoặc chọn một **tàu** để xem/hiệu chỉnh danh mục riêng của tàu đó (thêm/gỡ vật tư mà tàu dùng). Thuyền viên/thuyền trưởng có gán tàu bị khóa vào đúng tàu mình; ADMIN và thuyền trưởng văn phòng chọn được mọi tàu. Gỡ vật tư khỏi tàu **không** xóa định nghĩa gốc hay tồn kho — chỉ bỏ khỏi danh sách của tàu đó.
- **Yêu cầu vật tư** (`/requests`) có 2 dạng theo mẫu:
  - **Yêu cầu vật tư — MLS-11-05B**: Mô tả · Mã IMPA · Đơn vị · ROB (tồn) · SL yêu cầu · SL duyệt.
  - **Yêu cầu phụ tùng — MLS-11-05A**: gắn thiết bị/Maker/Serial; Tên phụ tùng · Hạng mục · Part No · Đơn vị · ROB · SL yêu cầu · SL duyệt.
  - **Vật tư có sẵn hoặc vật tư mới:** mỗi dòng yêu cầu chọn *Có sẵn* (lấy từ danh mục) hoặc *Mới (ngoài danh mục)* — nhập tay Tên, Mã (IMPA cho vật tư / Part No cho phụ tùng), Đơn vị. Một yêu cầu có thể trộn cả hai; bản in ra đúng mẫu, vật tư mới có nhãn "(mới)". Vật tư mới không tự thêm vào danh mục gốc (giống dòng viết tay trên form giấy).
  - **ROB (còn tồn trên tàu) tự chụp** từ tồn kho tại thời điểm tạo yêu cầu (vật tư mới ROB = 0) — không phải nhập tay.
  - Người duyệt (ADMIN/MASTER) nhập **SL duyệt** cho từng dòng rồi duyệt; bản in `/requests/[id]` ra đúng mẫu công ty (4 ô ký: Đại phó/Máy trưởng · Thuyền trưởng · Phòng KT-VT · Phó GĐ), rồi chuyển sang mua sắm (purchasing).
  - **Quy trình phê duyệt có trách nhiệm:** yêu cầu lập ra ở trạng thái **Nháp** — sửa/xóa được, chưa ai duyệt được. Người lập bấm **Trình duyệt** để chuyển sang **Chờ duyệt**, lúc đó ADMIN/Thuyền trưởng mới duyệt hoặc từ chối được. Trước đây nháp và đã trình lẫn lộn nên không phân định được trách nhiệm.
  - **Từ chối phải nêu lý do** (kiểm ở tầng server, không chỉ HTML) — lý do hiện ngay trên trang chi tiết để người lập biết sửa gì mà trình lại.
  - **Nhật ký phê duyệt:** mọi lần đổi trạng thái đều ghi *ai · vai trò · lúc nào · ghi chú*, hiện thành dòng thời gian ở cuối trang chi tiết. Ghi trong cùng transaction với thao tác đổi trạng thái nên nhật ký không bao giờ lệch với trạng thái thực.
  - **Số yêu cầu theo quy ước chứng từ:** `MR-ML001-26-0001` (loại–mã tàu–năm–số thứ tự), thay cho số máy sinh kiểu `MR-1786932707187-191` không tra cứu được. Số thứ tự lấy theo số lớn nhất đã dùng nên xóa yêu cầu không gây trùng.
  - **Ô ký trên bản in** điền sẵn tên người lập (kèm ngày trình) và người duyệt (kèm ngày duyệt) thay vì để trống trơn.
  - **Xóa yêu cầu** (nút Xóa ở danh sách, trang chi tiết và trong trang tàu, có hộp xác nhận): **quản trị viên xóa được mọi yêu cầu**; thuyền trưởng/thuyền viên chỉ xóa yêu cầu **của tàu mình khi chưa duyệt** (nháp / chờ / từ chối / hủy) — yêu cầu đã duyệt hoặc đã chuyển mua sắm chỉ quản trị viên mới xóa được, để bảo toàn hồ sơ. Xóa yêu cầu thì các dòng vật tư trong đó cũng bị xóa theo.

## Nguyên tắc bố cục: mỗi nghiệp vụ một chỗ

Trang **hồ sơ tàu** (`/vessels/[id]`) chỉ để *xem*: thông tin tàu, danh sách kho, bảng tóm tắt
tồn kho và yêu cầu, tài liệu gần đây. Mọi thao tác đều dẫn sang module chuyên trách, đã lọc
sẵn theo tàu:

| Muốn làm gì | Làm ở đâu |
|---|---|
| Nhập / xuất kho · Xuất kiểm kê MLS-11-06 | **Tồn kho** — `/inventory?vessel=<id>` |
| Tạo · trình · duyệt · xóa yêu cầu | **Yêu cầu vật tư** — `/requests?vessel=<id>` |
| Sửa danh mục vật tư của tàu | **Vật tư** — chọn tàu ở bộ chọn |

Trước đây trang tàu nhúng luôn form nhập/xuất, form tạo yêu cầu và nút duyệt — tức là bản sao
thu nhỏ của 3 module khác. Sửa logic ở module chính thì trang tàu lệch theo (đã xảy ra thật với
tên kho và với luồng phê duyệt). Nút xuất kiểm kê từng có ở **3 nơi** cùng gọi một API, nay chỉ
còn ở Tồn kho — nơi có sẵn bộ lọc phạm vi trước khi xuất.

## Tồn kho đội tàu (`/inventory`)

Trang tồn kho bố cục theo luồng làm việc: **Tổng quan** (3 thẻ thống kê: số dòng, dưới tối thiểu, số tàu) → **Bộ lọc** thanh mỏng (tàu, kho, loại Store/Spare, tìm theo tên/mã/IMPA, "chỉ thiếu") → **Tồn kho nhóm theo tàu** (thẻ gập/mở có mũi tên chỉ trạng thái — tàu có cảnh báo tự mở kèm badge "N thiếu", tàu đủ gập gọn badge "đủ"; mỗi bảng có **thanh cuộn riêng + tiêu đề ghim cố định** để dò nhanh danh sách dài; nút **⬇ Xuất MLS-11-06** từng tàu; bên trong bảng sắp xếp theo **bộ phận tàu như form công ty: 🛳 Boong → ⚙️ Máy → ⚡ Điện → 🧺 Phục vụ/Tiêu hao → 🦺 An toàn** — mỗi bộ phận hiện số dòng + số thiếu, vật tư (Store) đứng trước, phụ tùng (Spare) xếp sau theo từng **nhóm thiết bị** có tiêu đề riêng, phân bộ phận tự động từ nhóm vật tư/thiết bị/mã kho) → **Nhập/xuất kho** (mục gập) → **Lịch sử giao dịch** (mục gập, cũng cuộn + ghim tiêu đề). Dòng thiếu tô đỏ + nhãn THIẾU; phụ tùng đánh dấu PT. Người bị giới hạn tàu không thể ép xem tàu khác qua URL.

## Thời gian & người thực hiện của mỗi giao dịch kho

Mỗi lần nhập/xuất đều ghi **thời điểm thực hiện** (`occurredAt`) và **người thực hiện** (tự động từ tài khoản đăng nhập). Form nhập/xuất có ô "Thời điểm thực hiện": để trống = bây giờ, hoặc chọn lùi ngày giờ khi nhập bù (không cho ghi tương lai). Trang **Tồn kho** có bảng **"Lịch sử nhập xuất gần đây"**: thời điểm, loại, vật tư, kho, SL, người thực hiện, ghi chú — cột "Ghi sổ lúc" chỉ hiện khi giao dịch nhập bù (thời điểm thực hiện ≠ thời điểm ghi hệ thống, phục vụ audit). Báo cáo MLS-11-01, xuất kiểm kê MLS-11-06 và Dashboard đều tính kỳ theo thời điểm thực hiện.

## Nhập danh mục vật tư & phụ tùng từ file (`/materials/import`)

ADMIN/Thuyền trưởng upload file theo form công ty để nạp nhanh danh mục cho từng tàu:

- **Excel MLS-11-06** (Store & Spare Part Inventory): tự dò bảng (cột Description/IMPA/Unit/Group/R.O.B) — nhóm (Group) tự thành Category; nếu chọn kho, cột **R.O.B được ghi thành tồn kho** (đặt số tuyệt đối + tự ghi giao dịch kiểm kê IN/OUT để giữ vết).
- **Word MLS-11-04** (Danh mục phụ tùng thiết yếu, .doc/.docx): tự nhận nhóm thiết bị (Máy chính, Máy phát...), tên phụ tùng, **số lượng tối thiểu** ("2 set" → min 2, ĐVT SET) — phụ tùng cùng tên nhưng khác thiết bị được tách riêng.

Vật tư trùng (theo IMPA / Part No / tên + thiết bị; mã giữ chỗ "-", "N/A" bị bỏ qua) chỉ được **gán vào tàu**, không tạo bản sao — nhập lại cùng file không sinh trùng lặp. Vật tư mới có mã `ML-IMP-####`. Trang **Dashboard** có mục **"Kiểm soát phụ tùng thiết yếu"**: đếm phụ tùng SPARE dưới mức tối thiểu trên toàn đội (theo phạm vi tàu) với thanh mức độ.

### Sửa vật tư ngay tại bảng danh mục

Nút **Sửa** ở mỗi dòng mở hộp thoại chỉnh đủ 13 trường: mã, tên Việt/Anh, loại, thiết bị,
IMPA, Part No., Maker, nhóm, đơn vị, tồn tối thiểu/tối đa, và cờ *phụ tùng thiết yếu*.
Không phải xoá đi tạo lại, cũng không phải mở trang riêng.

Hai điều được kiểm ở tầng server:

- **Mã trùng** bị chặn — báo rõ *"Mã vật tư … đã có ở vật tư khác"*.
- **Đổi loại từ Phụ tùng sang Vật tư thì xoá luôn Thiết bị**, vì thiết bị chỉ có nghĩa với
  phụ tùng — để sót lại sẽ làm gom nhóm sai ở trang danh mục và trang tồn kho.

Ở chế độ **xem theo tàu**, nút Sửa vẫn có nhưng ẩn *Ngừng sử dụng* / *Xoá*: hai thao tác đó
tác động lên bản ghi dùng chung toàn đội nên làm từ **Danh mục gốc** mới đúng ngữ cảnh.
Chỉ quản trị viên thấy nút Sửa.

### Tìm kiếm và giới hạn hiển thị

Danh mục có 600+ dòng nên trang **Vật tư** có ô **tìm theo tên / mã / IMPA / Part No / hãng /
thiết bị**, và mặc định chỉ hiện **40 dòng đầu mỗi bộ phận** kèm link *xem tất cả*.

Lý do không hiện hết mặc định: dựng đủ 606 dòng tạo hơn **20.000 phần tử DOM** và 109 KB HTML —
trình duyệt bắt đầu ì từ khoảng 10.000 phần tử. Cắt còn 40 dòng/bộ phận đưa về **6.886 phần tử,
43 KB**, còn tìm kiếm thì thường ra dưới 500 phần tử.

### IMPA và Part No. — phân biệt khi nhập file

File kiểm kê của công ty ghi **cả mã nhà sản xuất lẫn mã IMPA vào chung cột "Mã IMPA"**.
Bộ đọc file phân loại lại thay vì đổ thẳng vào ô IMPA:

| Giá trị | Vào ô |
|---|---|
| 6 chữ số, liền hoặc có dấu ngăn — `190115`, `19.01.15`, `51.08...` | **IMPA** |
| Có chữ cái — `VLH-53.06.01`, `E11108`, `SY000814`, `6310-2Z` | **Part No.** |
| Số trơn từ 7 chữ số — `1016815253` (số hiệu của hãng) | **Part No.** |

Quy tắc nằm ở `looksLikeImpa()` trong [`lib/materialImport.ts`](lib/materialImport.ts).

### Đối chiếu danh mục với file kiểm kê gốc

`doi-chieu-danh-muc.cmd` so danh mục vật tư của **từng tàu** trong app với đúng các file kiểm kê
Excel gốc, báo ra số vật tư **thừa** (có trong app nhưng không có trong file) và **thiếu**
(có trong file nhưng chưa gán cho tàu).

Khai báo file nguồn của từng tàu ở [`scripts/nguon-kiem-ke.json`](scripts/nguon-kiem-ke.json).
Tàu không khai trong đó được coi là **chưa có dữ liệu nguồn** — mọi vật tư đang gán cho nó
đều bị tính là thừa.

Công cụ dùng **chính parser mà chức năng nhập file dùng**, nên kết quả đối chiếu phản ánh
đúng những gì app sẽ đọc được, không phải một cách đọc thứ hai.

### Xuất kiểm kê theo form công ty (MLS-11-06)

Nút **"⬇ Xuất kiểm kê MLS-11-06"** ở trang Danh mục (chế độ theo tàu, giữ bộ lọc Store/Spare) và trang chi tiết tàu tải về file Excel **điền trên chính template gốc của công ty** (giữ nguyên định dạng, chữ ký): tên tàu, ngày, loại vật tư, và từng dòng Nhóm / Mô tả / IMPA / Đơn vị / **Còn tồn đợt trước / Nhận trong kỳ / Tiêu thụ trong kỳ / Tồn trên tàu** (kỳ = tháng hiện tại, tính từ giao dịch nhập–xuất trong app). Trên 25 dòng thì form tự giãn, khối chữ ký tự dời xuống. Quyền theo phạm vi tàu (thuyền viên chỉ xuất được tàu mình).

## Mua sắm (Purchasing) — quy trình khép kín

Module mua sắm (`/purchasing`) dẫn vật tư từ khi yêu cầu được duyệt cho tới khi nhận hàng xong:

1. **Yêu cầu chờ mua sắm** — yêu cầu đã duyệt + chuyển mua sắm (IN_PROCUREMENT) hiện trong hàng chờ.
2. **Tạo đơn mua hàng (PO)** — chọn tàu → tick các dòng vật tư cần mua (tự tính SL còn cần mua = SL duyệt − đã đặt) → nhập đơn giá → chọn **nhà cung cấp** → tạo PO (Nháp).
3. **Tiến trình PO** — Nháp → **Gửi NCC** → **NCC xác nhận** → nhận hàng → **Hoàn tất**; có thể **Hủy** khi chưa nhận.
4. **Nhận hàng (Goods Receipt)** — nhập SL nhận từng dòng + chọn kho: vật tư trong danh mục **tự nhập kho** (tăng tồn + ghi giao dịch IN), cập nhật **tiến độ giao** của yêu cầu (Giao một phần / Giao đủ), và cuộn trạng thái PO (Nhận một phần / Nhận đủ).
5. **Bản in PO** đúng biểu mẫu công ty: đầu chứng từ theo **biểu mẫu của tàu** (xem bên dưới), khối To/Attn/Y-ref (NCC) + From/Our ref/Date/Subject, bảng dòng (Item/Description/PN/Unit/Q'ty/U.Price/Amount), khối tổng **Total → Chiết khấu (%) → Phí vận chuyển → Phí giao lên tàu → TOTAL**, Terms & Condition và chữ ký công ty.
6. **Yêu cầu báo giá (RFQ / Inquiry for Quote)** — từ trang PO bấm "Yêu cầu báo giá (RFQ)" để in bản Inquiry for Quote (cùng các dòng hàng nhưng **không có giá**, cột IMPA/PN) gửi NCC, cùng chuẩn biểu mẫu với PO.

### Tạo IFQ / PO trực tiếp từ Phòng Kỹ thuật – Vật tư (`/purchasing/direct`)

Văn phòng lập đơn mua **không cần yêu cầu từ tàu**: chọn tàu + nhà cung cấp, rồi:

- **Upload file Excel theo form công ty** (.xls/.xlsx, tối đa 10MB): app tự dò bảng vật tư (cột Description + Q'ty; tự nhận thêm PN/IMPA, Unit, U.Price nếu có) — dùng được trực tiếp file FORM PURCHASING ORDER / INQUIRY FOR QUOTE của công ty, tự bỏ qua dòng Total và ghi chú cuối form; và/hoặc
- **Nhập dòng tay** (mô tả, PN/IMPA, ĐVT, SL, đơn giá — thêm/xóa dòng tự do).

Đơn tạo ra ở trạng thái Nháp với đầy đủ trường thương mại (Subject, Y/ref, chiết khấu %, phí vận chuyển, phí giao lên tàu); từ trang đơn in được **Yêu cầu báo giá (IFQ/RFQ)** và **PO** theo biểu mẫu của tàu. Lưu ý: dòng của đơn trực tiếp không gắn với danh mục vật tư nên khi nhận hàng chỉ ghi nhận số lượng (không tự nhập kho). Quyền: ADMIN + Thuyền trưởng (theo phạm vi tàu).

### Xóa đơn mua đã hủy

Đơn đã hủy nằm lại làm rối danh sách. **Quản trị viên** xóa được chúng bằng nút *Xóa* ở
danh sách mua sắm hoặc trang chi tiết đơn. Ba chốt chặn, đều kiểm ở tầng server chứ không
chỉ ẩn nút:

1. Chỉ **ADMIN** — xóa chứng từ mua sắm là việc hệ trọng.
2. Chỉ đơn **Đã hủy**. Đơn đang xử lý phải bấm Hủy trước, để giữ vết là nó từng tồn tại.
3. Chỉ khi **chưa nhận hàng**. Đã nhận nghĩa là tồn kho đã bị tác động — xóa đơn sẽ mất
   căn cứ của số tồn đó, nên bị chặn kể cả khi đơn đã hủy.

Dòng đơn có gắn với dòng yêu cầu thì phần "đã đặt" được trả lại cho yêu cầu, để yêu cầu đó
quay về hàng chờ mua sắm.

### Nhà cung cấp (`/purchasing/suppliers`)

ADMIN thêm / **sửa** (mục "Sửa thông tin nhà cung cấp" dưới mỗi dòng) / **Ngừng dùng–Dùng lại** / **Xóa** nhà cung cấp. Không thể xóa nhà cung cấp đã có đơn mua (giữ lịch sử) — hãy dùng Ngừng dùng.

### Biểu mẫu chứng từ theo tàu (`/purchasing/forms`)

Thực tế mỗi tàu phát hành RFQ/PO dưới danh nghĩa công ty quản lý khác nhau, nên app hỗ trợ nhiều bộ biểu mẫu (mặc định seed 2 mã: `MLS` và `NAVIS`). Thông tin công ty in trên chứng từ **không nằm trong mã nguồn** — đặt qua biến môi trường `FORM_<MÃ>_*` (xem `.env.example`) hoặc sửa thẳng trong app. Trang **Mẫu biểu theo tàu**:

- **Danh sách biểu mẫu** thêm/bớt/sửa được (ADMIN): mỗi biểu mẫu gồm mã, tên công ty, địa chỉ, ĐT/email/website — chính là đầu chứng từ + chữ ký in trên RFQ/PO. Bấm **"Sửa thông tin biểu mẫu"** trên thẻ để hiệu chỉnh mọi trường (đổi mã sẽ tự chuyển các tàu đang gán sang mã mới). Có nút **Ngừng dùng / Dùng lại / Xóa**; không thể xóa hay ngừng dùng biểu mẫu còn tàu đang gán (app báo số tàu cần chuyển trước).
- **Gán biểu mẫu cho tàu** (ADMIN): mỗi tàu một dropdown chọn biểu mẫu + ô Hull No. Đổi xong, mọi RFQ/PO của tàu đó in ngay theo công ty mới. Hai biểu mẫu MLS và NAVIS được tạo sẵn khi seed.

Quản lý **nhà cung cấp** ở `/purchasing/suppliers` (ADMIN). Mua sắm dành cho **ADMIN và Thuyền trưởng** (vai trò văn phòng/procurement); thuyền viên chỉ xem. Tuân theo phạm vi tàu như toàn app.

## Dầu đốt · Dầu nhờn · Hóa chất (`/consumables`)

Ba nhóm đi chung một bộ bảng vì vòng đời giống hệt nhau: **nhận theo lô có chứng từ và đặc
tính riêng → nằm trong két/kho → tiêu thụ dần**. Tách ba bộ bảng gần như giống nhau chỉ để đặt
tên khác thì mọi sửa đổi sau này phải làm ba lần. Phần *khác* nhau là đặc tính từng nhóm nên
để cùng bảng, cột nào không áp dụng thì để trống.

### Phân quyền theo bộ phận

| | Dầu đốt | Dầu nhờn | Hóa chất | Danh mục toàn đội |
|---|---|---|---|---|
| Quản trị, Thuyền trưởng | ✓ | ✓ | ✓ | ✓ |
| **Máy trưởng** | ✓ | ✓ | ✓ | **✓** (sửa · ngừng dùng · xóa, như quản trị) |
| **Đại phó** | ✗ | ✗ | **✓** | thêm mới |
| Sĩ quan còn lại | ✗ (chỉ xem) | ✗ | ✗ | thêm mới |
| Quản lý kỹ thuật | ✗ (chỉ xem) | ✗ | ✗ | ✗ |

Máy trưởng quản **danh mục** dầu và hóa chất toàn đội ngang quản trị — khác với danh mục
**sơn** (vẫn thuộc thuyền trưởng/văn phòng). Người nắm rõ mã dầu, TBN, độ nhớt và hóa chất nào
dùng cho nồi hơi chính là máy trưởng, không phải văn phòng.

Dầu đốt và dầu nhờn là việc **buồng máy** — máy trưởng nhận bunker, ghi tiêu thụ, giữ mẫu theo
MARPOL. Hóa chất thì **cả hai bộ phận** cùng dùng: máy trưởng lo nồi hơi, nước làm mát, xử lý
dầu; đại phó lo tẩy rửa, vệ sinh hầm hàng — nên quyền của hóa chất rộng hơn một bậc. Ô chọn
mặt hàng ở mỗi form chỉ hiện nhóm người đó được ghi, nên đại phó mở được trang nhưng không ghi
được phiếu bunker.

### Nhập phiếu: thủ công, hoặc đọc từ PDF scan

Ba nhóm được **tách hẳn** thành tab riêng (Tất cả · Dầu đốt · Dầu nhờn · Hóa chất) ở trang
của tàu. Đó là ba nghiệp vụ khác nhau, do người khác nhau phụ trách và có chứng từ khác nhau;
xem lẫn cả ba trong một danh sách thì máy trưởng phải lọc mắt qua hóa chất tẩy rửa mới thấy
được lô dầu của mình. Tab nào ngoài quyền thì ghi rõ *(chỉ xem)*.

Mỗi tab là một màn hình **hoàn chỉnh cho riêng nhóm đó** — cảnh báo, tổng hợp, ô chọn mặt
hàng ở mọi form đều chỉ của nhóm đang xem:

| | Dầu đốt | Dầu nhờn | Hóa chất |
|---|---|---|---|
| Tồn theo chủng loại | HFO · VLSFO · MGO… | xy-lanh · hệ thống · AE… | nồi hơi · làm mát · tẩy rửa… |
| Tiêu thụ 30 ngày theo M/E · A/E · nồi hơi | ✓ | ✓ | ✓ |
| **Tồn dùng được trong ECA / chỉ ngoài ECA** | ✓ | — | — |
| **Mẫu dầu đang giữ** (số niêm, giữ tới, còn bao nhiêu ngày) | ✓ | — | — |
| **An toàn: phân loại nguy hiểm, nơi lưu MSDS** | — | — | ✓ |
| Cảnh báo dưới định mức · hạn dùng lô | ✓ | ✓ | ✓ |

Con số quan trọng nhất của tab dầu đốt là **còn bao nhiêu tấn dùng được trong vùng ECA** —
đó là câu hỏi phải trả lời trước khi vào ECA. Tính theo lưu huỳnh *danh nghĩa* khai ở danh mục
chứ không theo từng lô: nhiều lô nằm chung két nên không quy tồn về đúng lô được; mặt hàng
chưa khai lưu huỳnh thì xếp riêng, không đoán là đạt.

Bảng **mẫu dầu đang giữ** liệt kê số niêm và ngày phải giữ tới của từng lô còn trong hạn 12
tháng — kiểm tra của cảng (PSC) hỏi là đưa ra được ngay; lô đã qua mốc thì hiện ở phần cảnh
báo để bỏ mẫu.

Ghi phiếu nhận có hai đường:

**Thủ công** — gõ từng ô. Form đổi theo nhóm mặt hàng đang chọn: hỏi lưu huỳnh của một can
hóa chất tẩy rửa, hay hỏi hạn dùng của một lô HFO, đều là ô trống vô nghĩa mà người dùng vẫn
phải đọc qua.

**Đọc từ file PDF, kể cả bản SCAN.** Chọn file BDN → hệ thống nhận dạng chữ trong ảnh rồi điền
sẵn các ô. Máy này không có thư viện đọc PDF, không có Tesseract và không cài thêm được, nên
phần này dùng hai thành phần có sẵn của **Windows**: `Windows.Data.Pdf` dựng từng trang thành
ảnh, `Windows.Media.Ocr` nhận dạng chữ ([`scripts/doc-pdf-scan.ps1`](scripts/doc-pdf-scan.ps1)).
Không phải cài gì. Chạy trên Linux/Docker thì báo rõ là không dùng được và người nhập gõ tay —
không có chức năng nào hỏng.

Ba điều làm cho đường này **chính xác** chứ không chỉ tiện:

- **Máy chỉ ĐỀ XUẤT, không bao giờ tự lưu.** Ô nào máy điền thì **viền vàng**, kèm dòng nhắc
  đối chiếu bản gốc — nhất là số lượng và lưu huỳnh. Đọc nhầm một chữ số khối lượng dầu là sai
  cả bảng cân đối nhiên liệu và sai cả hồ sơ MARPOL.
- **Không đoán bừa.** Ô nào không thấy nhãn quen thuộc thì để trống. Ô trống thì người nhập
  biết phải gõ; ô sai thì họ tưởng máy đã đọc đúng.
- **Bản gốc được đính kèm vào phiếu.** Xem lại bất cứ lúc nào qua nút *📎 Xem bản gốc* ở bảng
  phiếu nhận. Đây mới là chỗ bảo đảm chính xác về sau, chứ không phải tin vào máy đọc. Xóa
  phiếu thì file cũng được dọn theo.

Đọc được cả BDN tiếng Anh lẫn phiếu tiếng Việt, số kiểu `450.250` lẫn `450,250`, và bảng không
có dấu hai chấm. Bộ tách dữ liệu có bài kiểm tra riêng: `kiem-tra-doc-phieu.cmd`.

### Yêu cầu cấp dầu / hóa chất và quy tắc không tự duyệt

Nút *Gửi yêu cầu phê duyệt* ở trang của tàu đi đúng dây chuyền đang có của yêu cầu vật tư, nối
liền tới mua sắm:

```
Máy 2/3/4 lập   →  Máy trưởng duyệt cấp tàu    →  Công ty duyệt  →  Mua sắm
Máy trưởng lập  →  Thuyền trưởng duyệt cấp tàu →  Công ty duyệt  →  Mua sắm
Đại phó lập     →  Thuyền trưởng duyệt cấp tàu →  Công ty duyệt  →  Mua sắm
```

**Không ai duyệt yêu cầu do chính mình lập.** Máy trưởng quản toàn bộ dầu, dầu nhờn và hóa
chất của tàu, nhưng khi chính ông ấy xin cấp thì chữ ký duyệt phải là người khác — nếu không
thì "duyệt" chỉ là ký hai lần vào cùng một tờ giấy. Chặn theo **id tài khoản**, không so bằng
tên: hai người trùng tên là quyền kiểm soát thủng ngay.

**Thuyền trưởng lập thì đi thẳng lên công ty.** Trên tàu không còn ai trên thuyền trưởng để ký
cấp tàu, mà chính ông ấy lại bị chặn tự duyệt. Không có lối này thì yêu cầu của thuyền trưởng
nằm kẹt vĩnh viễn ở *Chờ tàu duyệt*. Ô ký cấp tàu vẫn được điền tên thuyền trưởng và nhật ký
ghi rõ lý do, nên không có bậc nào trống trên chứng từ.

Đi kèm: bỏ qua bước cấp tàu thì **số lượng tàu duyệt bằng số xin** — chữ ký lúc lập chính là
chữ ký cấp tàu. Để 0 thì cấp công ty chỉ duyệt được tối đa 0, vì trần của họ là số tàu đã duyệt.

### Bốn quy tắc nghiệp vụ được cài sẵn

**Lưu huỳnh theo MARPOL Annex VI Reg 14.** Nhập hàm lượng lưu huỳnh của lô là hệ thống đối
chiếu ngay: ≤0,10% dùng được cả trong vùng ECA; ≤0,50% đạt giới hạn toàn cầu nhưng không dùng
được trong ECA; trên 0,50% chỉ hợp lệ khi tàu có hệ thống lọc khí thải. Đây là **cảnh báo**
chứ không chặn cứng — chặn cứng thì tàu có scrubber không ghi được lô dầu thật của mình.

**Mẫu dầu giữ 12 tháng (Reg 18.8.1).** Mốc được tính tự động khi ghi phiếu, kèm ô ghi số niêm.
Trang tàu liệt kê những lô đã qua mốc để bỏ mẫu — bỏ sớm là mất bằng chứng đối chứng khi bị
kiểm tra (PSC), giữ mãi thì tủ mẫu chật cứng.

**Hạn dùng hóa chất.** Khai hạn dùng (tháng) ở danh mục thì mỗi lô nhận tự tính ngày hết hạn;
lô còn dưới 60 ngày hoặc đã quá hạn hiện lên đầu trang tàu.

**Đặc tính mặt hàng ≠ đặc tính lô.** Danh mục giữ đặc tính *danh nghĩa* (lưu huỳnh tối đa, độ
nhớt, TBN); phiếu nhận giữ đặc tính *thực* đọc từ BDN / chứng thư phân tích. Hai lô cùng mặt
hàng có thể khác nhau, gộp một chỗ là mất số liệu thật của từng lô.

Ngoài ra: nơi tiêu thụ (M/E · A/E · nồi hơi · máy khí trơ) chỉ hỏi khi ghi **tiêu thụ**, không
hỏi khi nhận hay xuất — ghi vào đó là dữ liệu vô nghĩa làm báo cáo cộng nhầm. Ghi phiếu nhận
làm ba việc trong **một** transaction (lưu chứng từ, cộng tồn, sinh giao dịch), và xóa phiếu
thì trừ lại đúng lượng đã cộng.

## Quản lý sơn (`/paint`)

Module riêng cho sơn, tách khỏi danh mục vật tư vì sơn có thuộc tính và quy trình riêng
(hệ sơn nhiều lớp, độ phủ, DFT, thi công theo diện tích). Ba phần cho **từng tàu**:

1. **Sơ đồ sơn theo khu vực** — mỗi tàu tự khai báo khu vực (Vỏ dưới nước, Mạn khô, Boong…)
   kèm diện tích m². Mỗi khu vực có các lớp theo thứ tự (lót → chống ăn mòn → chống hà),
   mỗi lớp ghi số lớp phủ và DFT. App tự **ước lượng lượng sơn cần** = diện tích × số lớp ÷ độ phủ.
2. **Nhật ký thi công** — ngày, khu vực, m² đã sơn, số lớp, **điều kiện thi công** (thời tiết,
   nhiệt độ không khí/bề mặt, độ ẩm — cần cho hồ sơ chất lượng màng sơn), người thực hiện,
   và các dòng sơn đã dùng. Ghi xong **tự trừ tồn**; xóa bản ghi thì **hoàn lại tồn**.
   Không cho ghi khi lượng dùng vượt tồn.
3. **Tồn sơn theo tàu** — nhập/xuất có ghi thời điểm + người thực hiện, định mức tối thiểu
   từng loại, cảnh báo THIẾU, và lịch sử nhập xuất.

**Nhập danh mục sơn từ file** (`/paint/import`) — nạp nhanh bảng sơn của hãng thay vì gõ tay:

- **Excel (.xls/.xlsx):** tự dò cột theo tiêu đề, đọc mọi sheet, bỏ qua sheet không có bảng.
  Nhận cả tiếng Việt lẫn tiếng Anh: Tên sơn/Product · Hãng/Maker · Loại/Type · Mã màu/Colour code ·
  Đơn vị/Unit · Dung tích/Pack · Độ phủ/Coverage · DFT · Dung môi/Thinner · Tồn/Q'ty.
  Đọc được số thập phân kiểu Việt Nam (`7,5`).
- **Dán từ PDF:** mở PDF → Ctrl+A → Ctrl+C → dán vào ô text. App tách cột theo Tab, dấu `|`
  hoặc khoảng trắng liền nhau. Không có dòng tiêu đề thì mỗi dòng là một tên sơn, và loại sơn
  được đoán từ tên ("chống hà" → Anti-fouling, "lót" → Primer).
- Chọn tàu thì **cột số lượng được ghi thành tồn sơn** của tàu đó (đặt số tuyệt đối, không cộng dồn).

Ghép theo **tên sơn**: tên đã có thì chỉ **bổ sung ô còn trống**, không ghi đè thông tin đã chỉnh
trong app — nên nhập lại cùng file không sinh bản sao.

> **Vì sao không đọc thẳng file PDF?** Máy chưa cài thư viện đọc PDF và không có `npm` để cài thêm.
> Tự viết bộ đọc PDF thì chỉ chạy được với PDF dạng chữ, hỏng với PDF scan — thử trên 2 file PDF
> sẵn có thì không giải nén được stream nào. Với dữ liệu thật, đọc sai còn tệ hơn không đọc, nên
> để trình đọc PDF lo phần trích chữ rồi dán vào là chắc chắn hơn.

**Dự trù sơn** — trang tàu tự gộp lượng cần của mọi khu vực theo từng loại sơn, đối chiếu
với tồn hiện có và ra số **cần mua thêm**. Lớp nào thiếu diện tích m² hoặc thiếu độ phủ thì
được đếm riêng và báo rõ, không đưa vào con số dự trù.

**Tiêu thụ sơn 12 tháng gần nhất** — tổng hợp từ giao dịch xuất, gồm cả phần trừ tự động
khi ghi nhật ký thi công.

**Sao chép sơ đồ từ tàu khác** — tàu cùng loạt dùng chung hệ sơn, chép cả khu vực lẫn các
lớp sang tàu mới. Khu vực trùng tên được **bỏ qua**, không ghi đè sơ đồ đã chỉnh riêng.

**Danh mục sơn** (`/paint/products`) dùng chung toàn đội: hãng, loại sơn (Primer /
Anti-corrosive / Anti-fouling / Topcoat / Deck / Tank), mã màu, đơn vị, dung tích lon,
độ phủ m²/L, DFT mỗi lớp, dung môi pha. Điền **độ phủ** thì app mới ước lượng được lượng cần.

Không seed dữ liệu mẫu — mỗi tàu tự khai khu vực theo thực tế. Tuân theo phạm vi tàu như
toàn app; ADMIN và thuyền trưởng chỉnh sửa, thuyền viên chỉ xem.

Lưu ý phân biệt: **sơn** nằm ở module này, còn **dụng cụ sơn** (chổi, con lăn, cây rút,
khuôn kẻ chữ) vẫn thuộc danh mục vật tư boong.

## Báo cáo theo biểu mẫu công ty

App tạo và in được 2 loại báo cáo đúng biểu mẫu Mercury Lines (nút **In báo cáo** → hộp thoại in của trình duyệt → giấy/PDF khổ A4 ngang, tự ẩn menu):

| Trang | Biểu mẫu | Cách hoạt động |
|---|---|---|
| **Báo cáo vật tư** (`/reports`) | MLS-11-01 / MLS-11-04 — Báo cáo nhận và sử dụng vật tư | **Tự động tổng hợp** từ giao dịch nhập/xuất trong app: chọn tàu + bộ phận (Máy/Boong/Kho tiêu hao/Tất cả) + tháng → bảng SL tồn đợt trước, Nhận (SL+ngày), Sử dụng (SL+ngày), Tồn trên tàu. Không phải nhập tay số liệu. |
| **Chằng buộc container** (`/lashing`) | MLS-11-13 — Báo cáo dụng cụ chằng buộc container | Sổ **trang bị chuẩn** từng tàu (SL tối thiểu + trang bị chuẩn, ADMIN chỉnh); mỗi chuyến ADMIN/MASTER kiểm đếm nhập 2 cột *Còn dùng được / Bị hỏng* (điền sẵn số lần trước) → app tự tính Tổng tồn, SL thiếu, **SL cần đặt mua** và gợi ý chuyển sang trang Yêu cầu vật tư để mua sắm. |

Cả hai trang đều tuân theo phạm vi tàu (CREW chỉ thấy tàu mình, chỉ xem không lập).

### Tải file báo cáo từ tàu (`/documents` — "Báo cáo từ tàu")

Tàu tải trực tiếp file báo cáo gốc (PDF hoặc Excel .xls/.xlsx, tối đa 20MB) lên app để quản lý tập trung. **File là bản lưu bất biến:** không có chức năng sửa/thay thế — thuyền viên sau khi nộp không thể chỉnh sửa; mỗi bản nộp được lưu vĩnh viễn kèm **mã toàn vẹn SHA-256** (tính trên máy chủ) để đối chiếu file không bị thay đổi; chỉ **quản trị viên** mới có quyền xóa. Nộp nhầm thì tải bản đúng lên (bản mới nằm trên cùng). File lưu trong `UPLOAD_DIR` (mặc định `./uploads`, trong Docker là `/data/uploads` thuộc volume bền vững) với tên ngẫu nhiên; tải xuống qua route có kiểm tra đăng nhập + phạm vi tàu, ép Content-Type theo whitelist + `nosniff` nên PDF/Excel độc hại không chạy được script. CREW/MASTER chỉ thấy và tải file của tàu mình phụ trách.

## Cấu trúc chính

- `prisma/schema.prisma` — model nghiệp vụ: User, Vessel, Warehouse, Category, Material, Inventory, InventoryTransaction, MaterialRequest(+Item), Supplier, PurchaseOrder(+Item), FormStandard, LashingGear/Report, ReportDocument, và nhóm sơn: PaintProduct, PaintArea, PaintSchemeLayer, PaintStock, PaintTransaction, PaintJob(+Line)
- `app/paint-actions.ts` — server action của module sơn (tách khỏi `app/actions.ts`)
- `lib/paintTypes.ts` — hằng số loại sơn dùng chung (file `"use server"` chỉ được export hàm async)
- `app/actions.ts` — server actions: tạo tàu, tạo vật tư, nhập/xuất kho (transaction, chặn xuất quá tồn), đổi trạng thái yêu cầu
- `app/api/material-requests/route.ts` — API tạo yêu cầu vật tư
- `app/(app)/dashboard|vessels|materials|inventory|requests|users/page.tsx` — các trang chức năng
- `app/(app)/vessels/[id]/page.tsx` — trang chi tiết tàu (click tên tàu ở bất kỳ bảng nào): sửa/xóa tàu (ADMIN), kho + tồn kho + nhập/xuất của riêng tàu, tạo & duyệt yêu cầu ngay trên trang tàu
- `prisma/seed.ts` — dữ liệu mẫu Mercury Lines
