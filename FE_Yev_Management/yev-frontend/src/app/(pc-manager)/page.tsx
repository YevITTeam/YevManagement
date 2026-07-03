import Link from "next/link";

export default function PcManagerIndexPage() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
      <div className="max-w-3xl">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">PC Manager</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Chao mung den PC Manager</h1>
        <p className="mt-4 text-slate-600">
          Day la nhom trang de quan ly thiet bi, chi nhanh, loai thiet bi, IP, phan mem va nha cung cap.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/pc-manager/pc"
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Xem dashboard thiet bi
          </Link>
          <Link
            href="/pc-manager/pc/branches"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Danh sach chi nhanh
          </Link>
        </div>
      </div>
    </div>
  );
}
