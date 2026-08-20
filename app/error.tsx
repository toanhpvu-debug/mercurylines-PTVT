"use client";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-xl bg-white p-8 shadow-sm ring-1 ring-blue-100">
      <h2 className="mb-2 text-xl font-bold text-red-600">
        Thao tác không thực hiện được
      </h2>
      <p className="mb-4 text-slate-600">
        Yêu cầu vừa rồi bị từ chối. Nguyên nhân thường gặp: xuất kho vượt quá số
        lượng tồn, mã (tàu / vật tư) bị trùng, hoặc dữ liệu nhập không hợp lệ.
        Dữ liệu của bạn không bị thay đổi.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => retry()}
          className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
        >
          Thử lại
        </button>
        <button
          onClick={() => window.history.back()}
          className="rounded border px-4 py-2 hover:bg-blue-50"
        >
          Quay lại
        </button>
      </div>
    </div>
  );
}
