-- Dòng nhập / xuất / điều chỉnh do báo cáo lượng sơn tồn MLS-11-14 ghi: cột của báo
-- cáo mà dòng đó làm khớp ("tonDau", "nhan", "tieuThu", "tonCuoi"). Tờ in quý xếp dòng
-- "nhan" / "tieuThu" thẳng vào đúng cột (lib/tonSon.ts) nên in lại ra đúng bốn số của
-- báo cáo. Dòng ghi tay / phiếu giao để trống như cũ.
ALTER TABLE "PaintTransaction" ADD COLUMN "cotBaoCao" TEXT;
