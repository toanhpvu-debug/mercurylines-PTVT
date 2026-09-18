-- Dòng phiếu giao: tên tiếng Anh tách riêng (phiếu song ngữ), số trang trên bản
-- scan (để nhảy tới trang khi đối chiếu), và cảnh báo của bộ đọc AI / bộ soát
-- (dòng đáng ngờ để người duyệt soi kỹ).
ALTER TABLE "PhieuGiaoNhanDong" ADD COLUMN "tenEn" TEXT;
ALTER TABLE "PhieuGiaoNhanDong" ADD COLUMN "trang" INTEGER;
ALTER TABLE "PhieuGiaoNhanDong" ADD COLUMN "canhBao" TEXT;
