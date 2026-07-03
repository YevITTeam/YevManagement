const deviceTypes = [
  { id: 1, name: "May tinh van phong", description: "May tinh dung cho cong viec van phong." },
  { id: 2, name: "Laptop", description: "Thiet bi di dong cho nguoi dung ca nhan." },
  { id: 3, name: "May chu", description: "Thiet bi dung cho he thong server noi bo." },
];

export default function DeviceTypesPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Loai thiet bi</h1>
          <p className="mt-2 text-sm text-slate-500">Danh sach loai thiet bi hien tai theo mock data.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Ten loai</th>
                <th className="px-4 py-3">Mo ta</th>
              </tr>
            </thead>
            <tbody>
              {deviceTypes.map((type) => (
                <tr key={type.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900">{type.id}</td>
                  <td className="px-4 py-4 text-slate-700">{type.name}</td>
                  <td className="px-4 py-4 text-slate-700">{type.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
