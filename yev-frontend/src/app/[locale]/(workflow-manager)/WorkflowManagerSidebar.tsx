"use client";

import { Link, usePathname } from "@/navigation";
import { useTranslations } from "next-intl";
import { Network, Layers, Users, FolderCog, Database, FileStack, PanelLeftClose, ClipboardList, Repeat, PenTool, Settings } from "lucide-react";
import { sidebarDrawerClass, useSidebarCollapse } from "@/modules/common/hooks/useSidebarCollapse";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission } from "@/modules/auth/lib/permissions";
import BrandLogo from "@/components/common/BrandLogo";

// Sidebar groups, ordered by how often each is used: own requests first, then org data, forms, system.
// An item shows when the user holds any of its permissions; groups with no visible item are hidden.
const navGroups = [
  {
    id: "requests",
    labelKey: "workflowGroupRequests",
    items: [
      { key: "workflowRequests", href: "/workflow/requests", icon: ClipboardList, permissions: ["Workflow.Request.Create"] },
      { key: "workflowDelegations", href: "/workflow/delegations", icon: Repeat, permissions: ["Workflow.Request.Create"] },
      { key: "workflowSignature", href: "/workflow/signature", icon: PenTool, permissions: ["Workflow.Signature.Update"] },
    ],
  },
  {
    id: "organization",
    labelKey: "workflowGroupOrganization",
    items: [
      { key: "workflowEmployees", href: "/workflow/employees", icon: Users, permissions: ["Workflow.Organization.View"] },
      { key: "workflowOrgUnits", href: "/workflow", icon: Network, permissions: ["Workflow.Organization.View"] },
      { key: "workflowOrgSettings", href: "/workflow/org-settings", icon: Layers, permissions: ["Workflow.Organization.View"] },
    ],
  },
  {
    id: "forms",
    labelKey: "workflowGroupForms",
    items: [
      { key: "workflowFormDefinitions", href: "/workflow/form-definitions", icon: FileStack, permissions: ["Workflow.FormDesign.View"] },
      { key: "workflowFormCategories", href: "/workflow/form-categories", icon: FolderCog, permissions: ["Workflow.FormDesign.View"] },
      { key: "workflowFormDataSources", href: "/workflow/form-data-sources", icon: Database, permissions: ["Workflow.Setting.Manage"] },
    ],
  },
  {
    id: "system",
    labelKey: "workflowGroupSystem",
    items: [{ key: "workflowSettings", href: "/workflow/settings", icon: Settings, permissions: ["Workflow.Setting.Manage"] }],
  },
] as const;

export default function WorkflowManagerSidebar() {
  const t = useTranslations("Navigation");
  const pathname = usePathname() || "";
  const { user } = useAuth();
  const { collapsed, toggle, mobileOpen } = useSidebarCollapse();

  // Groups with no item the user may see are dropped, so their header never shows up empty.
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => hasAnyPermission(user, [...item.permissions])) }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={`print:hidden fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#e0e3e5] bg-[#f7f9fb] py-6 transition-[width,transform] duration-200 ${sidebarDrawerClass(mobileOpen)} ${collapsed ? "w-[4.5rem]" : "w-[13.75rem]"
        }`}
    >
      <div className={`flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            title={t("expandSidebar")}
            aria-label={t("expandSidebar")}
            className="cursor-pointer flex h-10 w-10 shrink-0 items-center justify-center transition hover:opacity-90"
          >
            <BrandLogo className="h-10 w-10" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <BrandLogo className="h-10 w-12" />
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

      <nav className="mt-6 flex-1 overflow-y-auto overflow-x-clip">
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.id} className={groupIndex > 0 ? "mt-3" : ""}>
            {collapsed ? (
              groupIndex > 0 && <div className="mx-4 mb-2 border-t border-[#e0e3e5]" />
            ) : (
              <p className="px-5 pb-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#6b7075]">{t(group.labelKey)}</p>
            )}
            {group.items.map((item) => {
              const isActive = item.href === "/workflow"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  prefetch={false}
                  title={t(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-w-0 items-center gap-3 border-l-4 py-2.5 text-sm font-medium transition ${collapsed ? "justify-center px-0" : "px-5"
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
          </div>
        ))}
      </nav>
    </aside>
  );
}
