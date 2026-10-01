"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import OtFormListPage from "./OtFormListPage";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission, hasPermission } from "@/modules/auth/lib/permissions";
import { usePendingApprovalsCount } from "@/modules/attendance/hooks/usePendingApprovalsCount";

type OtFormTabKey = "my-forms" | "pending-approvals" | "my-actions" | "my-participations" | "all-forms";

// docs/attendance-api-fe.md §1.1/§1.3.B (gộp 2026-07-17) — gộp các màn danh sách cũ ("Đơn của tôi"/
// "Chờ tôi duyệt"/"Đơn đã xử lý") + 1 tab "Đơn tôi tham gia" thành 1 màn "Đơn tăng ca" duy nhất. Chỉ
// gộp ở tầng UI — BE vẫn giữ nguyên các API riêng biệt, mỗi tab gọi đúng 1 API (OtFormListPage đã tự
// làm việc này qua prop `mode`). Tab "Chờ tôi ký duyệt" (Draft/Submitter cũ) đã dọn hẳn ở Giai đoạn
// 3.2 (2026-08-08) — khái niệm này không còn tồn tại từ khi Cây chức vụ thay thế Submitter (3.1).
export default function OtFormTabsPage() {
    const t = useTranslations("Attendance.OtFormTabs");
    const ALL_TABS: { key: OtFormTabKey; label: string }[] = [
        { key: "my-forms", label: t("tabMyForms") },
        { key: "pending-approvals", label: t("tabPendingApprovals") },
        { key: "my-actions", label: t("tabMyActions") },
        { key: "my-participations", label: t("tabMyParticipations") },
        { key: "all-forms", label: t("tabAllForms") },
    ];
    const { user } = useAuth();
    // Create/CreateProduction tách rời — Line Leader chỉ có CreateProduction vẫn cần thấy tab "Đơn của
    // tôi" (đơn theo chuyền họ tạo cũng nằm ở đây, 2026-09-28, đồng bộ với otRoutePermissions.ts).
    const canCreate = hasAnyPermission(user, ["Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction"]);
    const canApprove = hasPermission(user, "Attendance.OTForm.Approve");
    // Tab "Tất cả đơn" — chỉ Admin (permission riêng Attendance.OTForm.ViewAll, 2026-09-04).
    const canViewAll = hasPermission(user, "Attendance.OTForm.ViewAll");
    // Badge số đơn "Chờ tôi duyệt" ngay trên tab — dùng chung hook với badge sidebar (2026-08-19).
    const pendingApprovalsCount = usePendingApprovalsCount(canApprove);

    const visibleTabs = ALL_TABS.filter((tab) => {
        if (tab.key === "my-forms") return canCreate;
        if (tab.key === "pending-approvals") return canApprove;
        if (tab.key === "all-forms") return canViewAll;
        return true; // "my-actions"/"my-participations" luôn hiện — chỉ cần OTForm.View để vào được cả màn
    });

    const [activeTab, setActiveTab] = useState<OtFormTabKey | null>(null);
    const [visitedTabs, setVisitedTabs] = useState<Set<OtFormTabKey>>(new Set());

    // Chọn tab đầu tiên user thấy được làm mặc định — so sánh snapshot ngay trong render (không dùng
    // effect để setState, xem CLAUDE.md), chỉ chạy đúng 1 lần cho tới khi activeTab được set.
    const defaultTab = visibleTabs[0]?.key ?? null;
    if (activeTab === null && defaultTab !== null) {
        setActiveTab(defaultTab);
        setVisitedTabs((current) => new Set(current).add(defaultTab));
    }

    const selectTab = (key: OtFormTabKey) => {
        setActiveTab(key);
        setVisitedTabs((current) => (current.has(key) ? current : new Set(current).add(key)));
    };

    if (visibleTabs.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-semibold text-[#191c1e]">{t("title")}</h1>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-[#e0e3e5]">
                {visibleTabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const badgeCount = tab.key === "pending-approvals" ? pendingApprovalsCount : 0;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => selectTab(tab.key)}
                            className={`cursor-pointer flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                                isActive
                                    ? "border-[#e3000f] text-[#191c1e]"
                                    : "border-transparent text-[#5e3f3a] hover:text-[#191c1e]"
                            }`}
                        >
                            {tab.label}
                            {badgeCount > 0 && (
                                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#e3000f] px-1.5 text-xs font-semibold text-white">
                                    {badgeCount > 99 ? "99+" : badgeCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/*
                Lazy-mount rồi giữ luôn (giống CategoryManagement) — tab nào chưa từng bấm vào thì chưa
                mount (chưa gọi API), tab đã ghé qua giữ mounted (ẩn bằng "hidden") để chuyển qua lại
                tức thì trong phiên này, không tải lại.
            */}
            {visibleTabs.map((tab) =>
                visitedTabs.has(tab.key) ? (
                    <div key={tab.key} className={activeTab === tab.key ? "" : "hidden"}>
                        <OtFormListPage mode={tab.key} hideHeading />
                    </div>
                ) : null
            )}
        </div>
    );
}
