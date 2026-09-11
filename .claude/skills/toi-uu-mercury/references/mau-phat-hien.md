# Mẫu tệp phát hiện `_workspace/01_{agent}_phat-hien.md`

```markdown
# {Lĩnh vực} — phát hiện ({ngày}, commit {7 ký tự})

## Tóm tắt
- P1: {n} · P2: {n} · P3: {n}
- Đáng làm nhất: {một câu}
- So với lần trước ({nếu có _workspace_prev}): đã xử lý {n} · còn nguyên {n} · mới {n}

## Phát hiện
### [P1] {Tên ngắn, nói hệ quả cho người dùng}
- **Số đo / bằng chứng:** {con số + lệnh hoặc đoạn mã để đo lại}
- **Ở đâu:** `{tệp}:{dòng}` (nhiều chỗ thì liệt kê)
- **Vì sao xảy ra:** {cơ chế, không phải nhận định}
- **Cách sửa:** {cụ thể; nếu có nhiều cách, nêu cách chọn và vì sao}
- **Rủi ro khi sửa:** {thấp/vừa/cao + gì có thể vỡ}
- **Kiểm lại bằng:** {lệnh/số kỳ vọng sau sửa}
- **Trạng thái so với lần trước:** {mới | còn nguyên | đã xử lý} (nếu có)

### [P2] ...

## Đã kiểm và thấy ổn (để lần sau không kiểm lại vô ích)
- {mục} — {số đo}

## Chưa kiểm được
- {mục} — {vì sao} — {cách kiểm khi có điều kiện}
```

Mức: **P1** ảnh hưởng người dùng ngay hoặc khai thác được từ ngoài; **P2** ảnh hưởng rõ nhưng có đường vòng / cần tài khoản; **P3** hardening, gọn mã, tiện vận hành. Không có số thì không phải phát hiện — chuyển sang mục "Chưa kiểm được".
