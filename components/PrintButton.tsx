"use client";

export default function PrintButton({
  label = "In báo cáo",
}: {
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
    >
      {label}
    </button>
  );
}
