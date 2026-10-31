"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import OtFormListPage from "./OtFormListPage";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission, hasPermission } from "@/modules/auth/lib/permissions";
import { usePendingApprovalsCount } from "@/modules/attendance/hooks/usePendingApprovalsCount";
import { usePersistedTab } from "@/modules/common/hooks/usePersistedTab";

type OtFormTabKey = "my-forms" | "pending-approvals" | "my-actions" | "my-participations" | "all-forms";

// UI-only merge of the OT list screens; each tab still calls its own BE API via OtFormListPage `mode`.
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
    // Create and CreateProduction are separate: Line Leaders with only CreateProduction still need "my forms".
    const canCreate = hasAnyPermission(user, ["Attendance.OTForm.Create", "Attendance.OTForm.CreateProduction"]);
    const canApprove = hasPermission(user, "Attendance.OTForm.Approve");
    const canViewAll = hasPermission(user, "Attendance.OTForm.ViewAll");
    // Shares the hook with the sidebar badge.
    const pendingApprovalsCount = usePendingApprovalsCount(canApprove);

    const visibleTabs = ALL_TABS.filter((tab) => {
        if (tab.key === "my-forms") return canCreate;
        if (tab.key === "pending-approvals") return canApprove;
        if (tab.key === "all-forms") return canViewAll;
        return true; // only OTForm.View is needed for these tabs
    });

    const [activeTab, setActiveTab] = usePersistedTab<OtFormTabKey>(
        "ot-forms-tab",
        visibleTabs.map((tab) => tab.key),
        visibleTabs[0]?.key ?? "my-actions"
    );
    const [visitedTabs, setVisitedTabs] = useState<Set<OtFormTabKey>>(new Set());

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

            {/* Lazy-mount and keep mounted so switching tabs doesn't refetch. */}
            {visibleTabs.map((tab) =>
                visitedTabs.has(tab.key) || activeTab === tab.key ? (
                    <div key={tab.key} className={activeTab === tab.key ? "" : "hidden"}>
                        <OtFormListPage mode={tab.key} hideHeading />
                    </div>
                ) : null
            )}
        </div>
    );
}
