"use client";

import { Link, usePathname } from "@/navigation";
import { useTranslations } from "next-intl";
import { Bot, FilePlus2, ClipboardList, FolderCog, PenTool, KeyRound, PanelLeftClose, UserCheck, LayoutDashboard, History } from "lucide-react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission, hasPermission } from "@/modules/auth/lib/permissions";
import { sidebarDrawerClass, useSidebarCollapse } from "@/modules/common/hooks/useSidebarCollapse";
import { usePendingApprovalsCount } from "@/modules/attendance/hooks/usePendingApprovalsCount";
import { useOverviewAccess } from "@/modules/attendance/hooks/useOverviewAccess";
import { OT_CATEGORIES_PERMISSIONS } from "@/modules/attendance/lib/otRoutePermissions";
import BrandLogo from "@/components/common/BrandLogo";

interface OtNavItem {
    key: string;
    href: string;
    icon: typeof FilePlus2;
    // Visible if the user has ANY of these.
    permissions?: string[];
    // Shown only to Admin / Manager-and-above (see useOverviewAccess).
    requiresOverviewAccess?: boolean;
}

const navItems: OtNavItem[] = [
    { key: "otOverview", href: "/ot/overview", icon: LayoutDashboard, permissions: ["Attendance.OTForm.Approve"], requiresOverviewAccess: true },
    // Line Leaders have only CreateProduction but still need this item.
    { key: "otCreate", href: "/ot/create", icon: FilePlus2, permissions: ["Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction"] },
    // Separate permission so the AI chat (first AI tool that writes data) can be rolled out independently.
    { key: "otAiChat", href: "/ot/ai-chat", icon: Bot, permissions: ["Attendance.AiChat.Use"] },
    // One screen with tabs; each tab gates itself on finer permissions (OtFormTabsPage.tsx).
    { key: "otForms", href: "/ot/list", icon: ClipboardList, permissions: ["Attendance.OTForm.View"] },
    { key: "otDelegations", href: "/ot/delegations", icon: UserCheck, permissions: ["Attendance.OTForm.Delegate"] },
    // Gated on .Create, not .View: staff roles get .View just to load dropdowns. Approval-tree coordinators
    // (*ApprovalStep.Update) and Group Leaders (ProductionOtReport.View only) need it for their own tab.
    {
        key: "otCategories",
        href: "/ot/categories",
        icon: FolderCog,
        permissions: OT_CATEGORIES_PERMISSIONS,
    },
    { key: "otSignature", href: "/ot/signature", icon: PenTool, permissions: ["Attendance.UserSignature.Update"] },
    {
        key: "otSecondaryPassword",
        href: "/ot/secondary-password",
        icon: KeyRound,
        permissions: ["Attendance.SecondaryPassword.Update"],
    },
    { key: "otAuditTrail", href: "/ot/audit-trail", icon: History, permissions: ["Attendance.AuditTrail.View"] },
];

export default function OtManagerSidebar() {
    const t = useTranslations("Navigation");
    const pathname = usePathname() || "";
    const { user } = useAuth();
    const { collapsed, toggle, mobileOpen } = useSidebarCollapse();
    const pendingApprovalsCount = usePendingApprovalsCount(hasPermission(user, "Attendance.OTForm.Approve"));
    const canViewOverview = useOverviewAccess(hasPermission(user, "Attendance.OTForm.Approve"));

    return (
        <aside
            className={`print:hidden fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#e0e3e5] bg-[#f7f9fb] py-4 transition-[width,transform] duration-200 ${sidebarDrawerClass(mobileOpen)} ${collapsed ? "w-[4.5rem]" : "w-[13.75rem]"
                }`}
        >
            <div className={`flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
                {collapsed ? (
                    <button
                        type="button"
                        onClick={toggle}
                        title={t("expandSidebar")}
                        aria-label={t("expandSidebar")}
                        className="cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center transition hover:opacity-90"
                    >
                        <BrandLogo />
                    </button>
                ) : (
                    <>
                        <div className="flex items-center gap-3">
                            <BrandLogo className="h-8 w-10" />
                            <div>
                                <div className="text-base font-semibold leading-tight text-[#191c1e]">YEV IT</div>
                                <div className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] text-[#5e3f3a]">{t("otManagerTagline")}</div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={toggle}
                            title={t("collapseSidebar")}
                            aria-label={t("collapseSidebar")}
                            className="cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center text-[#5e3f3a] transition hover:bg-[#eceef0] hover:text-[#191c1e]"
                        >
                            <PanelLeftClose size={18} />
                        </button>
                    </>
                )}
            </div>

            {/* overflow-x-clip, not hidden: hidden creates a scroll container that scrollIntoView() can shift sideways and get stuck. */}
            <nav className="mt-5 flex-1 space-y-1 overflow-y-auto overflow-x-clip">
                {navItems
                    .filter((item) => (!item.permissions || hasAnyPermission(user, item.permissions)) && (!item.requiresOverviewAccess || canViewOverview))
                    .map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        const badgeCount = item.key === "otForms" ? pendingApprovalsCount : 0;
                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                // Prefetch off: with static export + [locale] routing the RSC prefetch URL always 404s.
                                prefetch={false}
                                title={badgeCount > 0 ? `${t(item.key)} (${badgeCount})` : t(item.key)}
                                className={`flex min-w-0 items-center gap-3 border-l-4 py-3.5 text-[15px] font-medium transition ${collapsed ? "justify-center px-0" : "px-5"
                                    } ${isActive
                                        ? "border-[#e3000f] bg-[#eceef0] text-[#191c1e]"
                                        : "border-transparent text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                                    }`}
                            >
                                <span className="relative shrink-0">
                                    <item.icon size={20} className={isActive ? "text-[#e3000f]" : "text-[#5e3f3a]"} />
                                    {badgeCount > 0 && collapsed && (
                                        <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-[#e3000f]" />
                                    )}
                                </span>
                                {!collapsed && <span className="truncate">{t(item.key)}</span>}
                                {!collapsed && badgeCount > 0 && (
                                    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#e3000f] px-1.5 text-xs font-semibold text-white">
                                        {badgeCount > 99 ? "99+" : badgeCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
            </nav>

            {user && (
                <div className={`mt-2 border-t border-[#e0e3e5] pt-3 ${collapsed ? "px-2" : "px-4"}`}>
                    <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`} title={user.fullName ?? user.userName}>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#191c1e] text-xs font-semibold text-white">
                            {user.fullName?.charAt(0)?.toUpperCase() ?? "U"}
                        </div>
                        {!collapsed && (
                            <div className="min-w-0 leading-tight">
                                <p className="truncate text-xs font-semibold text-[#191c1e]">{user.fullName}</p>
                                <p className="truncate text-[11px] text-[#5e3f3a]">{user.userName}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </aside>
    );
}
