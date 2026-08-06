"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import OtFormListPage from "./OtFormListPage";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";

type OtFormTabKey = "my-forms" | "pending-submissions" | "pending-approvals" | "my-actions" | "my-participations";

// docs/attendance-api-fe.md §1.1/§1.3.B (gộp 2026-07-17) — gộp 4 màn danh sách cũ ("Đơn của tôi"/
// "Chờ tôi ký duyệt"/"Chờ tôi duyệt"/"Đơn đã xử lý") + 1 tab mới "Đơn tôi tham gia" thành 1 màn "Đơn
// tăng ca" duy nhất. Chỉ gộp ở tầng UI — BE vẫn giữ nguyên 5 API riêng biệt, mỗi tab gọi đúng 1 API
// (OtFormListPage đã tự làm việc này qua prop `mode`).
export default function OtFormTabsPage() {
    const t = useTranslations("Attendance.OtFormTabs");
    const ALL_TABS: { key: OtFormTabKey; label: string }[] = [
        { key: "my-forms", label: t("tabMyForms") },
        { key: "pending-submissions", label: t("tabPendingSubmissions") },
        { key: "pending-approvals", label: t("tabPendingApprovals") },
        { key: "my-actions", label: t("tabMyActions") },
        { key: "my-participations", label: t("tabMyParticipations") },
    ];
    const { user } = useAuth();
    const canCreate = hasPermission(user, "Attendance.OTForm.Create");
    const canApprove = hasPermission(user, "Attendance.OTForm.Approve");

    // Từ 2026-08-05, khu vực OT chỉ còn 1 Role trên Identity (không còn Role riêng theo tên "Trưởng
    // nhóm") nên không còn cách nào tra "user có phải Trưởng nhóm" từ FE — hiện tab này cho mọi người
    // có OTForm.Create (cùng điều kiện với "my-forms"). Người không có UserApprovalScope(Submitter)
    // vẫn vào được tab nhưng danh sách rỗng (BE tự lọc), không còn ẩn hẳn tab như trước.
    const visibleTabs = ALL_TABS.filter((tab) => {
        if (tab.key === "my-forms") return canCreate;
        if (tab.key === "pending-submissions") return canCreate;
        if (tab.key === "pending-approvals") return canApprove;
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
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">{t("description")}</p>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-[#e0e3e5]">
                {visibleTabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => selectTab(tab.key)}
                            className={`cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                                isActive
                                    ? "border-[#e3000f] text-[#191c1e]"
                                    : "border-transparent text-[#5e3f3a] hover:text-[#191c1e]"
                            }`}
                        >
                            {tab.label}
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
