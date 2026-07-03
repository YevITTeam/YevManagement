const ipAddresses = [
  { id: 1, ip: "192.168.1.10", device: "PC-001", location: "Ha Noi" },
  { id: 2, ip: "192.168.1.11", device: "PC-002", location: "Da Nang" },
  { id: 3, ip: "192.168.1.12", device: "PC-003", location: "Ho Chi Minh" },
];

export default function IpsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Quan ly IP</h1>
          <p className="mt-2 text-sm text-slate-500">Danh sach IP dung cho cac thiet bi PC theo mock.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Dia chi IP</th>
                <th className="px-4 py-3">Thiet bi</th>
                <th className="px-4 py-3">Chi nhanh</th>
              </tr>
            </thead>
            <tbody>
              {ipAddresses.map((item) => (
                <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900">{item.id}</td>
                  <td className="px-4 py-4 text-slate-700">{item.ip}</td>
                  <td className="px-4 py-4 text-slate-700">{item.device}</td>
                  <td className="px-4 py-4 text-slate-700">{item.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
