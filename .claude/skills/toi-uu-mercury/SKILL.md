---
name: toi-uu-mercury
description: "Orchestrator tối ưu Mercury Materials — điều phối đội kiểm toán viên (hiệu năng & dữ liệu, bảo mật, ngôn ngữ & tên gọi, giao diện & chứng từ in, vận hành & triển khai) và QA tích hợp: kiểm toán song song → gộp phát hiện → sửa → kiểm chứng → push (tự deploy) → xác minh site thật → báo cáo. Dùng khi có yêu cầu 'tối ưu', 'tối ưu lại', 'kiểm tra toàn diện', 'rà soát', 'audit dự án', 'chạy harness', 'cải thiện app', 'làm app ổn định/mượt/an toàn', 'kiểm tra và sửa', hoặc yêu cầu lặp lại/bổ sung dựa trên kết quả lần trước ('chỉ chạy lại phần bảo mật', 'so với lần trước', 'cập nhật báo cáo'). Câu hỏi đơn lẻ về một chi tiết thì trả lời trực tiếp, không cần orchestrator."
---

# Tối ưu Mercury Materials — orchestrator

## Chế độ thực thi: sub-agent (fan-out/fan-in), bàn giao qua tệp
Môi trường Claude Code hiện tại không có `TeamCreate`/`TaskCreate`; nếu có, chuyển Phase 2 sang đội (SendMessage) và giữ nguyên cấu trúc tệp. Mọi agent gọi bằng `Agent` với `model: "opus"`, `run_in_background: true`, và **phải** đọc tệp định nghĩa `.claude/agents/{ten}.md` + skill tương ứng trước khi làm (khi `subagent_type` tùy chỉnh chưa được nạp trong phiên, gọi `general-purpose` và dán nội dung tệp định nghĩa vào prompt).

## Đội
| Agent | Định nghĩa | Skill | Đầu ra |
|---|---|---|---|
| hieu-nang | `.claude/agents/hieu-nang.md` | `do-hieu-nang-mercury` | `_workspace/01_hieu-nang_phat-hien.md` |
| bao-mat | `.claude/agents/bao-mat.md` | `kiem-toan-bao-mat-mercury` | `_workspace/01_bao-mat_phat-hien.md` |
| ngon-ngu | `.claude/agents/ngon-ngu.md` | `tu-dien-song-ngu-mercury` | `_workspace/01_ngon-ngu_phat-hien.md` |
| giao-dien | `.claude/agents/giao-dien.md` | `giao-dien-mercury` | `_workspace/01_giao-dien_phat-hien.md` |
| van-hanh | `.claude/agents/van-hanh.md` | `van-hanh-mercury` | `_workspace/01_van-hanh_phat-hien.md`, `06_van-hanh_ket-qua.md` |
| qa-tich-hop | `.claude/agents/qa-tich-hop.md` | `kiem-chung-mercury` | `_workspace/05_qa_ket-qua.md` |
Leader (phiên chính) gộp, quyết, sửa. Thư mục `_workspace/` nằm ở gốc dự án và đã có trong `.gitignore`.

## Phase 0 — Ngữ cảnh
1. `_workspace/` chưa có → chạy đầy đủ.
2. Có `_workspace/` + người dùng yêu cầu **một phần** ("chỉ bảo mật", "kiểm lại giao diện") → chỉ gọi agent đó (Phase 2 rút gọn), giữ các tệp khác, ghi đè tệp của agent được gọi.
3. Có `_workspace/` + yêu cầu chạy lại toàn bộ → đổi tên thành `_workspace_prev/` (xóa `_workspace_prev/` cũ nếu có) rồi chạy đầy đủ; agent đọc bản prev để ghi *đã xử lý / còn nguyên / mới*.
4. Ghi phạm vi người dùng nêu (trang, mô-đun, mối lo) vào `_workspace/00_yeu-cau.md`.

## Phase 1 — Chuẩn bị (leader)
- App cục bộ phải đang chạy (`curl localhost:3000/login` → 200); không thì chạy `van-hanh-mercury/scripts/build-lai.ps1`.
- `git status --short` phải sạch; có thay đổi dở thì dừng hỏi người dùng.
- Ghi số nền vào `_workspace/00_nen.md`: commit hiện tại, kết quả `kiem-chung-nhanh.ps1`, `kiem-tra-site-that.ps1`.

## Phase 2 — Kiểm toán song song (5 agent, cùng một lượt gọi)
Prompt chung cho mỗi agent (điền `{ten}`):
> Bạn là agent `{ten}` của Mercury Materials. Đọc `.claude/agents/{ten}.md` rồi skill nó chỉ định, rồi mẫu `.claude/skills/toi-uu-mercury/references/mau-phat-hien.md`. Thư mục dự án: `D:\mercurylines code\mercury-materials` (app tại http://localhost:3000, Browser pane đã đăng nhập; site thật https://srv1964387.hstgr.cloud). Phạm vi người dùng: `_workspace/00_yeu-cau.md`. **Chỉ đo và ghi phát hiện, không sửa mã.** Ghi vào `_workspace/01_{ten}_phat-hien.md`. Nếu có `_workspace_prev/01_{ten}_phat-hien.md`, ghi trạng thái từng mục cũ. Không in bí mật. Xong thì trả lời bằng 5 dòng tóm tắt: số P1/P2/P3 và mục đáng làm nhất.

Gọi cả năm trong **một** thông điệp, `run_in_background: true`. Chờ thông báo hoàn tất; agent nào chết/không ra tệp → gọi lại một lần; vẫn không → ghi "thiếu kiểm toán {ten}" trong tổng hợp và đi tiếp.

## Phase 3 — Gộp và quyết (leader)
Đọc năm tệp, viết `_workspace/02_tong-hop.md`:
- Bảng mọi phát hiện: mức · tác động lên người dùng · công sửa · rủi ro · agent. Trùng nhau thì gộp, ghi cả hai nguồn.
- **Làm ngay** (mặc định): P1; P2 có công sửa ≤ 1 giờ và rủi ro thấp; mọi thứ có script đo lại.
- **Hỏi người dùng** trước khi làm: đổi hành vi nghiệp vụ, đổi dữ liệu, nâng gói đổi major, đổi cấu hình server/Windows, xóa tệp của người dùng.
- **Không làm**: thứ đã cân nhắc và loại (README/commit) — ghi lý do để agent lần sau không đề xuất lại.

## Phase 4 — Sửa (leader, hoặc giao agent theo lĩnh vực)
Mỗi sửa: một commit nhỏ, thông điệp nêu số đo trước/sau và vì sao. Đụng từ điển → chạy `kiem-tra-ngon-ngu`; đụng `ui.tsx`/`globals.css` → grep số chỗ dùng; đụng `proxy.ts` → thăm dò tệp tĩnh; đụng truy vấn → đếm dòng bảng trước/sau. Sửa xong build lại bằng `build-lai.ps1` và nhìn trang liên quan trong Browser pane.

## Phase 5 — QA tích hợp (1 agent)
Gọi `qa-tich-hop` với danh sách tệp đã sửa (`git diff --name-only <commit nền>..HEAD`). ĐỎ → sửa theo tệp:dòng nó chỉ, chạy lại **chỉ mục liên quan**, rồi toàn bộ. Tối đa 3 vòng; vẫn ĐỎ → không deploy, báo người dùng.

## Phase 6 — Đẩy lên & xác minh (leader hoặc `van-hanh`)
`git push origin main` → webhook tự deploy (~1 phút 40) → `kiem-tra-site-that.ps1` phải 0 lệch → đọc tab Deployments thấy `1. Done` + đúng mã commit → ghi `_workspace/06_van-hanh_ket-qua.md`. Site lỗi → không rollback tự ý; báo.

## Phase 7 — Báo cáo & phản hồi
`_workspace/07_bao-cao.md` và tóm tắt cho người dùng: đã sửa gì (số trước/sau), đã cân nhắc không làm gì và vì sao, cần tay người dùng việc gì (lệnh sẵn). Kết thúc bằng câu hỏi ngắn: có phần nào muốn đội làm khác đi (thêm/bớt kiểm toán viên, đổi ngưỡng, đổi thứ tự)? Phản hồi → sửa agent/skill/orchestrator và ghi vào **Lịch sử thay đổi** ở `CLAUDE.md`.

## Xử lý lỗi
| Tình huống | Cách xử |
|---|---|
| Một agent không ra tệp | gọi lại một lần; vẫn không → tổng hợp ghi thiếu, đi tiếp |
| Quá nửa agent lỗi | dừng, báo người dùng, không sửa gì |
| Hai agent mâu thuẫn (ví dụ giao diện muốn chữ to, hiệu năng lo bảng rộng) | ghi cả hai, leader quyết theo tác động người dùng, nêu lý do trong tổng hợp |
| Build hỏng sau sửa | `chay-app.ps1` đã xóa `BUILD_ID`; đọc `app.log`, sửa, không deploy |
| QA ĐỎ 3 vòng | không deploy; báo cáo nêu rõ mục còn đỏ |
| Deploy không tự chạy > 4 phút | báo người dùng kiểm webhook; bấm Deploy tay theo `van-hanh-mercury/references/dokploy.md` |

## Kịch bản kiểm thử
**Bình thường:** "hãy tối ưu dự án" → Phase 0 thấy chưa có `_workspace/` → Phase 1 nền: commit abc1234, QA xanh, site 0 lệch → Phase 2 năm tệp `01_*` → Phase 3 tổng hợp 12 phát hiện, làm ngay 5 → Phase 4 năm commit nhỏ → Phase 5 QA XANH → Phase 6 push, `1. Done` đúng commit, site 0 lệch → Phase 7 báo cáo + hỏi phản hồi.
**Lỗi:** Phase 2 agent `giao-dien` không ra tệp (Browser pane hỏng) → gọi lại → vẫn không → tổng hợp ghi "thiếu kiểm toán giao diện" → tiếp tục với bốn lĩnh vực → báo cáo nêu rõ phần thiếu và cách chạy riêng sau ("chỉ chạy lại phần giao diện").
**Một phần:** "chỉ chạy lại phần bảo mật, so với lần trước" → Phase 0 thấy `_workspace/` → chỉ gọi `bao-mat` với đường dẫn bản cũ → tổng hợp chỉ mục bảo mật → các Phase sau như thường.

## Trigger (để tự kiểm định kỳ)
Xem `references/kiem-tra-trigger.md`: 10 câu phải kích hoạt, 10 câu gần giống nhưng thuộc skill khác.
