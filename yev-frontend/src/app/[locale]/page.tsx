"use client";

import { Cpu, FileText, Notebook, CalendarClock, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasModuleAccess } from "@/modules/auth/lib/permissions";

export default function Home() {
  const t = useTranslations("Home");
  const { user, isLoading } = useAuth();
  // Chỉ hiện mục "Quản lý thiết bị" nếu user có ít nhất 1 permission module Asset
  const canManagePc = !isLoading && hasModuleAccess(user, "Asset");
  // Chỉ hiện mục "Quản lý tăng ca" nếu user có ít nhất 1 permission module Attendance
  const canManageOt = !isLoading && hasModuleAccess(user, "Attendance");

  const menuItems = [
    {
      title: t("devicesTitle"),
      desc: t("devicesDesc"),
      link: "/pc",
      icon: <Cpu className="w-8 h-8" />,
      visible: canManagePc,
    },
    {
      title: t("scheduleTitle"),
      desc: t("scheduleDesc"),
      link: "/schedule",
      icon: <CalendarClock className="w-8 h-8" />,
      visible: false,
    },
    {
      title: t("overtimeTitle"),
      desc: t("overtimeDesc"),
      link: "/ot",
      icon: <Notebook className="w-8 h-8" />,
      visible: canManageOt,
    },
    {
      title: t("contractsTitle"),
      desc: t("contractsDesc"),

      link: "http://10.45.1.49:9000",
      icon: <FileText className="w-8 h-8" />,
      visible: true,
      isExternal: true,
    },
    {
      title: t("chatTitle"),
      desc: t("chatDesc"),
      link: "https://intra.yev.vn/",
      icon: <MessagesSquare className="w-8 h-8" />,
      visible: true,
      isExternal: true,
    }
  ].filter((item) => item.visible);

  return (
    <div className="min-h-[80vh] bg-[#f8fafc] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="rounded-2xl border border-[#e0e3e5] bg-white p-8 shadow-sm">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">{t("eyebrow")}</p>
          <h1 className="text-center mt-3 text-4xl font-semibold text-[#191c1e]">{t("title")}</h1>
          <h2 className="text-center mt-3 text-4xl text-[15px] text-[#5e3f3a]">
            {t("subtitle")}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {menuItems.map((item, index) => {
            const cardClasses = "group rounded-2xl border border-[#e0e3e5] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#e3000f] hover:shadow-md block";

            // Tách phần nội dung thẻ ra để tái sử dụng
            const CardContent = () => (
              <>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#fff4f2] text-[#e3000f] transition-colors group-hover:bg-[#ffe0e3]">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-[#191c1e] transition-colors group-hover:text-[#e3000f]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-[#5e3f3a]">{item.desc}</p>
              </>
            );

            // Nếu là link ngoài, dùng thẻ <a> để mở tab mới và tránh bị next-intl can thiệp prefix ngôn ngữ
            if (item.isExternal) {
              return (
                <a
                  key={index}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cardClasses}
                >
                  <CardContent />
                </a>
              );
            }

            // Nếu là link nội bộ, giữ nguyên <Link> của next-intl
            return (
              <Link
                key={index}
                href={item.link}
                // KHÔNG bật prefetch — xem comment ở PcManagerSidebar.tsx (2026-08-11): output
                // "export" + routing [locale] làm URL RSC payload prefetch luôn 404.
                prefetch={false}
                className={cardClasses}
              >
                <CardContent />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}