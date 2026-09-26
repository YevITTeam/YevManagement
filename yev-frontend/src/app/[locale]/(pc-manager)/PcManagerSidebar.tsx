"use client";

import { Link, usePathname } from "@/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bot,
  Building2,
  Computer,
  HardDrive,
  Monitor,
  Package,
  ShieldCheck,
  Flag,
  Users,
  Layers,
  Settings,
  PanelLeftClose,
  History,
  QrCode,
  ClipboardCheck,
  Smartphone,
  ChevronDown,
  FolderTree,
  LayoutGrid,
  ScanLine,
  SlidersHorizontal,
} from "lucide-react";
import { useSidebarCollapse } from "@/modules/common/hooks/useSidebarCollapse";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission, hasPermission } from "@/modules/auth/lib/permissions";

// Mỗi mục khai báo permission "View" của chính màn hình nó mở ra, và CHỈ hiện khi user có ít nhất 1
// trong số đó. `PcAccessGuard` chỉ chặn ở mức module (`Asset.*`) nên nếu không lọc ở đây, user chỉ
// có quyền xem Thiết bị vẫn thấy đủ menu rồi bấm vào là ăn 403 — đúng nguyên tắc "FE dựa
// user.permissions ẩn/hiện" trong docs/docs-be/asset-api-fe.md.
// Màn hình gộp 2 loại dữ liệu (IP + dải IP, Phần mềm + nhóm phần mềm) chỉ cần 1 trong 2 quyền.
const navItems = [
  { key: "devices", href: "/pc", icon: Computer, group: "assets", permissions: ["Asset.Device.View"] },
  { key: "reports", href: "/pc/reports", icon: Flag, group: "assets", permissions: ["Asset.Report.View"] },
  { key: "ips", href: "/pc/ips", icon: Monitor, group: "assets", permissions: ["Asset.IpAddress.View", "Asset.IpPrefix.View"] },
  { key: "deviceTypes", href: "/pc/device-types", icon: HardDrive, group: "catalog", permissions: ["Asset.DeviceType.View"] },
  { key: "branches", href: "/pc/branches", icon: Building2, group: "catalog", permissions: ["Asset.Branch.View"] },
  { key: "deviceGroups", href: "/pc/device-groups", icon: Layers, group: "catalog", permissions: ["Asset.DeviceGroup.View"] },
  { key: "deviceDepartments", href: "/pc/device-departments", icon: Users, group: "catalog", permissions: ["Asset.DeviceDepartment.View"] },
  { key: "softwares", href: "/pc/softwares", icon: ShieldCheck, group: "assets", permissions: ["Asset.Software.View", "Asset.SoftwareGroup.View"] },
  { key: "suppliers", href: "/pc/suppliers", icon: Package, group: "catalog", permissions: ["Asset.Supplier.View"] },
  // Asset.AuditTrail.View và Asset.AiChat.Use chỉ được seed sẵn cho Admin (docs/docs-be/asset-api-fe.md
  // §7b, §7c) — role khác phải được Admin gán tay.
  { key: "auditTrail", href: "/pc/audit-trail", icon: History, group: "system", permissions: ["Asset.AuditTrail.View"] },
  { key: "serverCheck", href: "/pc/server-check", icon: QrCode, group: "checks", permissions: ["Asset.ServerCheck.View", "Asset.ServerCheck.Scan"] },
  { key: "inventory", href: "/pc/inventory", icon: ClipboardCheck, group: "checks", permissions: ["Asset.Inventory.View", "Asset.Inventory.Scan"] },
  { key: "appReleases", href: "/pc/app-releases", icon: Smartphone, group: "system", permissions: ["Asset.AppRelease.Manage"] },
  { key: "aiChat", href: "/pc/ai-chat", icon: Bot, group: "system", permissions: ["Asset.AiChat.Use"] },
  { key: "settings", href: "/pc/settings", icon: Settings, group: "system", permissions: ["Asset.Setting.View"] },
] as const;

// Gom menu thành 4 nhóm có thể đóng/mở để cột menu không phải cuộn dọc (15 mục phẳng trước đây). Nhóm đang
// chứa trang hiện tại luôn tự mở; nhóm "Thiết bị & phần mềm" mở sẵn, các nhóm còn lại đóng cho tới khi bấm.
const navGroups = [
  { id: "assets", labelKey: "pcGroupAssets", icon: LayoutGrid, defaultOpen: true },
  { id: "catalog", labelKey: "pcGroupCatalog", icon: FolderTree, defaultOpen: false },
  { id: "checks", labelKey: "pcGroupChecks", icon: ScanLine, defaultOpen: false },
  { id: "system", labelKey: "pcGroupSystem", icon: SlidersHorizontal, defaultOpen: false },
] as const;

export default function PcManagerSidebar() {
  const t = useTranslations("Navigation");
  const pathname = usePathname() || "";
  const { user } = useAuth();
  const { collapsed, toggle } = useSidebarCollapse();
  // Người dùng tự đóng/mở nhóm nào thì ghi đè ở đây; chưa đụng tới thì theo mặc định (nhóm có trang hiện tại / defaultOpen).
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});

  return (
    // Trích xuất phần khai báo aside trong PcManagerSidebar.tsx
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
            className="cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center bg-[#e3000f] text-base font-bold text-white transition hover:opacity-90"
          >
            Y
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#e3000f] text-base font-bold text-white">
                Y
              </div>
              <div>
                <div className="text-base font-semibold leading-tight text-[#191c1e]">YEV IT</div>
                <div className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] text-[#5e3f3a]">{t("pcManagerTagline")}</div>
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
          trình duyệt tự scrollIntoView() 1 link đang focus/active, nav bị cuộn ngang và kẹt luôn ở đó
          (không thanh cuộn để kéo lại) — icon + đầu chữ label bị cắt mất. clip không tạo scroll
          container nên không thể bị cuộn ngang nữa. */}
      <nav className="mt-4 flex-1 overflow-y-auto overflow-x-clip">
        {navGroups.map((group, groupIndex) => {
          const items = navItems
            .filter((item) => item.group === group.id && hasAnyPermission(user, [...item.permissions]))
            .map((baseItem) => {
              // Người chỉ có quyền Scan (role "Kiểm tra Server"/"Kiểm kê thiết bị") không có View nên trang
              // báo cáo sẽ 403 — cho vào thẳng trang quét (asset-module.md §1.21, §1.22).
              const item =
                baseItem.key === "serverCheck" && !hasPermission(user, "Asset.ServerCheck.View")
                  ? { ...baseItem, href: "/pc/server-check/scan" }
                  : baseItem.key === "inventory" && !hasPermission(user, "Asset.Inventory.View")
                    ? { ...baseItem, href: "/pc/inventory/scan" }
                    : baseItem;
              // Logic tách riêng cho route gốc "/pc" để tránh highlight sai ở các route con
              const isActive =
                item.href === "/pc" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
              return { item, isActive };
            });
          if (items.length === 0) return null;

          const hasActive = items.some((entry) => entry.isActive);
          const isOpen = collapsed || (openOverride[group.id] ?? (hasActive || group.defaultOpen));

          const linkClassName = (isActive: boolean) =>
            collapsed
              ? `flex min-w-0 items-center justify-center gap-3 border-l-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-[#e3000f] bg-[#eceef0] text-[#191c1e]"
                    : "border-transparent text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                }`
              : `flex min-w-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition ${
                  isActive ? "bg-[#eceef0] text-[#191c1e]" : "text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                }`;

          const links = items.map(({ item, isActive }) => (
            <Link
              key={item.key}
              href={item.href}
              // KHÔNG bật prefetch: output "export" + routing [locale] khiến URL RSC payload
              // Next.js tự sinh lúc runtime không khớp file tĩnh đã export ra (out/) → mọi
              // prefetch đều 301 rồi 404 hàng loạt, không tăng tốc mà còn chiếm connection pool
              // của trình duyệt (2026-08-11, xem Network tab lúc bật thử — toàn bộ *._PAGE_.txt
              // đều lỗi). Nếu định bật lại, phải verify bằng ảnh Network thật trước.
              prefetch={false}
              title={t(item.key)}
              className={linkClassName(isActive)}
            >
              <item.icon size={collapsed ? 18 : 16} className={`shrink-0 ${isActive ? "text-[#e3000f]" : "text-[#8a8f94]"}`} />
              {!collapsed && <span className="truncate">{t(item.key)}</span>}
            </Link>
          ));

          // Thu gọn: menu phẳng chỉ icon, ngăn nhóm bằng đường kẻ mảnh.
          if (collapsed) {
            return (
              <div key={group.id} className={groupIndex > 0 ? "mt-1 border-t border-[#e0e3e5] pt-1" : ""}>
                {links}
              </div>
            );
          }

          return (
            <div key={group.id} className="px-3">
              <button
                type="button"
                onClick={() => setOpenOverride((current) => ({ ...current, [group.id]: !isOpen }))}
                aria-expanded={isOpen}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#eceef0]"
              >
                <group.icon size={16} className="shrink-0 text-[#5e3f3a]" />
                <span className="flex-1 truncate text-left">{t(group.labelKey)}</span>
                {!isOpen && hasActive && <span className="h-1.5 w-1.5 rounded-full bg-[#e3000f]" />}
                <ChevronDown size={14} className={`shrink-0 text-[#8a8f94] transition-transform ${isOpen ? "" : "-rotate-90"}`} />
              </button>
              {isOpen && <div className="ml-[1.15rem] space-y-0.5 border-l border-[#e0e3e5] pb-1 pl-2">{links}</div>}
            </div>
          );
        })}
      </nav>

      <div className={`mt-auto border-t border-[#e0e3e5] pt-3 ${collapsed ? "px-2" : "px-5"}`}>
        {collapsed ? (
          <div className="flex justify-center">
            <div
              className="flex h-9 w-9 items-center justify-center bg-[#e3000f] text-sm font-semibold text-white"
              title="Quản trị viên"
            >
              QT
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-none bg-white p-3">
            <div className="flex h-9 w-9 items-center justify-center bg-[#e3000f] text-sm font-semibold text-white">
              QT
            </div>
            <div>
              <div className="text-sm font-semibold text-[#191c1e]">Quản trị viên</div>
              <div className="text-xs text-[#5e3f3a]">Phòng IT</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}