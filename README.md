# Mercury Materials — Hệ thống quản lý vật tư đội tàu Mercury Lines

Web app quản lý vật tư cho đội tàu: Dashboard cảnh báo tồn kho thấp, quản lý đội tàu, danh mục vật tư, nhập/xuất kho theo từng kho trên tàu, và luồng yêu cầu vật tư có phê duyệt (DRAFT → APPROVED → IN_PROCUREMENT...).

**Công nghệ:** Next.js 16 (App Router, TypeScript, Tailwind CSS 4) + Prisma 6 + SQLite.

**Giao diện:** tông xanh navy hàng hải chuyên nghiệp — sidebar navy gradient với logo nhận diện Mercury Lines (SVG vector, `components/MercuryLogo.tsx`), thẻ trắng viền xanh nhạt, nút chính xanh dương. Chứng từ mua sắm (PO, RFQ) in theo kiểu letterhead hiện đại của biểu mẫu công ty: logo chữ lồng, kẻ đôi navy, bảng hàng có đầu bảng navy (giữ màu khi in nhờ `print-color-adjust: exact`), khổ **A4 dọc**; các báo cáo MLS-11-01/11-13 vẫn in A4 ngang.

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
| `sao-luu-du-lieu.cmd` | Nén database + file upload + `.env` + biểu mẫu thành bản sao lưu |
| `dong-bo-github.cmd` | Đẩy thay đổi mã nguồn lên GitHub |
| `run-dev.cmd` | Chỉ khi đang **sửa code** (có hot-reload). Chậm hơn production ~50 lần |
| `run-start.cmd` | Ép build lại từ đầu rồi chạy (~2 phút) |

`chay-app.cmd` tự kiểm tra trước khi chạy và báo bằng tiếng Việt nếu thiếu điều kiện:
thiếu `node_modules`, thiếu `.env`, thiếu `prisma/dev.db`, hoặc cổng 3000 đang bị chiếm
(trường hợp này nó **không** giết tiến trình đang chạy mà chỉ hướng dẫn dùng `dung-app.cmd`).

Node.js được dò động qua [`scripts/node-env.cmd`](scripts/node-env.cmd): ưu tiên Node cài
trong hệ thống, không có thì lấy bản mới nhất đi kèm Playwright, rồi mới đến các vị trí cài
thông thường. Trước đây đường dẫn Playwright bị ghim cứng kèm số phiên bản ở 4 file — Playwright
cập nhật là cả 4 hỏng cùng lúc.
| `dong-bo-github.cmd` | Đẩy thay đổi **mã nguồn** lên GitHub (add + commit + push) |
| `sao-luu-du-lieu.cmd` | Nén **dữ liệu** (`prisma/dev.db`, `uploads/`, `.env`, `templates/*.xlsx`) thành `E:ackup-mercuryackup-<ngày giờ>.zip` |

Hai script cuối tách bạch có chủ ý: **GitHub chỉ giữ mã nguồn, không giữ dữ liệu vận hành**.
Đẩy code lên GitHub bao nhiêu lần cũng không sao lưu được tồn kho, đơn mua hay file báo cáo đã tải lên —
việc đó là của `sao-luu-du-lieu.cmd`.

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

App chạy tại `http://localhost:3000`. Database SQLite nằm trong volume `mercury-data` (đường dẫn `/data/mercury.db` trong container) nên dữ liệu **không mất khi rebuild/restart**. Lần khởi động đầu tiên tự chạy migration + seed dữ liệu mẫu.

## Triển khai online

App dùng SQLite (ghi file trực tiếp) nên cần nền tảng có **ổ đĩa bền vững (persistent disk/volume)**. Các lựa chọn đã được chuẩn bị sẵn qua `Dockerfile`:

| Nền tảng | Cách làm |
|---|---|
| **Railway** (dễ nhất) | Tạo project từ repo GitHub → Railway tự nhận `Dockerfile` → thêm **Volume** mount vào `/data` → deploy. |
| **Render** | New Web Service → chọn repo → Runtime: Docker → thêm **Disk** mount `/data` (1 GB là đủ). |
| **Fly.io** | `fly launch` (nhận Dockerfile) → `fly volumes create mercury_data` → mount vào `/data` trong `fly.toml`. |
| **Hostinger VPS** | Template Docker + Caddy tự cấp HTTPS — có sẵn cấu hình và hướng dẫn từng bước ở [`deploy/HOSTINGER.md`](deploy/HOSTINGER.md). |
| **VPS bất kỳ** (đã có Docker) | Copy thư mục dự án lên server → `docker compose up -d --build` → trỏ domain/Nginx vào cổng 3000. |
| **Vercel** | Serverless không ghi được file SQLite. Muốn dùng Vercel phải chuyển `DATABASE_URL` sang database hosted (Turso/libSQL hoặc Postgres + đổi `provider` trong `prisma/schema.prisma`). |

Biến môi trường: `DATABASE_URL` (mặc định trong Docker là `file:/data/mercury.db`), `SESSION_SECRET` (xem mục Đăng nhập & phân quyền), và `UPLOAD_DIR` (thư mục lưu file báo cáo tải lên, mặc định Docker `/data/uploads` — nằm cùng volume với database nên không mất khi rebuild).

## Đăng nhập & phân quyền

App yêu cầu đăng nhập (session cookie ký JWT, hạn 7 ngày). Tài khoản seed sẵn dùng chung mật khẩu đặt ở biến môi trường `SEED_PASSWORD`; bỏ trống thì seed dùng tạm `ChangeMe@123` và in cảnh báo — **đổi ngay sau lần đăng nhập đầu tiên**:

| Email | Vai trò | Phạm vi | Quyền |
|---|---|---|---|
| `admin@example.com` | ADMIN | Toàn đội | Toàn quyền + quản lý người dùng (trang **Người dùng**: tạo tài khoản, đổi vai trò, gán tàu, khóa/mở khóa) |
| `master@example.com` | MASTER | Toàn đội (không gán tàu) | Nhập/xuất kho, duyệt/từ chối yêu cầu vật tư |
| `crew@example.com` | CREW | Chỉ tàu ML-001 | Xem dữ liệu tàu mình, tạo yêu cầu cho tàu mình |

**Phạm vi theo tàu:** mỗi tài khoản có thể được gán một *tàu phụ trách* (trang Người dùng). Tài khoản gán tàu (CREW hoặc MASTER) chỉ nhìn thấy và thao tác trên đúng tàu đó ở mọi trang — Dashboard, Đội tàu, Tồn kho, Yêu cầu — kể cả gõ thẳng URL tàu khác cũng nhận 404; ràng buộc được áp ở tầng truy vấn dữ liệu và trong từng server action/API. MASTER không gán tàu = vai trò văn phòng, quản lý toàn đội. CREW chưa gán tàu sẽ không thấy dữ liệu tàu nào (có banner nhắc liên hệ quản trị viên). Danh mục vật tư là dữ liệu tham chiếu chung nên mọi vai trò đều xem được.

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
