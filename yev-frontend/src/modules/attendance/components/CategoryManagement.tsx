"use client";
import { useCallback, useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission, hasPermission } from "@/modules/auth/lib/permissions";
import WorkshopList from "./workshops/WorkshopList";
import DepartmentList from "./departments/DepartmentList";
import GroupList from "./groups/GroupList";
import ProductionCatalogList from "./production-catalogs/ProductionCatalogList";
import ReasonList from "./reasons/ReasonList";
import OtCaseList from "./ot-cases/OtCaseList";
import JobTitleList from "./job-titles/JobTitleList";
import ApprovalStepManager from "./job-titles/ApprovalStepManager";
import EmployeeList from "./employees/EmployeeList";
import ProductionOtReportPanel from "./reports/ProductionOtReportPanel";
import AttendanceSettingPanel from "./settings/AttendanceSettingPanel";
import type { ListHandle } from "./list-toolbar";
import type { ProductionCatalogKind } from "@/modules/attendance/types/production-catalog.dto";
import { Tabs } from "@/components/ui/Tabs";
import { IconButton } from "@/components/ui/ListToolbar";
import { usePersistedTab } from "@/modules/common/hooks/usePersistedTab";

type CategoryTab =
    | "workshops"
    | "departments"
    | "groups"
    | "production-lines"
    | "production-teams"
    | "production-shift-teams"
    | "production-tasks"
    | "reasons"
    | "ot-cases"
    | "job-titles"
    | "approval-steps"
    | "employees"
    | "reports"
    | "settings";

type CategoryTabGroup = "organization";

const PRODUCTION_KIND_BY_TAB: Partial<Record<CategoryTab, ProductionCatalogKind>> = {
    "production-lines": "Line",
    "production-teams": "Team",
    "production-shift-teams": "ShiftTeam",
    "production-tasks": "Task",
};

export default function CategoryManagement() {
    const t = useTranslations("Attendance.CategoryManagement");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    // Each tab is gated by its own .Create/.Update permission; .View is granted broadly just to load dropdowns.
    const canViewReports = hasPermission(user, "Attendance.ProductionOtReport.View");
    const canCreateEmployee = hasPermission(user, "Attendance.Employee.Create");
    // "settings" is not a CRUD list, so it has no add button.
    const canManageProductionCatalog = hasPermission(user, "Attendance.ProductionCatalog.Manage");
    const allTabs: { key: CategoryTab; label: string; canAdd: boolean; visible: boolean; group?: CategoryTabGroup }[] = [
        { key: "workshops", label: t("tabWorkshops"), canAdd: true, visible: hasPermission(user, "Attendance.Workshop.Create"), group: "organization" },
        { key: "departments", label: t("tabDepartments"), canAdd: true, visible: hasPermission(user, "Attendance.Department.Create"), group: "organization" },
        { key: "groups", label: t("tabGroups"), canAdd: true, visible: hasPermission(user, "Attendance.Group.Create"), group: "organization" },
        { key: "production-lines", label: t("tabProductionLines"), canAdd: true, visible: canManageProductionCatalog, group: "organization" },
        { key: "production-teams", label: t("tabProductionTeams"), canAdd: true, visible: canManageProductionCatalog, group: "organization" },
        { key: "production-shift-teams", label: t("tabProductionShiftTeams"), canAdd: true, visible: canManageProductionCatalog, group: "organization" },
        { key: "production-tasks", label: t("tabProductionTasks"), canAdd: true, visible: canManageProductionCatalog, group: "organization" },
        { key: "reasons", label: t("tabReasons"), canAdd: true, visible: hasPermission(user, "Attendance.Reason.Create") },
        { key: "ot-cases", label: t("tabOtCases"), canAdd: true, visible: hasPermission(user, "Attendance.OtCase.Create") },
        { key: "job-titles", label: t("tabJobTitles"), canAdd: true, visible: hasPermission(user, "Attendance.JobTitle.Create") },
        {
            key: "approval-steps",
            label: t("tabApprovalSteps"),
            canAdd: false,
            visible: hasAnyPermission(user, [
                "Attendance.DepartmentApprovalStep.Update",
                "Attendance.GroupApprovalStep.Update",
            ]),
        },
        {
            key: "employees",
            label: t("tabEmployees"),
            canAdd: canCreateEmployee,
            visible: hasAnyPermission(user, [
                "Attendance.Employee.Create",
                "Attendance.Employee.Update",
                "Attendance.Employee.Delete",
                "Attendance.Employee.UpdateOtLimit",
                "Attendance.EmployeeAccumulation.Update",
                "Attendance.ProductionEmployee.View",
            ]),
        },
        { key: "reports", label: t("tabReports"), canAdd: false, visible: canViewReports },
        { key: "settings", label: t("tabSettings"), canAdd: false, visible: hasPermission(user, "Attendance.Setting.Update") },
    ];
    const tabs = allTabs.filter((tab) => tab.visible);
    const groupLabels: Record<CategoryTabGroup, string> = { organization: t("tabOrganization") };
    // A group takes one slot in the top row, at its first visible member.
    const topTabs = tabs.filter((tab, index) => !tab.group || tabs.findIndex((x) => x.group === tab.group) === index);
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
        "production-lines": false,
        "production-teams": false,
        "production-shift-teams": false,
        "production-tasks": false,
        reasons: false,
        "ot-cases": false,
        "job-titles": false,
        "approval-steps": false,
        employees: false,
        reports: false,
        settings: false,
    });
    const loading = loadingByTab[activeTab];
    const activeGroup = tabs.find((tab) => tab.key === activeTab)?.group;
    const groupTabs = activeGroup ? tabs.filter((tab) => tab.group === activeGroup) : [];
    const productionKind = PRODUCTION_KIND_BY_TAB[activeTab];
    const selectTab = (key: CategoryTab) => {
        setActiveTab(key);
        setVisitedTabs((current) => (current.has(key) ? current : new Set(current).add(key)));
    };

    const workshopRef = useRef<ListHandle>(null);
    const departmentRef = useRef<ListHandle>(null);
    const groupRef = useRef<ListHandle>(null);
    const productionCatalogRef = useRef<ListHandle>(null);
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
        "production-lines": productionCatalogRef,
        "production-teams": productionCatalogRef,
        "production-shift-teams": productionCatalogRef,
        "production-tasks": productionCatalogRef,
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
    const activeTabMeta = tabs.find((tab) => tab.key === activeTab) ?? tabs[0] ?? { label: "", canAdd: false };

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
    const handleProductionCatalogLoadingChange = useCallback(
        (value: boolean) =>
            setLoadingByTab((current) => ({
                ...current,
                "production-lines": value,
                "production-teams": value,
                "production-shift-teams": value,
                "production-tasks": value,
            })),
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
        <div className="space-y-3">
            <h1 className="sr-only">{t("title")}</h1>
            <div className="flex flex-col-reverse gap-2 border-b border-[#e0e3e5] md:flex-row md:items-end md:gap-3">
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                    {topTabs.map((tab) => {
                        const isActive = tab.group ? activeGroup === tab.group : activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => selectTab(tab.key)}
                                className={`shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${
                                    isActive
                                        ? "border-[#e3000f] text-[#191c1e]"
                                        : "border-transparent text-[#5e3f3a] hover:text-[#191c1e]"
                                }`}
                            >
                                {tab.group ? groupLabels[tab.group] : tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex shrink-0 items-center justify-end gap-2 md:pb-1.5">
                    <IconButton icon={RefreshCw} label={tCommon("refresh")} onClick={() => activeRef.current?.refresh()} disabled={loading} size="sm" />
                    {activeTabMeta.canAdd && (
                        <button
                            onClick={() => activeRef.current?.openCreate()}
                            title={tCommon("add")}
                            aria-label={tCommon("add")}
                            className="inline-flex h-7 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#e3000f] px-2 text-xs font-semibold text-white transition hover:bg-[#b40009] sm:px-3"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{tCommon("add")}</span>
                        </button>
                    )}
                </div>
            </div>

            {groupTabs.length > 1 && <Tabs tabs={groupTabs} activeKey={activeTab} onChange={selectTab} />}

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
            {/* Not kept mounted: the Line form must see Teams added a moment ago in the Team sub-tab. */}
            {productionKind && (
                <ProductionCatalogList key={productionKind} ref={productionCatalogRef} kind={productionKind} onLoadingChange={handleProductionCatalogLoadingChange} />
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
