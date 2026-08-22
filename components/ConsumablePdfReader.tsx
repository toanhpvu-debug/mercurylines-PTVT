"use client";

import { useState, useTransition } from "react";
import { docPhieuTuPdf } from "@/app/consumable-actions";
import type { PhieuDeXuat } from "@/lib/bunkerParse";

export type KetQuaDoc = {
  deXuat?: PhieuDeXuat;
  tepTam?: string;
  tenTep?: string;
  coTep?: number;
};

/**
 * Đọc BDN / phiếu giao từ file PDF — kể cả bản SCAN — rồi điền sẵn vào form.
 *
 * KHÔNG dùng <form> riêng: component này nằm bên trong form ghi phiếu, mà HTML
 * không cho lồng form. Gọi thẳng server action như một hàm async.
 *
 * Máy chỉ ĐỀ XUẤT; người nhập đối chiếu với bản gốc rồi mới bấm lưu. Bản gốc
 * được đính kèm luôn vào phiếu — đó mới là chỗ bảo đảm chính xác về sau, chứ
 * không phải tin vào máy đọc.
 */
export default function ConsumablePdfReader({
  vesselId,
  onDoc,
}: {
  vesselId: number;
  onDoc: (kq: KetQuaDoc) => void;
}) {
  const [dangChay, batDau] = useTransition();
  const [thongBao, setThongBao] = useState("");
  const [tot, setTot] = useState(false);
  const [chu, setChu] = useState("");
  const [tep, setTep] = useState<File | null>(null);

  const doc = () => {
    if (!tep) {
      setThongBao("Hãy chọn file PDF.");
      setTot(false);
      return;
    }
    const fd = new FormData();
    fd.set("vesselId", String(vesselId));
    fd.set("file", tep);
    batDau(async () => {
      const kq = await docPhieuTuPdf({ message: "" }, fd);
      setThongBao(kq.message);
      setTot(!!kq.success);
      setChu(kq.chu ?? "");
      onDoc({
        deXuat: kq.deXuat,
        tepTam: kq.tepTam,
        tenTep: tep.name,
        coTep: tep.size,
      });
    });
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <p className="text-sm font-medium text-blue-950">
        Đọc từ file PDF (kể cả bản scan)
      </p>
      <p className="mt-1 text-xs text-blue-900">
        Chọn file BDN / phiếu giao. Hệ thống nhận dạng chữ trong bản scan rồi{" "}
        <b>điền sẵn</b> các ô bên dưới. Chữ nhận từ ảnh không bao giờ đúng tuyệt
        đối — <b>đối chiếu với bản gốc trước khi lưu</b>. File được đính kèm vào
        phiếu để sau này còn đối chiếu.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setTep(e.target.files?.[0] ?? null)}
          className="rounded border bg-white p-2 text-sm"
        />
        <button
          type="button"
          onClick={doc}
          disabled={dangChay}
          className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {dangChay ? "Đang đọc bản scan..." : "Đọc file"}
        </button>
      </div>
      {thongBao && (
        <p
          className={`mt-2 text-sm ${
            tot ? "text-emerald-800" : "text-amber-900"
          }`}
        >
          {thongBao}
        </p>
      )}
      {chu && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-blue-800">
            Xem chữ máy đọc được từ bản scan
          </summary>
          <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-slate-700">
            {chu}
          </pre>
        </details>
      )}
    </div>
  );
}
