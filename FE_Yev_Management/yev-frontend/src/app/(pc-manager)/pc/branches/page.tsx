const branches = [
  { id: 1, name: "Chi nhánh Hà Nội", address: "Số 1 Đường A, Ba Đình" },
  { id: 2, name: "Chi nhánh Đà Nẵng", address: "Số 23 Đường B, Sơn Trà" },
  { id: 3, name: "Chi nhánh TP.HCM", address: "Số 45 Đường C, Quận 1" },
];

export default function BranchesPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[32px] font-semibold text-[#191c1e]">Quản lý chi nhánh</h1>
          <p className="mt-1 text-[15px] text-[#5e3f3a]">Theo dõi danh sách chi nhánh và địa điểm vận hành.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]">
            ↻ Đồng bộ dữ liệu
          </button>
          <button className="bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]">
            + Thêm mới
          </button>
        </div>
      </div>

      <section className="overflow-hidden border border-[#e0e3e5] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            <select className="border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e]">
              <option>Tất cả khu vực</option>
              <option>Miền Bắc</option>
              <option>Miền Trung</option>
              <option>Miền Nam</option>
            </select>
          </div>
          <div className="text-sm text-[#5e3f3a]">Hiển thị {branches.length} bản ghi</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Tên chi nhánh</th>
                <th className="px-6 py-3">Địa chỉ</th>
                <th className="px-6 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{branch.id}</td>
                  <td className="px-6 py-4 text-sm text-[#191c1e]">{branch.name}</td>
                  <td className="px-6 py-4 text-sm text-[#5e3f3a]">{branch.address}</td>
                  <td className="px-6 py-4 text-right text-sm text-[#5e3f3a]">⋯</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#e0e3e5] p-4">
          <button className="text-sm text-[#5e3f3a] disabled:opacity-50" disabled>
            Trang trước
          </button>
          <div className="flex gap-1">
            <button className="flex h-8 w-8 items-center justify-center bg-[#e3000f] text-sm font-semibold text-white">1</button>
            <button className="flex h-8 w-8 items-center justify-center border border-[#e0e3e5] text-sm text-[#5e3f3a]">2</button>
          </div>
          <button className="text-sm text-[#5e3f3a]">Trang sau</button>
        </div>
      </section>
    </div>
  );
}
