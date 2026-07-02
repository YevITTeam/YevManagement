"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthApi } from "@/api/auth.api";
import { UserDto } from "@/types/auth.dto";

export default function Header() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await AuthApi.getMe();
        setUser(data);
      } catch (error) {
        console.error("Lỗi lấy thông tin:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const isAdmin = user?.roles?.includes("Admin");

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo / Tên hệ thống */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="text-2xl font-black text-blue-600 tracking-tight">
              YEV Management<span className="text-gray-800">Portal</span>
            </Link>
          </div>

          {/* Khu vực bên phải: Menu và User Info */}
          <div className="flex items-center gap-4">
            {isLoading ? (
              // Hiệu ứng loading skeleton khi đang chờ API
              <div className="h-8 w-48 bg-gray-100 animate-pulse rounded-md"></div>
            ) : user ? (
              <>
                {/* NÚT ADMIN: Chỉ render ra HTML khi thỏa mãn điều kiện isAdmin */}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="text-sm font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-md transition-all duration-200 border border-red-100 shadow-sm"
                  >
                    ⚙️ Trang quản trị Admin
                  </Link>
                )}

                {/* Thông tin người dùng */}
                <div className="flex items-center gap-3 border-l border-gray-200 pl-4 ml-2">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">{user.fullName}</p>
                    <p className="text-xs text-gray-500">{user.userName}</p>
                  </div>
                  
                  {/* Avatar tạo tự động từ chữ cái đầu của tên */}
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-blue-400 flex items-center justify-center text-white text-lg font-bold shadow-inner">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                </div>
              </>
            ) : (
              <span className="text-sm font-medium text-gray-500">Chưa đăng nhập</span>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}