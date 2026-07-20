"use client";

import { Link, usePathname } from "@/navigation";
import { useTranslations } from "next-intl";
import { FilePlus2, ClipboardList, FolderCog, ShieldCheck, PenTool, PanelLeftClose, CalendarClock } from "lucide-react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useSidebarCollapse } from "@/modules/common/hooks/useSidebarCollapse";

interface OtNavItem {
    key: string;
    href: string;
    icon: typeof FilePlus2;
    permission?: string;
}

// Permission theo từng mục — bảng Vai trò → Menu (docs/attendance-api-fe.md §1.1). "Lũy kế của tôi"
// (otAccumulation) cố ý KHÔNG gắn permission — bất kỳ user đăng nhập nào cũng thấy được (§3.6/§1.4).
const navItems: OtNavItem[] = [
    { key: "otCreate", href: "/ot/create", icon: FilePlus2, permission: "Attendance.OTForm.Create" },
    // Gộp 2026-07-17: "Đơn của tôi"/"Chờ tôi ký duyệt"/"Chờ tôi duyệt"/"Đơn đã xử lý"/"Đơn tôi tham
    // gia" giờ là 5 tab trong CÙNG 1 màn — permission gate ở đây chỉ cần OTForm.View (điều kiện chung
    // nhỏ nhất, đủ cho mọi Role nghiệp vụ); từng tab bên trong tự ẩn/hiện theo permission chi tiết hơn
    // (xem OtFormTabsPage.tsx). Route /ot/list (không phải /ot/forms) — /ot/forms đã đổi thành màn
    // "Chi tiết đơn" qua query string ?id= (static export, xem ot/forms/page.tsx).
    { key: "otForms", href: "/ot/list", icon: ClipboardList, permission: "Attendance.OTForm.View" },
    // Chỉ Admin có quyền quản trị danh mục (Department/Group/Reason/OtCase/Employee) mới thấy mục này —
    // dùng .Create (không phải .View) vì đợt 2026-07-17 đã cấp thêm Department.View/Group.View/... cho
    // Role Trưởng Group/Nhân viên (chỉ để load dropdown lúc tạo đơn), gate bằng .View sẽ lộ nhầm mục
    // quản trị cho 2 role này dù họ không có quyền CRUD gì trong đó.
    { key: "otCategories", href: "/ot/categories", icon: FolderCog, permission: "Attendance.Department.Create" },
    // Chỉ Admin/người có quyền quản trị phạm vi duyệt mới thấy mục này (docs/attendance-api-fe.md §5).
    { key: "otApprovalScopes", href: "/ot/approval-scopes", icon: ShieldCheck, permission: "Attendance.UserApprovalScope.View" },
    { key: "otSignature", href: "/ot/signature", icon: PenTool, permission: "Attendance.UserSignature.Update" },
    { key: "otAccumulation", href: "/ot/accumulation", icon: CalendarClock },
];

export default function OtManagerSidebar() {
    const t = useTranslations("Navigation");
    const pathname = usePathname() || "";
    const { user } = useAuth();
    const { collapsed, toggle } = useSidebarCollapse();

    return (
        <aside
            className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#e0e3e5] bg-[#f7f9fb] py-6 transition-[width] duration-200 ${collapsed ? "w-[4.5rem]" : "w-[13.75rem]"
                }`}
        >
            <div className={`flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
                {collapsed ? (
                    <button
                        type="button"
                        onClick={toggle}
                        title={t("expandSidebar")}
                        aria-label={t("expandSidebar")}
                        className="cursor-pointer flex h-10 w-10 shrink-0 items-center justify-center bg-[#e3000f] text-lg font-bold text-white transition hover:opacity-90"
                    >
                        Y
                    </button>
                ) : (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#e3000f] text-lg font-bold text-white">
                                Y
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-[#191c1e]">YEV IT</div>
                                <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#5e3f3a]">{t("otManagerTagline")}</div>
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

            <nav className="mt-8 flex-1 overflow-y-auto overflow-x-hidden">
                {navItems
                    .filter((item) => !item.permission || hasPermission(user, item.permission))
                    .map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                title={collapsed ? t(item.key) : undefined}
                                className={`flex items-center gap-3 border-l-4 py-3 text-sm font-medium transition ${collapsed ? "justify-center px-0" : "px-5"
                                    } ${isActive
                                        ? "border-[#e3000f] bg-[#eceef0] text-[#191c1e]"
                                        : "border-transparent text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                                    }`}
                            >
                                <item.icon size={18} className={isActive ? "text-[#e3000f]" : "text-[#5e3f3a]"} />
                                {!collapsed && <span>{t(item.key)}</span>}
                            </Link>
                        );
                    })}
            </nav>
        </aside>
    );
}
