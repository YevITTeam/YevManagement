"use client";

import { LayoutGrid, Cpu, FileText, Notebook, BarChart3 } from "lucide-react";

export default function Home() {
  const menuItems = [
    { 
      title: "Quản lý thiết bị", 
      desc: "Theo dõi, kiểm kê tài sản", 
      link: "#", 
      icon: <Cpu className="w-8 h-8" /> 
    },
    { 
      title: "Quản lý hợp đồng", 
      desc: "Soạn thảo và lưu trữ hồ sơ", 
      link: "#", 
      icon: <FileText className="w-8 h-8" /> 
    },
    { 
      title: "Quản lý tăng ca", 
      desc: "Đăng ký hoặc phê duyệt tăng ca", 
      link: "#", 
      icon: <Notebook className="w-8 h-8" /> 
    },
    { 
      title: "Báo cáo thống kê", 
      desc: "Xem số liệu tổng quan", 
      link: "#", 
      icon: <BarChart3 className="w-8 h-8" /> 
    },
  ];

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Chào mừng đến Hệ thống</h1>
        <p className="text-md text-gray-600 max-w-xl">
          Chọn một mục bên dưới để bắt đầu quản lý các hoạt động của hệ thống.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl">
        {menuItems.map((item, index) => (
          <a
            key={index}
            href={item.link}
            className="group p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-1"
          >
            {/* Render Icon linh hoạt ở đây */}
            <div className="mb-4 text-blue-600 transition-colors group-hover:text-blue-700">
              {item.icon}
            </div>
            
            <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
              {item.title}
            </h3>
            <p className="text-sm text-gray-500 mt-2">{item.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}