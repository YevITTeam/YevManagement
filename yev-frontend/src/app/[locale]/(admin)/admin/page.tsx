"use client";

import { useTranslations } from "next-intl";
import { ArrowUpRight, LayoutGrid } from "lucide-react";
import { Link } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { adminNavItems } from "@/modules/auth/lib/adminNav";

export default function AdminDashboard() {
  const t = useTranslations("Navigation");
  const { user } = useAuth();
  const visibleItems = adminNavItems.filter((item) => hasPermission(user, item.permission));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-[#191c1e]">
          <LayoutGrid className="h-6 w-6 text-[#e3000f]" />
          {t("adminOverview")}
        </h1>
        <p className="mt-1 text-sm text-[#5e3f3a]">Xin chào, {user?.fullName ?? "Quản trị viên"}!</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visibleItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            prefetch={false}
            className="group flex items-center gap-3.5 rounded-xl border border-[#e0e3e5] bg-white p-4 text-left shadow-sm transition hover:border-[#e9bcb6] hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff4f2] text-[#e3000f]">
              <item.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#191c1e]">{t(item.key)}</span>
              <span className="block text-xs text-[#5e3f3a]">{t(`${item.key}Desc`)}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-[#8a8f94] transition group-hover:text-[#e3000f]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
