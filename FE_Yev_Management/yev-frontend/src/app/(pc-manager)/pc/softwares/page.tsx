const softwares = [
  { id: 1, name: "Microsoft Office", version: "2021", license: "Enterprise" },
  { id: 2, name: "Windows 11 Pro", version: "22H2", license: "OEM" },
  { id: 3, name: "Zoom", version: "5.15", license: "Standard" },
];

export default function SoftwaresPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Quan ly phan mem</h1>
          <p className="mt-2 text-sm text-slate-500">Danh sach phan mem demo cho giao dien.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Ten phan mem</th>
                <th className="px-4 py-3">Phien ban</th>
                <th className="px-4 py-3">Loai giay phep</th>
              </tr>
            </thead>
            <tbody>
              {softwares.map((item) => (
                <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900">{item.id}</td>
                  <td className="px-4 py-4 text-slate-700">{item.name}</td>
                  <td className="px-4 py-4 text-slate-700">{item.version}</td>
                  <td className="px-4 py-4 text-slate-700">{item.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
