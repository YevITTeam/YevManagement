"use client";

import { Link, usePathname } from "@/navigation";
import { useTranslations } from "next-intl";
import { Bot, FilePlus2, ClipboardList, FolderCog, PenTool, KeyRound, PanelLeftClose, Layers, UserCheck } from "lucide-react";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission, hasPermission } from "@/modules/auth/lib/permissions";
import { useSidebarCollapse } from "@/modules/common/hooks/useSidebarCollapse";
import { usePendingApprovalsCount } from "@/modules/attendance/hooks/usePendingApprovalsCount";
import { OT_CATEGORIES_PERMISSIONS } from "@/modules/attendance/lib/otRoutePermissions";
import BrandLogo from "@/components/common/BrandLogo";

interface OtNavItem {
    key: string;
    href: string;
    icon: typeof FilePlus2;
    // Có 1 TRONG các permission này là thấy mục — mảng 1 phần tử cho hầu hết mục, nhiều phần tử khi
    // có thêm diện phụ trách riêng (xem "otCategories").
    permissions?: string[];
}

// Permission theo từng mục — bảng Vai trò → Menu (docs/attendance-module.md §API).
const navItems: OtNavItem[] = [
    // Create/CreateProduction tách rời — Line Leader chỉ có CreateProduction vẫn cần thấy mục này
    // (2026-09-28, đồng bộ với otRoutePermissions.ts).
    { key: "otCreate", href: "/ot/create", icon: FilePlus2, permissions: ["Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction"] },
    // Cách khác để tạo đơn — qua hội thoại AI thay vì form tay, kết quả vẫn là 1 đơn Draft y hệt
    // (xem docs/docs-be/attendance-module.md §AttendanceAiChat). Permission riêng vì đây là tool ghi dữ
    // liệu đầu tiên của tính năng AI Chat, cố tình tách khỏi Attendance.OTForm.Create để kiểm soát
    // rollout độc lập.
    { key: "otAiChat", href: "/ot/ai-chat", icon: Bot, permissions: ["Attendance.AiChat.Use"] },
    // Gộp 2026-07-17: "Đơn của tôi"/"Chờ tôi ký duyệt"/"Chờ tôi duyệt"/"Đơn đã xử lý"/"Đơn tôi tham
    // gia" giờ là 5 tab trong CÙNG 1 màn — permission gate ở đây chỉ cần OTForm.View (điều kiện chung
    // nhỏ nhất, đủ cho mọi Role nghiệp vụ); từng tab bên trong tự ẩn/hiện theo permission chi tiết hơn
    // (xem OtFormTabsPage.tsx). Route /ot/list (không phải /ot/forms) — /ot/forms đã đổi thành màn
    // "Chi tiết đơn" qua query string ?id= (static export, xem ot/forms/page.tsx).
    { key: "otForms", href: "/ot/list", icon: ClipboardList, permissions: ["Attendance.OTForm.View"] },
    // "Đơn tổng" — gom đơn đang đúng bước Trưởng phòng (TerminalLevel=DepartmentManager) của cùng 1
    // Phòng ban để duyệt 1 lần. Đã redesign theo Cây chức vụ ở Giai đoạn 3.2 (2026-08-07, xem
    // docs/attendance-module.md §Đơn tổng).
    { key: "otBatches", href: "/ot/batches", icon: Layers, permissions: ["Attendance.OTForm.Approve"] },
    { key: "otDelegations", href: "/ot/delegations", icon: UserCheck, permissions: ["Attendance.OTForm.Delegate"] },
    // "Lũy kế nhân viên" (/ot/accumulation, AccumulationLookupPage.tsx) — đã bỏ khỏi sidebar
    // (2026-08-28, theo yêu cầu người dùng), route vẫn còn, chỉ không còn link trực tiếp.
    // Chỉ Admin có quyền quản trị danh mục (Department/Group/Reason/OtCase/Employee) mới thấy mục này —
    // dùng .Create (không phải .View) vì đợt 2026-07-17 đã cấp thêm Department.View/Group.View/... cho
    // Role Trưởng Nhóm/Nhân viên (chỉ để load dropdown lúc tạo đơn), gate bằng .View sẽ lộ nhầm mục
    // quản trị cho 2 role này dù họ không có quyền CRUD gì trong đó. Thêm 2 quyền
    // *ApprovalStep.Update (2026-08-11) — Người phụ trách Cây duyệt (được gán tay qua
    // DepartmentApprovalStepCoordinator/GroupApprovalStepCoordinator, xem
    // docs/docs-be/attendance-module.md §Cây chức vụ) không phải Admin nhưng vẫn cần thấy mục này để
    // vào tab "Cây duyệt" tự cấu hình đơn vị mình phụ trách. Thêm ProductionOtReport.View (2026-08-28b)
    // — Group Leader (qua JobTitlePermission, xem docs/attendance-module.md §Cây chức vụ) chỉ có
    // permission này, không có 3 permission admin trên, vẫn cần thấy mục "Danh mục" để vào ĐÚNG tab
    // "Báo cáo" — CategoryManagement.tsx tự ẩn 8 tab quản trị còn lại với người chỉ có permission này.
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
];

export default function OtManagerSidebar() {
    const t = useTranslations("Navigation");
    const pathname = usePathname() || "";
    const { user } = useAuth();
    const { collapsed, toggle } = useSidebarCollapse();
    // Badge số đơn "Chờ tôi duyệt" trên mục "Đơn tăng ca" (otForms) — chỉ gọi API khi user có quyền
    // duyệt, tự poll mỗi 60s (usePendingApprovalsCount).
    const pendingApprovalsCount = usePendingApprovalsCount(hasPermission(user, "Attendance.OTForm.Approve"));

    return (
        <aside
            className={`print:hidden fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#e0e3e5] bg-[#f7f9fb] py-4 transition-[width] duration-200 ${collapsed ? "w-[4.5rem]" : "w-[13.75rem]"
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

            {/* overflow-x-clip (KHÔNG phải overflow-x-hidden): hidden vẫn tạo scroll container nên khi
                trình duyệt tự scrollIntoView() 1 link đang focus/active, nav bị cuộn ngang và kẹt luôn
                ở đó (không thanh cuộn để kéo lại) — icon + đầu chữ label bị cắt mất. clip không tạo
                scroll container nên không thể bị cuộn ngang nữa. */}
            <nav className="mt-5 flex-1 space-y-1 overflow-y-auto overflow-x-clip">
                {navItems
                    .filter((item) => !item.permissions || hasAnyPermission(user, item.permissions))
                    .map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        const badgeCount = item.key === "otForms" ? pendingApprovalsCount : 0;
                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                // KHÔNG bật prefetch — xem comment ở PcManagerSidebar.tsx (2026-08-11):
                                // output "export" + routing [locale] làm URL RSC payload prefetch
                                // luôn 404, chỉ tổ tốn connection pool trình duyệt.
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

            {/* Chân sidebar: thẻ người dùng đang đăng nhập — lấp phần trống phía dưới khi menu ngắn (vai trò ít
                mục), thay vì để menu dồn cụm ở trên và cả cột trống bên dưới. */}
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
