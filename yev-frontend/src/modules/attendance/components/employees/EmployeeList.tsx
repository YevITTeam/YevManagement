"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import {
    AlertTriangle,
    CalendarClock,
    Clock,
    Factory,
    FileSpreadsheet,
    History,
    Inbox,
    Link2,
    Pencil,
    PenLine,
    Search,
    SlidersHorizontal,
    Trash2,
    Upload,
} from "lucide-react";

import { EmployeeApi, type EmployeeScopeDto } from "@/modules/attendance/api/employee.api";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import { GroupApi } from "@/modules/attendance/api/group.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import ActionMenu from "@/components/ui/ActionMenu";
import RowActionsMenu, { type RowAction } from "@/components/ui/RowActionsMenu";
import { Badge } from "@/components/ui/Badge";
import EmployeeForm, { type EmployeeFormValues } from "./EmployeeForm";
import type { EmployeeExportFilter } from "@/modules/attendance/types/employee-import.dto";
import EmployeeImportDialog from "./EmployeeImportDialog";
import EmployeeOtHourLimitImportDialog from "./EmployeeOtHourLimitImportDialog";
import EmployeeMonthlyAccumulationImportDialog from "./EmployeeMonthlyAccumulationImportDialog";
import EmployeeIdentityLinkImportDialog from "./EmployeeIdentityLinkImportDialog";
import EmployeeOtLimitDialog from "./EmployeeOtLimitDialog";
import EmployeeSignatureDialog from "./EmployeeSignatureDialog";
import ProductionEmployeeEditDialog from "./ProductionEmployeeEditDialog";
import AccumulationHistoryModal from "./AccumulationHistoryModal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useDragScroll } from "@/modules/common/hooks/useDragScroll";
import { Pagination } from "@/components/ui/Pagination";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import { ProductionEmployeeApi } from "@/modules/attendance/api/production-employee.api";
import type { ProductionOptionDto } from "@/modules/attendance/types/production-employee.dto";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";

const PAGE_SIZE = 15;
const filterTrigger = (width: string) =>
    `h-9 ${width} rounded-lg border border-[#e0e3e5] bg-white px-3 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]`;

const toProductionOptions = (options: ProductionOptionDto[]): SelectOption[] =>
    options.map((o) => ({ value: o.id, label: o.nameVn ? `${o.code} - ${o.nameVn}` : o.code, searchText: o.code.toLowerCase() }));

const EmployeeList = forwardRef<ListHandle, ListToolbarProps>(function EmployeeList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.Employee");
    const tCommon = useTranslations("Common");
    const tProduction = useTranslations("Attendance.ProductionEmployeeList");
    const { user } = useAuth();
    const canUpdateEmployee = hasPermission(user, "Attendance.Employee.Update");
    const canDeleteEmployee = hasPermission(user, "Attendance.Employee.Delete");
    const canUpdateOtLimit = hasPermission(user, "Attendance.Employee.UpdateOtLimit");
    const canUpdateAccumulation = hasPermission(user, "Attendance.EmployeeAccumulation.Update");
    const canCreateEmployee = hasPermission(user, "Attendance.Employee.Create");
    const canUpdateProduction = hasPermission(user, "Attendance.ProductionEmployee.Update");
    // Admin-only permission, never auto-granted via JobTitle/Coordinator.
    const canImportIdentityLink = hasPermission(user, "Identity.User.BulkImport");
    const isAdmin = Boolean(user?.roles.includes("Admin"));
    const [signatureEmployee, setSignatureEmployee] = useState<EmployeeDto | null>(null);
    const [employees, setEmployees] = useState<EmployeeDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);
    const [workshopId, setWorkshopId] = useState<number | "">("");
    const [groupId, setGroupId] = useState<number | "">("");

    const [teamOptions, setTeamOptions] = useState<ProductionOptionDto[]>([]);
    const [lineOptions, setLineOptions] = useState<ProductionOptionDto[]>([]);
    const [shiftTeamOptions, setShiftTeamOptions] = useState<ProductionOptionDto[]>([]);
    const [congDoanOptions, setCongDoanOptions] = useState<string[]>([]);
    const [teamId, setTeamId] = useState<number | "">("");
    const [productionLineId, setProductionLineId] = useState<number | "">("");
    const [shiftTeamId, setShiftTeamId] = useState<number | "">("");
    const [congDoan, setCongDoan] = useState<number | "">("");
    const [productionEditEmployee, setProductionEditEmployee] = useState<EmployeeDto | null>(null);

    // UX only: narrows the filter dropdowns to what the caller can see (BE already scopes the data),
    // avoiding unexplained empty tables.
    const [scope, setScope] = useState<EmployeeScopeDto | null>(null);
    const isScopeRestricted = scope !== null && !scope.companyWide;
    const showDepartmentFilter = scope === null || scope.companyWide || scope.departments.length > 0;

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingEmployee, setEditingEmployee] = useState<EmployeeDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingEmployee, setDeletingEmployee] = useState<EmployeeDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [historyEmployee, setHistoryEmployee] = useState<EmployeeDto | null>(null);

    // Narrow Attendance.Employee.UpdateOtLimit permission for coordinators without Employee.Update.
    const [otLimitEmployee, setOtLimitEmployee] = useState<EmployeeDto | null>(null);

    const [importOpen, setImportOpen] = useState(false);
    const [identityLinkImportOpen, setIdentityLinkImportOpen] = useState(false);
    const [otHourLimitImportOpen, setOtHourLimitImportOpen] = useState(false);
    const [monthlyAccumulationImportOpen, setMonthlyAccumulationImportOpen] = useState(false);
    const { setting } = useAttendanceSetting();
    const [tableScrollRef, onTableScrollMouseDown] = useDragScroll<HTMLDivElement>();

    useEffect(() => {
        ProductionEmployeeApi.getTeamOptions().then(setTeamOptions).catch((err) => console.error(err));
        ProductionEmployeeApi.getLineOptions().then(setLineOptions).catch((err) => console.error(err));
        ProductionEmployeeApi.getShiftTeamOptions().then(setShiftTeamOptions).catch((err) => console.error(err));
        ProductionEmployeeApi.getCongDoanOptions().then(setCongDoanOptions).catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        EmployeeApi.getMyScope()
            .then(setScope)
            .catch((err) => console.error(err));
    }, []);

    // Wait for the scope before loading dropdowns to avoid flashing the full company list; when restricted,
    // use BE's `scope` lists since the scope may span several departments/groups.
    useEffect(() => {
        if (scope === null) return;
        if (scope.companyWide) {
            DepartmentApi.getAllDepartments().then(setDepartments).catch((err) => console.error(err));
            GroupApi.getAllGroups().then(setGroups).catch((err) => console.error(err));
            WorkshopApi.getAllWorkshops().then(setWorkshops).catch((err) => console.error(err));
        } else {
            setDepartments(scope.departments);
            setGroups(scope.groups);
            setWorkshops(scope.workshops);
        }
    }, [scope]);

    const handleSelectDepartment = (nextId: number | "") => {
        setDepartmentId(nextId);
        setGroupId("");
        setPageIndex(1);
        if (isScopeRestricted) {
            // `scope.groups` already covers every department in scope, so filter locally instead of calling the API.
            setGroups(typeof nextId === "number" ? scope!.groups.filter((g) => g.departmentId === nextId) : scope!.groups);
            return;
        }
        if (typeof nextId === "number") {
            GroupApi.getGroupsByDepartment(nextId)
                .then(setGroups)
                .catch((err) => console.error(err));
        } else {
            GroupApi.getAllGroups()
                .then(setGroups)
                .catch((err) => console.error(err));
        }
    };

    const handleSelectWorkshop = (nextId: number | "") => {
        setWorkshopId(nextId);
        setGroupId("");
        setPageIndex(1);
    };

    const handleSelectGroup = (nextId: number | "") => {
        setGroupId(nextId);
        setPageIndex(1);
    };

    const handleSelectTeam = (nextId: number | "") => {
        setTeamId(nextId);
        setProductionLineId("");
        setPageIndex(1);
        ProductionEmployeeApi.getLineOptions(nextId === "" ? undefined : nextId)
            .then(setLineOptions)
            .catch((err) => console.error(err));
    };

    const handleSelectLine = (nextId: number | "") => {
        setProductionLineId(nextId);
        setPageIndex(1);
    };

    const handleSelectShiftTeam = (nextId: number | "") => {
        setShiftTeamId(nextId);
        setPageIndex(1);
    };

    const handleSelectCongDoan = (nextValue: number | "") => {
        setCongDoan(nextValue);
        setPageIndex(1);
    };

    const selectedCongDoan = congDoan === "" ? undefined : congDoanOptions[congDoan];
    const congDoanSelectOptions: SelectOption[] = congDoanOptions.map((value, index) => ({
        value: index,
        label: value,
        searchText: value.toLowerCase(),
    }));

    const departmentOptions: SelectOption[] = departments.map((d) => ({
        value: d.id,
        label: d.departmentNameVn,
        searchText: d.departmentNameVn.toLowerCase(),
    }));
    const workshopOptions: SelectOption[] = workshops.map((w) => ({
        value: w.id,
        label: w.workshopNameVn,
        searchText: w.workshopNameVn.toLowerCase(),
    }));
    const groupOptions: SelectOption[] = groups
        .filter((g) => workshopId === "" || g.workshopId === workshopId)
        .map((g) => ({
        value: g.id,
        label: g.groupNameVn,
        searchText: g.groupNameVn.toLowerCase(),
    }));

    const { isLoading, error, refetch: fetchEmployees } = useFetchEffect(
        () =>
            EmployeeApi.getEmployeePageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
                departmentId: departmentId || undefined,
                groupId: groupId || undefined,
                workshopId: workshopId || undefined,
                productionLineId: productionLineId || undefined,
                teamId: teamId || undefined,
                shiftTeamId: shiftTeamId || undefined,
                congDoan: selectedCongDoan,
            }),
        [pageIndex, appliedKeyword, departmentId, groupId, workshopId, productionLineId, teamId, shiftTeamId, selectedCongDoan],
        (result) => {
            setEmployees(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("loadError"),
        (message) => toast.error(message),
        "employees"
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingEmployee(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: () => {
            fetchEmployees();
        },
        openCreate: openCreateForm,
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openEditForm = (employee: EmployeeDto) => {
        setFormMode("edit");
        setEditingEmployee(employee);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingEmployee(null);
    };

    const handleSubmitForm = async (values: EmployeeFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await EmployeeApi.createEmployee(values);
                toast.success(t("createSuccess"));
            } else if (editingEmployee) {
                await EmployeeApi.updateEmployee(editingEmployee.id, values);
                // OT limits are saved through their own endpoint (narrower permission) — only call it when changed.
                if (
                    canUpdateOtLimit &&
                    (values.customMonthlyOtHourLimit !== editingEmployee.customMonthlyOtHourLimit ||
                        values.customYearlyOtHourLimit !== editingEmployee.customYearlyOtHourLimit)
                ) {
                    try {
                        await EmployeeApi.updateOtLimit(editingEmployee.id, {
                            customMonthlyOtHourLimit: values.customMonthlyOtHourLimit,
                            customYearlyOtHourLimit: values.customYearlyOtHourLimit,
                        });
                    } catch (limitErr) {
                        console.error(limitErr);
                        toast.error(getApiErrorMessage(limitErr, t("otLimitSaveError")));
                    }
                }
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingEmployee(null);
            await fetchEmployees();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? t("createError") : t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingEmployee) return;
        setIsDeleting(true);
        try {
            await EmployeeApi.deleteEmployee(deletingEmployee.id);
            toast.success(t("deleteSuccess"));
            setDeletingEmployee(null);
            await fetchEmployees();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteError")));
        } finally {
            setIsDeleting(false);
        }
    };

    // Coordinators may hold only some of these permissions; hide actions that would 403.
    // Applies to every department; this permission is auto-granted to department coordinators.
    const canImportMonthlyAccumulation = hasPermission(user, "Attendance.EmployeeAccumulation.Import");
    const exportFilter: EmployeeExportFilter = {
        keyword: appliedKeyword || undefined,
        departmentId: departmentId || undefined,
        groupId: groupId || undefined,
        workshopId: workshopId || undefined,
        productionLineId: productionLineId || undefined,
        teamId: teamId || undefined,
        shiftTeamId: shiftTeamId || undefined,
        congDoan: selectedCongDoan,
    };
    const employeeExcelItems = [
        ...(canCreateEmployee
            ? [{ label: t("importExcel"), onClick: () => setImportOpen(true), icon: <Upload className="h-3.5 w-3.5" /> }]
            : []),
        ...(canImportIdentityLink
            ? [{ label: t("identityLinkMenuLabel"), onClick: () => setIdentityLinkImportOpen(true), icon: <Link2 className="h-3.5 w-3.5" /> }]
            : []),
        ...(canUpdateOtLimit
            ? [{ label: t("otHourLimitImportMenuLabel"), onClick: () => setOtHourLimitImportOpen(true), icon: <Clock className="h-3.5 w-3.5" /> }]
            : []),
        ...(canImportMonthlyAccumulation
            ? [
                  {
                      label: t("monthlyAccumulationImportMenuLabel"),
                      onClick: () => setMonthlyAccumulationImportOpen(true),
                      icon: <CalendarClock className="h-3.5 w-3.5" />,
                  },
              ]
            : []),
    ];
    const employeeExcelActions =
        employeeExcelItems.length > 0 ? (
            <ActionMenu label={t("excelActionsLabel")} icon={<FileSpreadsheet className="h-3.5 w-3.5" />} items={employeeExcelItems} />
        ) : null;

    const getRowActions = (employee: EmployeeDto): RowAction[] => [
        ...(canUpdateEmployee ? [{ label: tCommon("edit"), icon: Pencil, onClick: () => openEditForm(employee) }] : []),
        ...(canUpdateProduction
            ? [{ label: tProduction("editAction"), icon: Factory, onClick: () => setProductionEditEmployee(employee) }]
            : []),
        ...(canUpdateOtLimit && !canUpdateEmployee
            ? [{ label: t("otLimitEditAction"), icon: SlidersHorizontal, onClick: () => setOtLimitEmployee(employee) }]
            : []),
        { label: t("viewAccumulationHistory"), icon: History, onClick: () => setHistoryEmployee(employee) },
        ...(isAdmin && employee.userName
            ? [{ label: t("signatureEditAction"), icon: PenLine, onClick: () => setSignatureEmployee(employee) }]
            : []),
        ...(canDeleteEmployee
            ? [{ label: tCommon("delete"), icon: Trash2, onClick: () => setDeletingEmployee(employee), variant: "danger" as const }]
            : []),
    ];

    return (
        <div className="space-y-3">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] px-3 py-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={t("searchPlaceholder")}
                            className="h-9 w-48 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            title={tCommon("search")}
                            aria-label={tCommon("search")}
                            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            <Search className="h-4 w-4" />
                        </button>
                        <SearchableSelect
                            options={workshopOptions}
                            value={workshopId}
                            onChange={handleSelectWorkshop}
                            placeholder={t("filterWorkshopPlaceholder")}
                            triggerClassName={filterTrigger("w-24")}
                        />
                        {showDepartmentFilter && (
                            <SearchableSelect
                                options={departmentOptions}
                                value={departmentId}
                                onChange={handleSelectDepartment}
                                placeholder={t("filterDepartmentPlaceholder")}
                                triggerClassName={filterTrigger("w-36")}
                            />
                        )}
                        <SearchableSelect
                            options={groupOptions}
                            value={groupId}
                            onChange={handleSelectGroup}
                            placeholder={t("filterGroupPlaceholder")}
                            triggerClassName={filterTrigger("w-36")}
                        />
                        <SearchableSelect
                            options={toProductionOptions(teamOptions)}
                            value={teamId}
                            onChange={handleSelectTeam}
                            placeholder={tProduction("filterTeamPlaceholder")}
                            triggerClassName={filterTrigger("w-24")}
                        />
                        <SearchableSelect
                            options={toProductionOptions(lineOptions)}
                            value={productionLineId}
                            onChange={handleSelectLine}
                            placeholder={tProduction("filterBlockPlaceholder")}
                            triggerClassName={filterTrigger("w-24")}
                        />
                        <SearchableSelect
                            options={toProductionOptions(shiftTeamOptions)}
                            value={shiftTeamId}
                            onChange={handleSelectShiftTeam}
                            placeholder={tProduction("filterShiftTeamPlaceholder")}
                            triggerClassName={filterTrigger("w-28")}
                        />
                        <SearchableSelect
                            options={congDoanSelectOptions}
                            value={congDoan}
                            onChange={handleSelectCongDoan}
                            placeholder={tProduction("filterCongDoanPlaceholder")}
                            triggerClassName={filterTrigger("w-32")}
                        />
                        {employeeExcelActions}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div ref={tableScrollRef} onMouseDown={onTableScrollMouseDown} className="cursor-grab overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="whitespace-nowrap border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                <th className="py-1.5 pl-3 pr-2">{t("colCode")}</th>
                                <th className="px-2 py-1.5">{t("colFullName")}</th>
                                <th className="px-2 py-1.5">{t("colUserName")}</th>
                                <th className="px-2 py-1.5">{t("colWorkshop")}</th>
                                <th className="px-2 py-1.5">{t("colGroup")}</th>
                                <th className="px-2 py-1.5">{t("colJobTitle")}</th>
                                <th className="px-2 py-1.5">{tProduction("colBlock")}</th>
                                <th className="px-2 py-1.5">{tProduction("colTeam")}</th>
                                <th className="px-2 py-1.5">{tProduction("colShiftTeam")}</th>
                                <th className="px-2 py-1.5">{tProduction("colCongDoan")}</th>
                                <th className="px-2 py-1.5">{tProduction("colTaskName")}</th>
                                <th className="px-2 py-1.5">{t("colMonthToDate")}</th>
                                <th className="px-2 py-1.5">{t("colYearToDate")}</th>
                                <th className="sticky right-0 z-10 w-10 bg-[#f8fafc] px-2 py-1.5 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                                    <span className="sr-only">{tCommon("actions")}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && employees.length === 0 && (
                                <tr>
                                    <td colSpan={14} className="px-4 py-12">
                                        <div className="flex flex-col items-center gap-2 text-center text-sm text-[#5e3f3a]">
                                            <Inbox className="h-8 w-8 text-[#c7ccd1]" />
                                            {t("noData")}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {employees.map((employee) => {
                                const isMonthOverLimit = employee.monthToDate > setting.monthlyOtHourLimit;
                                const isYearOverLimit = employee.yearToDate > setting.yearlyOtHourLimit;
                                const accumulationBadgeClass = (overLimit: boolean) =>
                                    `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                        overLimit
                                            ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                            : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                    }`;
                                return (
                                <tr key={employee.id} className="whitespace-nowrap border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="py-1.5 pl-3 pr-2 text-sm font-semibold text-[#191c1e]">{employee.code}</td>
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">
                                        {employee.lastName} {employee.firstName}
                                    </td>
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">{employee.userName ?? "-"}</td>
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">
                                        {employee.workshopNameVn ??
                                            (employee.approvalScopes.length > 0
                                                ? [...new Set(employee.approvalScopes.map((s) => s.workshopNameVn))].join(", ")
                                                : "-")}
                                    </td>
                                    <td className="px-2 py-1 text-sm leading-4 text-[#191c1e]">
                                        {(!employee.groupNameVn && employee.approvalScopes.length > 0
                                            ? employee.approvalScopes.map((s) => `${s.departmentNameVn} (${s.workshopNameVn})`).join(", ")
                                            : employee.departmentNameVn) ?? (
                                            <span className="text-xs italic text-[#8a8f94]">{t("orgUnitCompanyWide")}</span>
                                        )}
                                        {employee.groupNameVn && <div className="text-xs text-[#5e3f3a]">{employee.groupNameVn}</div>}
                                    </td>
                                    <td className="px-2 py-1.5 text-sm">
                                        {employee.jobTitleName ? (
                                            <Badge variant="info">{employee.jobTitleName}</Badge>
                                        ) : (
                                            <span className="text-xs italic text-[#8a8f94]">{t("noJobTitle")}</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">
                                        {employee.lineCode ?? "-"}
                                    </td>
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">{employee.teamCode ?? "-"}</td>
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">{employee.shiftTeamCode ?? "-"}</td>
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">{employee.congDoan ?? "-"}</td>
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">{employee.taskName ?? "-"}</td>
                                    <td className="px-2 py-1.5 text-sm">
                                        <span className={accumulationBadgeClass(isMonthOverLimit)}>
                                            {isMonthOverLimit && <AlertTriangle className="h-3 w-3" />}
                                            {employee.monthToDate}h
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-sm">
                                        <span className={accumulationBadgeClass(isYearOverLimit)}>
                                            {isYearOverLimit && <AlertTriangle className="h-3 w-3" />}
                                            {employee.yearToDate}h
                                        </span>
                                    </td>
                                    <td className="sticky right-0 w-10 bg-inherit px-2 py-1.5 text-right text-sm shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                                        <RowActionsMenu actions={getRowActions(employee)} />
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    pageIndex={pageIndex}
                    totalPages={totalPages}
                    onPageChange={setPageIndex}
                    disabled={isLoading}
                    summary={isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: employees.length, total: totalCount })}
                    compactSummary={totalCount}
                />
            </section>

            <EmployeeImportDialog
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                onImported={fetchEmployees}
                exportFilter={exportFilter}
            />

            <EmployeeIdentityLinkImportDialog
                isOpen={identityLinkImportOpen}
                onClose={() => setIdentityLinkImportOpen(false)}
                onImported={fetchEmployees}
                exportFilter={exportFilter}
            />

            <ProductionEmployeeEditDialog
                item={productionEditEmployee}
                onClose={() => setProductionEditEmployee(null)}
                onSaved={() => {
                    setProductionEditEmployee(null);
                    fetchEmployees();
                }}
            />

            <EmployeeOtHourLimitImportDialog
                isOpen={otHourLimitImportOpen}
                onClose={() => setOtHourLimitImportOpen(false)}
                onImported={fetchEmployees}
                exportFilter={exportFilter}
            />

            <EmployeeMonthlyAccumulationImportDialog
                isOpen={monthlyAccumulationImportOpen}
                onClose={() => setMonthlyAccumulationImportOpen(false)}
                onImported={fetchEmployees}
                exportFilter={exportFilter}
            />

            <EmployeeForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingEmployee}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
                scope={scope}
                canEditOtLimit={canUpdateOtLimit}
            />

            <ConfirmDialog
                isOpen={deletingEmployee !== null}
                title={t("deleteTitle")}
                message={t.rich("deleteMessage", {
                    name: deletingEmployee ? `${deletingEmployee.lastName} ${deletingEmployee.firstName}` : "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingEmployee(null);
                }}
            />

            {historyEmployee && (
                <AccumulationHistoryModal
                    employeeId={historyEmployee.id}
                    employeeLabel={`${historyEmployee.lastName} ${historyEmployee.firstName} (${historyEmployee.code})`}
                    canEdit={canUpdateAccumulation}
                    onClose={() => setHistoryEmployee(null)}
                />
            )}

            {signatureEmployee && (
                <EmployeeSignatureDialog employee={signatureEmployee} onClose={() => setSignatureEmployee(null)} />
            )}

            <EmployeeOtLimitDialog
                employee={otLimitEmployee}
                onClose={() => setOtLimitEmployee(null)}
                onSaved={() => {
                    setOtLimitEmployee(null);
                    fetchEmployees();
                }}
            />
        </div>
    );
});

export default EmployeeList;
