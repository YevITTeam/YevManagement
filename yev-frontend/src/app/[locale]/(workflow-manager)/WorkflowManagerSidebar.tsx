"use client";

import { Link, usePathname } from "@/navigation";
import { useTranslations } from "next-intl";
import { Network, Layers, BadgeCheck, Users, FolderCog, Database, FileStack, PanelLeftClose, ClipboardList, Repeat, PenTool, Settings } from "lucide-react";
import { useSidebarCollapse } from "@/modules/common/hooks/useSidebarCollapse";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission } from "@/modules/auth/lib/permissions";

// Pha 1 dùng "Workflow.Organization.View" cho nhóm tổ chức/nhân sự. Pha 2A (workflow-module.md §7,
// §8) thêm "Workflow.FormDesign.View" cho danh mục form và "Workflow.Setting.Manage" cho nguồn dữ
// liệu (màn admin-only, không có View riêng). Pha 3B-2 thêm "Workflow.Request.Create" cho "Đơn của
// tôi" + "Ủy quyền duyệt thay" — mọi người dùng có quyền nộp/duyệt đơn đều thấy 2 mục này. Pha 4 thêm
// "Workflow.Signature.Update" cho "Chữ ký của tôi" — chữ ký đăng ký sẵn, tự điền lúc duyệt đơn.
const navItems = [
  { key: "workflowRequests", href: "/workflow/requests", icon: ClipboardList, permissions: ["Workflow.Request.Create"] },
  { key: "workflowDelegations", href: "/workflow/delegations", icon: Repeat, permissions: ["Workflow.Request.Create"] },
  { key: "workflowSignature", href: "/workflow/signature", icon: PenTool, permissions: ["Workflow.Signature.Update"] },
  { key: "workflowOrgUnits", href: "/workflow", icon: Network, permissions: ["Workflow.Organization.View"] },
  { key: "workflowOrgLevels", href: "/workflow/org-levels", icon: Layers, permissions: ["Workflow.Organization.View"] },
  { key: "workflowJobTitles", href: "/workflow/job-titles", icon: BadgeCheck, permissions: ["Workflow.Organization.View"] },
  { key: "workflowEmployees", href: "/workflow/employees", icon: Users, permissions: ["Workflow.Organization.View"] },
  { key: "workflowFormCategories", href: "/workflow/form-categories", icon: FolderCog, permissions: ["Workflow.FormDesign.View"] },
  { key: "workflowFormDefinitions", href: "/workflow/form-definitions", icon: FileStack, permissions: ["Workflow.FormDesign.View"] },
  { key: "workflowFormDataSources", href: "/workflow/form-data-sources", icon: Database, permissions: ["Workflow.Setting.Manage"] },
  { key: "workflowSettings", href: "/workflow/settings", icon: Settings, permissions: ["Workflow.Setting.Manage"] },
] as const;

export default function WorkflowManagerSidebar() {
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
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#5e3f3a]">{t("workflowManagerTagline")}</div>
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

      <nav className="mt-8 flex-1 overflow-y-auto overflow-x-clip">
        {navItems
          .filter((item) => hasAnyPermission(user, [...item.permissions]))
          .map((item) => {
            const isActive = item.href === "/workflow"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");

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
                <item.icon
                  size={18}
                  className={`shrink-0 ${isActive ? "text-[#e3000f]" : "text-[#5e3f3a]"}`}
                />
                {!collapsed && <span className="truncate">{t(item.key)}</span>}
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
