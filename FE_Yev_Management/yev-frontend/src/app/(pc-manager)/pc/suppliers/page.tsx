const suppliers = [
  { id: 1, name: "FPT Hardware", contact: "0123 456 789" },
  { id: 2, name: "Dell Viet Nam", contact: "0987 654 321" },
  { id: 3, name: "Apple Store", contact: "028 1234 5678" },
];

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Nha cung cap</h1>
          <p className="mt-2 text-sm text-slate-500">Danh sach nha cung cap thiet bi demo.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Ten nha cung cap</th>
                <th className="px-4 py-3">Lien he</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900">{supplier.id}</td>
                  <td className="px-4 py-4 text-slate-700">{supplier.name}</td>
                  <td className="px-4 py-4 text-slate-700">{supplier.contact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
