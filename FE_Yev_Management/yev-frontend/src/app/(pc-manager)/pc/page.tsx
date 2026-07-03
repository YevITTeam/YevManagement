const statusLabels: Record<number, string> = {
  1: "Cho",
  2: "Dang dung",
  3: "Thanh ly",
  4: "Thue ngoai",
};

const mockDevices = [
  {
    id: 1,
    maMay: "PC-001",
    tenMay: "Workstation A1",
    loaiThietBi: "May tinh van phong",
    nhaCungCap: "FPT Hardware",
    chiNhanh: "Ha Noi",
    nguoiQuanLy: "Nguyen Van A",
    email: "a.nguyen@yevmgr.local",
    ngayMua: "2024-01-15",
    hanSuDung: "2028-01-14",
    trangThai: 2,
  },
  {
    id: 2,
    maMay: "PC-002",
    tenMay: "Workstation B2",
    loaiThietBi: "May tinh van phong",
    nhaCungCap: "Dell Viet Nam",
    chiNhanh: "Da Nang",
    nguoiQuanLy: "Tran Thi B",
    email: "b.tran@yevmgr.local",
    ngayMua: "2023-09-10",
    hanSuDung: "2027-09-09",
    trangThai: 2,
  },
  {
    id: 3,
    maMay: "PC-003",
    tenMay: "Laptop C3",
    loaiThietBi: "Laptop",
    nhaCungCap: "Apple Store",
    chiNhanh: "Ho Chi Minh",
    nguoiQuanLy: "Le Van C",
    email: "c.le@yevmgr.local",
    ngayMua: "2022-12-05",
    hanSuDung: "2026-12-04",
    trangThai: 1,
  },
  {
    id: 4,
    maMay: "PC-004",
    tenMay: "Server D4",
    loaiThietBi: "May chu",
    nhaCungCap: "ASUS",
    chiNhanh: "Ha Noi",
    nguoiQuanLy: "Pham Thi D",
    email: "d.pham@yevmgr.local",
    ngayMua: "2021-05-20",
    hanSuDung: null,
    trangThai: 4,
  },
  {
    id: 5,
    maMay: "PC-005",
    tenMay: "Workstation E5",
    loaiThietBi: "May tinh van phong",
    nhaCungCap: "ACER",
    chiNhanh: "Can Tho",
    nguoiQuanLy: "Ngo Van E",
    email: "e.ngo@yevmgr.local",
    ngayMua: "2024-03-12",
    hanSuDung: "2028-03-11",
    trangThai: 2,
  },
];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function PcDashboardPage() {
  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Danh sach thiet bi</h1>
            <p className="mt-2 text-sm text-slate-600">
              Tong quan cac thiet bi PC hien tai trong he thong.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 md:w-auto">
            <div className="rounded-3xl bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-500">Tong thiet bi</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{mockDevices.length}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-500">Dang dung</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {mockDevices.filter((item) => item.trangThai === 2).length}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-500">Cho / Thue / Thanh ly</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {mockDevices.filter((item) => item.trangThai !== 2).length}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Bang thiet bi</h2>
            <p className="mt-1 text-sm text-slate-500">Danh sach mock de hoan thien giao dien truoc khi ket noi API.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="px-4 py-3">Ma may</th>
                <th className="px-4 py-3">Ten may</th>
                <th className="px-4 py-3">Loai thiet bi</th>
                <th className="px-4 py-3">Nha cung cap</th>
                <th className="px-4 py-3">Chi nhanh</th>
                <th className="px-4 py-3">Trang thai</th>
                <th className="px-4 py-3">Nguoi quan ly</th>
                <th className="px-4 py-3">Ngay mua</th>
                <th className="px-4 py-3">Han su dung</th>
              </tr>
            </thead>
            <tbody>
              {mockDevices.map((device) => (
                <tr key={device.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900">{device.maMay}</td>
                  <td className="px-4 py-4 text-slate-700">{device.tenMay}</td>
                  <td className="px-4 py-4 text-slate-700">{device.loaiThietBi}</td>
                  <td className="px-4 py-4 text-slate-700">{device.nhaCungCap}</td>
                  <td className="px-4 py-4 text-slate-700">{device.chiNhanh}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {statusLabels[device.trangThai]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{device.nguoiQuanLy}</td>
                  <td className="px-4 py-4 text-slate-700">{formatDate(device.ngayMua)}</td>
                  <td className="px-4 py-4 text-slate-700">{formatDate(device.hanSuDung)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
