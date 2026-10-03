-- Tệp sơn tải lên có hai loại: phiếu giao / nhận (cộng số nhận vào tồn) và báo cáo
-- lượng sơn tồn MLS-11-14 (đưa tồn về đúng số trong báo cáo tại ngày cuối quý —
-- ngày đó nằm ở "ngayNhan"). Mọi phiếu đã có là phiếu giao.
ALTER TABLE "SonPhieuTep" ADD COLUMN "loai" TEXT NOT NULL DEFAULT 'PHIEU_GIAO';
-- Tên tàu ghi trên tệp (báo cáo tồn) — để nhắc khi tải nhầm báo cáo của tàu khác.
ALTER TABLE "SonPhieuTep" ADD COLUMN "tauTrenTep" TEXT;
