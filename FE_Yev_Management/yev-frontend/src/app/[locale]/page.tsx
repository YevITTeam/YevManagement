"use client";

import { Cpu, FileText, Notebook, BarChart3 } from "lucide-react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasModuleAccess } from "@/modules/auth/lib/permissions";

export default function Home() {
  const { user, isLoading } = useAuth();
  // Chỉ hiện mục "Quản lý thiết bị" nếu user có ít nhất 1 permission module Asset (role "Quản lý Thiết
  // bị" hoặc "Admin" được seed sẵn full quyền) — trong lúc đang tải user thì ẩn tạm để tránh chớp UI
  // cho người không có quyền.
  const canManagePc = !isLoading && hasModuleAccess(user, "Asset");

  const menuItems = [
    {
      title: "Quản lý thiết bị",
      desc: "Theo dõi, kiểm kê tài sản",
      link: "/pc",
      icon: <Cpu className="w-8 h-8" />,
      visible: canManagePc,
    },
    {
      title: "Quản lý hợp đồng",
      desc: "Soạn thảo và lưu trữ hồ sơ",
      link: "#",
      icon: <FileText className="w-8 h-8" />,
      visible: true,
    },
    {
      title: "Quản lý tăng ca",
      desc: "Đăng ký hoặc phê duyệt tăng ca",
      link: "#",
      icon: <Notebook className="w-8 h-8" />,
      visible: true,
    },
    {
      title: "Báo cáo thống kê",
      desc: "Xem số liệu tổng quan",
      link: "#",
      icon: <BarChart3 className="w-8 h-8" />,
      visible: true,
    },
  ].filter((item) => item.visible);

  return (
    <div className="min-h-[80vh] bg-[#f8fafc] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="rounded-2xl border border-[#e0e3e5] bg-white p-8 shadow-sm">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">Hệ thống quản lý</p>
          <h1 className="text-center mt-3 text-4xl font-semibold text-[#191c1e]">Chào mừng đến Hệ thống</h1>
          <h2 className="text-center mt-3 text-4xl text-[15px] text-[#5e3f3a]">
            Chọn một mục bên dưới để bắt đầu quản lý các hoạt động của hệ thống theo phong cách quản lý thiết bị hiện tại.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {menuItems.map((item, index) => (
            <a
              key={index}
              href={item.link}
              className="group rounded-2xl border border-[#e0e3e5] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#e3000f] hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#fff4f2] text-[#e3000f] transition-colors group-hover:bg-[#ffe0e3]">
                {item.icon}
              </div>

              <h3 className="text-lg font-semibold text-[#191c1e] transition-colors group-hover:text-[#e3000f]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-[#5e3f3a]">{item.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}