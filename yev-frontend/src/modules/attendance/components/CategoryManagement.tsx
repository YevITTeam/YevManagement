"use client";
import { useCallback, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission, hasPermission } from "@/modules/auth/lib/permissions";
import WorkshopList from "./workshops/WorkshopList";
import DepartmentList from "./departments/DepartmentList";
import GroupList from "./groups/GroupList";
import ReasonList from "./reasons/ReasonList";
import OtCaseList from "./ot-cases/OtCaseList";
import JobTitleList from "./job-titles/JobTitleList";
import ApprovalStepManager from "./job-titles/ApprovalStepManager";
import EmployeeList from "./employees/EmployeeList";
import ProductionOtReportPanel from "./reports/ProductionOtReportPanel";
import AttendanceSettingPanel from "./settings/AttendanceSettingPanel";
import type { ListHandle } from "./list-toolbar";
import { usePersistedTab } from "@/modules/common/hooks/usePersistedTab";

type CategoryTab =
    | "workshops"
    | "departments"
    | "groups"
    | "reasons"
    | "ot-cases"
    | "job-titles"
    | "approval-steps"
    | "employees"
    | "reports"
    | "settings";

export default function CategoryManagement() {
    const t = useTranslations("Attendance.CategoryManagement");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    // Each tab is gated by its own .Create/.Update permission; .View is granted broadly just to load dropdowns.
    const canViewReports = hasPermission(user, "Attendance.ProductionOtReport.View");
    const canCreateEmployee = hasPermission(user, "Attendance.Employee.Create");
    // "settings" is not a CRUD list, so it has no add button.
    const allTabs: { key: CategoryTab; label: string; addLabel: string | null; visible: boolean }[] = [
        { key: "workshops", label: t("tabWorkshops"), addLabel: t("addWorkshops"), visible: hasPermission(user, "Attendance.Workshop.Create") },
        { key: "departments", label: t("tabDepartments"), addLabel: t("addDepartments"), visible: hasPermission(user, "Attendance.Department.Create") },
        { key: "groups", label: t("tabGroups"), addLabel: t("addGroups"), visible: hasPermission(user, "Attendance.Group.Create") },
        { key: "reasons", label: t("tabReasons"), addLabel: t("addReasons"), visible: hasPermission(user, "Attendance.Reason.Create") },
        { key: "ot-cases", label: t("tabOtCases"), addLabel: t("addOtCases"), visible: hasPermission(user, "Attendance.OtCase.Create") },
        { key: "job-titles", label: t("tabJobTitles"), addLabel: t("addJobTitles"), visible: hasPermission(user, "Attendance.JobTitle.Create") },
        {
            key: "approval-steps",
            label: t("tabApprovalSteps"),
            addLabel: null,
            visible: hasAnyPermission(user, [
                "Attendance.DepartmentApprovalStep.Update",
                "Attendance.GroupApprovalStep.Update",
                "Attendance.ProductionApprovalStep.Update",
            ]),
        },
        {
            key: "employees",
            label: t("tabEmployees"),
            addLabel: canCreateEmployee ? t("addEmployees") : null,
            visible: hasAnyPermission(user, [
                "Attendance.Employee.Create",
                "Attendance.Employee.Update",
                "Attendance.Employee.Delete",
                "Attendance.Employee.UpdateOtLimit",
                "Attendance.EmployeeAccumulation.Update",
                "Attendance.ProductionEmployee.View",
            ]),
        },
        { key: "reports", label: t("tabReports"), addLabel: null, visible: canViewReports },
        { key: "settings", label: t("tabSettings"), addLabel: null, visible: hasPermission(user, "Attendance.Setting.Update") },
    ];
    const tabs = allTabs.filter((tab) => tab.visible);
    const defaultTabKey: CategoryTab = tabs[0]?.key ?? "departments";
    const [activeTab, setActiveTab] = usePersistedTab<CategoryTab>("ot-category-tab", tabs.map((tab) => tab.key), defaultTabKey);
    // Mount a tab on first visit and keep it mounted: avoids firing every tab's API on entry while keeping
    // instant switching for visited tabs.
    const [visitedTabs, setVisitedTabs] = useState<Set<CategoryTab>>(() => new Set());
    const isMounted = (key: CategoryTab) => key === activeTab || visitedTabs.has(key);
    // Per-tab loading slots: with one shared boolean, whichever mounted tab finishes last would overwrite the visible tab's state.
    const [loadingByTab, setLoadingByTab] = useState<Record<CategoryTab, boolean>>({
        workshops: false,
        departments: false,
        groups: false,
        reasons: false,
        "ot-cases": false,
        "job-titles": false,
        "approval-steps": false,
        employees: false,
        reports: false,
        settings: false,
    });
    const loading = loadingByTab[activeTab];

    const workshopRef = useRef<ListHandle>(null);
    const departmentRef = useRef<ListHandle>(null);
    const groupRef = useRef<ListHandle>(null);
    const reasonRef = useRef<ListHandle>(null);
    const otCaseRef = useRef<ListHandle>(null);
    const jobTitleRef = useRef<ListHandle>(null);
    const approvalStepRef = useRef<ListHandle>(null);
    const employeeRef = useRef<ListHandle>(null);
    const reportsRef = useRef<ListHandle>(null);
    const settingRef = useRef<ListHandle>(null);

    const refByTab: Record<CategoryTab, React.RefObject<ListHandle | null>> = {
        workshops: workshopRef,
        departments: departmentRef,
        groups: groupRef,
        reasons: reasonRef,
        "ot-cases": otCaseRef,
        "job-titles": jobTitleRef,
        "approval-steps": approvalStepRef,
        employees: employeeRef,
        reports: reportsRef,
        settings: settingRef,
    };

    const activeRef = refByTab[activeTab];
    // Empty fallback when the user holds none of the tab permissions (direct URL; the sidebar hides the entry).
    const activeTabMeta = tabs.find((tab) => tab.key === activeTab) ?? tabs[0] ?? { label: "", addLabel: null };

    // Must keep a stable identity: an inline arrow would retrigger each List's effect and loop forever
    // ("Maximum update depth exceeded").
    const handleWorkshopLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, workshops: value })),
        []
    );
    const handleDepartmentLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, departments: value })),
        []
    );
    const handleGroupLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, groups: value })),
        []
    );
    const handleReasonLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, reasons: value })),
        []
    );
    const handleOtCaseLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, "ot-cases": value })),
        []
    );
    const handleJobTitleLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, "job-titles": value })),
        []
    );
    const handleApprovalStepLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, "approval-steps": value })),
        []
    );
    const handleEmployeeLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, employees: value })),
        []
    );
    const handleReportsLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, reports: value })),
        []
    );
    const handleSettingLoadingChange = useCallback(
        (value: boolean) => setLoadingByTab((current) => ({ ...current, settings: value })),
        []
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-[#191c1e]">{t("title")}</h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => activeRef.current?.refresh()}
                        disabled={loading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> {tCommon("refresh")}
                    </button>
                    {activeTabMeta.addLabel && (
                        <button
                            onClick={() => activeRef.current?.openCreate()}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            {activeTabMeta.addLabel}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-[#e0e3e5]">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => {
                                setActiveTab(tab.key);
                                setVisitedTabs((current) => (current.has(tab.key) ? current : new Set(current).add(tab.key)));
                            }}
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

            {/* Lazy mount, then keep mounted (hidden) so switching back is instant without refetching. */}
            {isMounted("workshops") && (
                <div className={activeTab === "workshops" ? "" : "hidden"}>
                    <WorkshopList ref={workshopRef} onLoadingChange={handleWorkshopLoadingChange} />
                </div>
            )}
            {isMounted("departments") && (
                <div className={activeTab === "departments" ? "" : "hidden"}>
                    <DepartmentList ref={departmentRef} onLoadingChange={handleDepartmentLoadingChange} />
                </div>
            )}
            {isMounted("groups") && (
                <div className={activeTab === "groups" ? "" : "hidden"}>
                    <GroupList ref={groupRef} onLoadingChange={handleGroupLoadingChange} />
                </div>
            )}
            {isMounted("reasons") && (
                <div className={activeTab === "reasons" ? "" : "hidden"}>
                    <ReasonList ref={reasonRef} onLoadingChange={handleReasonLoadingChange} />
                </div>
            )}
            {isMounted("ot-cases") && (
                <div className={activeTab === "ot-cases" ? "" : "hidden"}>
                    <OtCaseList ref={otCaseRef} onLoadingChange={handleOtCaseLoadingChange} />
                </div>
            )}
            {isMounted("job-titles") && (
                <div className={activeTab === "job-titles" ? "" : "hidden"}>
                    <JobTitleList ref={jobTitleRef} onLoadingChange={handleJobTitleLoadingChange} />
                </div>
            )}
            {isMounted("approval-steps") && (
                <div className={activeTab === "approval-steps" ? "" : "hidden"}>
                    <ApprovalStepManager ref={approvalStepRef} onLoadingChange={handleApprovalStepLoadingChange} />
                </div>
            )}
            {isMounted("employees") && (
                <div className={activeTab === "employees" ? "" : "hidden"}>
                    <EmployeeList ref={employeeRef} onLoadingChange={handleEmployeeLoadingChange} />
                </div>
            )}
            {isMounted("reports") && (
                <div className={activeTab === "reports" ? "" : "hidden"}>
                    <ProductionOtReportPanel ref={reportsRef} onLoadingChange={handleReportsLoadingChange} />
                </div>
            )}
            {isMounted("settings") && (
                <div className={activeTab === "settings" ? "" : "hidden"}>
                    <AttendanceSettingPanel ref={settingRef} onLoadingChange={handleSettingLoadingChange} />
                </div>
            )}
        </div>
    );
}
