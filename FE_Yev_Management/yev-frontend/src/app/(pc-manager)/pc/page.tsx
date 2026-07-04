"use client";

import { useMemo, useState } from "react";

const statusLabels: Record<number, string> = {
  1: "Chờ vận hành",
  2: "Đang dùng",
  3: "Thanh lý",
  4: "Thuê ngoài",
};

const statusClasses: Record<number, string> = {
  1: "border border-[#e9bcb6] bg-[#fff4f2] text-[#930006]",
  2: "border border-[#d8e2ff] bg-[#f4f5ff] text-[#004494]",
  3: "border border-[#ffdad6] bg-[#fff8f7] text-[#93000a]",
  4: "border border-[#dae2fd] bg-[#f5f7ff] text-[#5c647a]",
};

const mockDevices = [
  {
    id: 1,
    maMay: "PC-HN-00124",
    tenMay: "Dell Optiplex 7090",
    loaiThietBi: "Máy bàn",
    nhaCungCap: "FPT Hardware",
    chiNhanh: "Hà Nội HQ",
    nguoiQuanLy: "Nguyễn Văn A",
    email: "a.nguyen@yevmgr.local",
    ngayMua: "2024-01-15",
    hanSuDung: "2028-01-14",
    trangThai: 2,
  },
  {
    id: 2,
    maMay: "LT-DN-0089",
    tenMay: "Lenovo ThinkPad T14",
    loaiThietBi: "Laptop",
    nhaCungCap: "Dell Việt Nam",
    chiNhanh: "Đà Nẵng Branch",
    nguoiQuanLy: "Trần Thị B",
    email: "b.tran@yevmgr.local",
    ngayMua: "2023-09-10",
    hanSuDung: "2027-09-09",
    trangThai: 1,
  },
  {
    id: 3,
    maMay: "PC-HCM-0342",
    tenMay: "HP ProDesk 600",
    loaiThietBi: "Máy bàn",
    nhaCungCap: "ASUS",
    chiNhanh: "HCM Office",
    nguoiQuanLy: "Lê Văn C",
    email: "c.le@yevmgr.local",
    ngayMua: "2022-12-05",
    hanSuDung: "2026-12-04",
    trangThai: 2,
  },
  {
    id: 4,
    maMay: "SV-HN-0471",
    tenMay: "Server Dell PowerEdge",
    loaiThietBi: "Máy chủ",
    nhaCungCap: "ASUS",
    chiNhanh: "Hà Nội HQ",
    nguoiQuanLy: "Phạm Thị D",
    email: "d.pham@yevmgr.local",
    ngayMua: "2021-05-20",
    hanSuDung: null,
    trangThai: 4,
  },
];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function PcDashboardPage() {
  const [query, setQuery] = useState("");

  const filteredDevices = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return mockDevices;
    }

    return mockDevices.filter((device) =>
      [device.maMay, device.tenMay, device.loaiThietBi, device.nhaCungCap, device.chiNhanh, device.nguoiQuanLy]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  const activeDevices = mockDevices.filter((item) => item.trangThai === 2).length;
  const pendingDevices = mockDevices.filter((item) => item.trangThai === 1).length;
  const otherDevices = mockDevices.filter((item) => item.trangThai !== 2 && item.trangThai !== 1).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[32px] font-semibold text-[#191c1e]">Quản lý Thiết bị</h1>
          <p className="mt-1 text-[15px] text-[#5e3f3a]">Quản lý và theo dõi thiết bị phần cứng qua các văn phòng.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]">
            ↻ Đồng bộ Tanium
          </button>
          <button className="border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]">
            ⤴ Nhập từ Excel
          </button>
          <button className="bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]">
            + Thêm mới
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="border border-[#e0e3e5] bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">Tổng tài sản</div>
          <div className="mt-3 text-[32px] font-semibold text-[#191c1e]">{mockDevices.length}</div>
        </div>
        <div className="border border-[#e0e3e5] bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">Đang kết nối</div>
          <div className="mt-3 text-[32px] font-semibold text-[#191c1e]">{activeDevices}</div>
        </div>
        <div className="border border-[#e0e3e5] bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">Cần cập nhật</div>
          <div className="mt-3 text-[32px] font-semibold text-[#e3000f]">{pendingDevices}</div>
        </div>
        <div className="border border-[#e0e3e5] bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">Trạng thái hệ thống</div>
          <div className="mt-3 flex items-center gap-2 text-[20px] font-semibold text-[#191c1e]">
            <span className="h-2 w-2 bg-emerald-500" /> Tối ưu
          </div>
        </div>
      </div>

      <section className="overflow-hidden border border-[#e0e3e5] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            <select className="border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e]">
              <option>Tất cả chi nhánh</option>
              <option>Hà Nội</option>
              <option>Đà Nẵng</option>
              <option>Hồ Chí Minh</option>
            </select>
            <select className="border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e]">
              <option>Tất cả loại</option>
              <option>Máy bàn</option>
              <option>Laptop</option>
              <option>Máy chủ</option>
            </select>
          </div>
          <div className="text-sm text-[#5e3f3a]">Hiển thị {filteredDevices.length} bản ghi</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                <th className="px-6 py-3">Mã máy</th>
                <th className="px-6 py-3">Tên máy</th>
                <th className="px-6 py-3">Loại thiết bị</th>
                <th className="px-6 py-3">Chi nhánh</th>
                <th className="px-6 py-3">Trạng thái</th>
                <th className="px-6 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((device) => (
                <tr key={device.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{device.maMay}</td>
                  <td className="px-6 py-4 text-sm text-[#191c1e]">{device.tenMay}</td>
                  <td className="px-6 py-4 text-sm text-[#5e3f3a]">{device.loaiThietBi}</td>
                  <td className="px-6 py-4 text-sm text-[#5e3f3a]">{device.chiNhanh}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold ${statusClasses[device.trangThai]}`}>
                      {statusLabels[device.trangThai]}
                    </span>
                  </td>
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
            <button className="flex h-8 w-8 items-center justify-center border border-[#e0e3e5] text-sm text-[#5e3f3a]">3</button>
          </div>
          <button className="text-sm text-[#5e3f3a]">Trang sau</button>
        </div>
      </section>
    </div>
  );
}
