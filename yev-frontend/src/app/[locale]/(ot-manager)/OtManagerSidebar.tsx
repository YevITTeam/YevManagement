"use client";

import { Link, usePathname } from "@/navigation";
import { useTranslations } from "next-intl";
import { Bot, FilePlus2, ClipboardList, FolderCog, PenTool, KeyRound, PanelLeftClose, CalendarClock, Layers } from "lucide-react";
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
    // Cách khác để tạo đơn — qua hội thoại AI thay vì form tay, kết quả vẫn là 1 đơn Draft y hệt
    // (xem docs/docs-be/attendance-aichat-be-huong-dan.md). Permission riêng vì đây là tool ghi dữ
    // liệu đầu tiên của tính năng AI Chat, cố tình tách khỏi Attendance.OTForm.Create để kiểm soát
    // rollout độc lập.
    { key: "otAiChat", href: "/ot/ai-chat", icon: Bot, permission: "Attendance.AiChat.Use" },
    // Gộp 2026-07-17: "Đơn của tôi"/"Chờ tôi ký duyệt"/"Chờ tôi duyệt"/"Đơn đã xử lý"/"Đơn tôi tham
    // gia" giờ là 5 tab trong CÙNG 1 màn — permission gate ở đây chỉ cần OTForm.View (điều kiện chung
    // nhỏ nhất, đủ cho mọi Role nghiệp vụ); từng tab bên trong tự ẩn/hiện theo permission chi tiết hơn
    // (xem OtFormTabsPage.tsx). Route /ot/list (không phải /ot/forms) — /ot/forms đã đổi thành màn
    // "Chi tiết đơn" qua query string ?id= (static export, xem ot/forms/page.tsx).
    { key: "otForms", href: "/ot/list", icon: ClipboardList, permission: "Attendance.OTForm.View" },
    // "Đơn tổng" — gom đơn đang đúng bước Trưởng phòng (TerminalLevel=DepartmentManager) của cùng 1
    // Phòng ban để duyệt 1 lần. Đã redesign theo Cây chức vụ ở Giai đoạn 3.2 (2026-08-07, xem
    // docs/attendance-module.md §Đơn tổng).
    { key: "otBatches", href: "/ot/batches", icon: Layers, permission: "Attendance.OTForm.Approve" },
    // Chỉ Admin có quyền quản trị danh mục (Department/Group/Reason/OtCase/Employee) mới thấy mục này —
    // dùng .Create (không phải .View) vì đợt 2026-07-17 đã cấp thêm Department.View/Group.View/... cho
    // Role Trưởng Nhóm/Nhân viên (chỉ để load dropdown lúc tạo đơn), gate bằng .View sẽ lộ nhầm mục
    // quản trị cho 2 role này dù họ không có quyền CRUD gì trong đó.
    { key: "otCategories", href: "/ot/categories", icon: FolderCog, permission: "Attendance.Department.Create" },
    { key: "otSignature", href: "/ot/signature", icon: PenTool, permission: "Attendance.UserSignature.Update" },
    {
        key: "otSecondaryPassword",
        href: "/ot/secondary-password",
        icon: KeyRound,
        permission: "Attendance.SecondaryPassword.Update",
    },
    { key: "otAccumulation", href: "/ot/accumulation", icon: CalendarClock },
];

export default function OtManagerSidebar() {
    const t = useTranslations("Navigation");
    const pathname = usePathname() || "";
    const { user } = useAuth();
    const { collapsed, toggle } = useSidebarCollapse();

    return (
        <aside
            className={`print:hidden fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#e0e3e5] bg-[#f7f9fb] py-6 transition-[width] duration-200 ${collapsed ? "w-[4.5rem]" : "w-[13.75rem]"
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

            {/* overflow-x-clip (KHÔNG phải overflow-x-hidden): hidden vẫn tạo scroll container nên khi
                trình duyệt tự scrollIntoView() 1 link đang focus/active, nav bị cuộn ngang và kẹt luôn
                ở đó (không thanh cuộn để kéo lại) — icon + đầu chữ label bị cắt mất. clip không tạo
                scroll container nên không thể bị cuộn ngang nữa. */}
            <nav className="mt-8 flex-1 overflow-y-auto overflow-x-clip">
                {navItems
                    .filter((item) => !item.permission || hasPermission(user, item.permission))
                    .map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                prefetch={false}
                                title={t(item.key)}
                                className={`flex min-w-0 items-center gap-3 border-l-4 py-3 text-sm font-medium transition ${collapsed ? "justify-center px-0" : "px-5"
                                    } ${isActive
                                        ? "border-[#e3000f] bg-[#eceef0] text-[#191c1e]"
                                        : "border-transparent text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                                    }`}
                            >
                                <item.icon size={18} className={`shrink-0 ${isActive ? "text-[#e3000f]" : "text-[#5e3f3a]"}`} />
                                {!collapsed && <span className="truncate">{t(item.key)}</span>}
                            </Link>
                        );
                    })}
            </nav>
        </aside>
    );
}
