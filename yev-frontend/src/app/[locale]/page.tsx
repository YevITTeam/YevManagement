"use client";

import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, CalendarClock, Cpu, ExternalLink, FileText, MessagesSquare, Network, Notebook } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasModuleAccess } from "@/modules/auth/lib/permissions";

interface ModuleCard {
  title: string;
  desc: string;
  link: string;
  icon: ReactNode;
  visible: boolean;
  isExternal?: boolean;
  // Màu nhận diện riêng của từng module (chữ/icon/viền khi rê chuột) + màu nền nhạt của ô icon — để nhìn
  // thoáng qua là phân biệt được module, không còn 6 thẻ cùng đỏ như nhau.
  accent: string;
  tint: string;
}

export default function Home() {
  const t = useTranslations("Home");
  const { user, isLoading } = useAuth();
  // Chỉ hiện mục "Quản lý thiết bị" nếu user có ít nhất 1 permission module Asset
  const canManagePc = !isLoading && hasModuleAccess(user, "Asset");
  // Chỉ hiện mục "Quản lý tăng ca" nếu user có ít nhất 1 permission module Attendance
  const canManageOt = !isLoading && hasModuleAccess(user, "Attendance");
  // Chỉ hiện mục "Workflow" nếu user có ít nhất 1 permission module Workflow (Pha 1: tổ chức + nhân sự)
  const canManageWorkflow = !isLoading && hasModuleAccess(user, "Workflow");

  const menuItems: ModuleCard[] = [
    {
      title: t("devicesTitle"),
      desc: t("devicesDesc"),
      link: "/pc",
      icon: <Cpu className="h-6 w-6" />,
      visible: canManagePc,
      accent: "#0369a1",
      tint: "#e8f4fb",
    },
    {
      title: t("scheduleTitle"),
      desc: t("scheduleDesc"),
      link: "/schedule",
      icon: <CalendarClock className="h-6 w-6" />,
      visible: false,
      accent: "#9a5b00",
      tint: "#fff4e5",
    },
    {
      title: t("overtimeTitle"),
      desc: t("overtimeDesc"),
      link: "/ot",
      icon: <Notebook className="h-6 w-6" />,
      visible: canManageOt,
      accent: "#e3000f",
      tint: "#fff4f2",
    },
    {
      title: t("workflowTitle"),
      desc: t("workflowDesc"),
      link: "/workflow",
      icon: <Network className="h-6 w-6" />,
      visible: canManageWorkflow,
      accent: "#0f766e",
      tint: "#e6f5f2",
    },
    {
      title: t("contractsTitle"),
      desc: t("contractsDesc"),
      link: "http://10.45.1.49:9000",
      icon: <FileText className="h-6 w-6" />,
      visible: true,
      isExternal: true,
      accent: "#b45309",
      tint: "#fff4e5",
    },
    {
      title: t("chatTitle"),
      desc: t("chatDesc"),
      link: "https://intra.yev.vn/",
      icon: <MessagesSquare className="h-6 w-6" />,
      visible: true,
      isExternal: true,
      accent: "#475569",
      tint: "#f1f5f9",
    },
  ].filter((item) => item.visible);

  const internalItems = menuItems.filter((item) => !item.isExternal);
  const externalItems = menuItems.filter((item) => item.isExternal);

  const renderCard = (item: ModuleCard) => {
    const cardClasses =
      "group relative flex flex-col overflow-hidden rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md";
    const style = { "--accent": item.accent, "--tint": item.tint } as CSSProperties;

    const content = (
      <>
        {/* Vạch màu nhận diện ở mép trên thẻ */}
        <span className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]" aria-hidden />
        <div className="mb-3 flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--tint)] text-[var(--accent)]">
            {item.icon}
          </div>
          {item.isExternal && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2 py-0.5 text-[11px] font-semibold text-[#5e3f3a]">
              <ExternalLink className="h-3 w-3" />
              {t("externalBadge")}
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-[#191c1e] transition-colors group-hover:text-[var(--accent)]">{item.title}</h3>
        <p className="mt-1 flex-1 text-sm text-[#5e3f3a]">{item.desc}</p>
        <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
          {item.isExternal ? t("openExternal") : t("open")}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </div>
      </>
    );

    // Link ngoài dùng thẻ <a> mở tab mới, tránh bị next-intl thêm tiền tố ngôn ngữ.
    if (item.isExternal) {
      return (
        <a key={item.link} href={item.link} target="_blank" rel="noopener noreferrer" className={cardClasses} style={style}>
          {content}
        </a>
      );
    }
    return (
      <Link
        key={item.link}
        href={item.link}
        // KHÔNG bật prefetch — xem comment ở PcManagerSidebar.tsx (2026-08-11): output
        // "export" + routing [locale] làm URL RSC payload prefetch luôn 404.
        prefetch={false}
        className={cardClasses}
        style={style}
      >
        {content}
      </Link>
    );
  };

  return (
    <div className="min-h-[80vh] bg-[#f8fafc] px-6 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-xl border border-[#e0e3e5] bg-white px-6 py-5 shadow-sm">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">{t("eyebrow")}</p>
          <h1 className="mt-2 text-center text-3xl font-semibold text-[#191c1e]">{t("title")}</h1>
          <p className="mt-2 text-center text-sm text-[#5e3f3a]">{t("subtitle")}</p>
        </div>

        {internalItems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8a8f94]">{t("sectionApps")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{internalItems.map(renderCard)}</div>
          </section>
        )}

        {externalItems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8a8f94]">{t("sectionExternal")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{externalItems.map(renderCard)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
