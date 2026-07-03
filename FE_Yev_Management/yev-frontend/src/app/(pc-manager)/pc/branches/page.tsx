const branches = [
  { id: 1, name: "Chi nhanh Ha Noi", address: "So 1 Duong A, Ba Dinh" },
  { id: 2, name: "Chi nhanh Da Nang", address: "So 23 Duong B, Son Tra" },
  { id: 3, name: "Chi nhanh TP.HCM", address: "So 45 Duong C, Quan 1" },
];

export default function BranchesPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Danh sach chi nhanh</h1>
            <p className="mt-2 text-sm text-slate-500">Trang mo phong giao dien quan ly chi nhanh.</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Ten chi nhanh</th>
                <th className="px-4 py-3">Dia chi</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900">{branch.id}</td>
                  <td className="px-4 py-4 text-slate-700">{branch.name}</td>
                  <td className="px-4 py-4 text-slate-700">{branch.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
