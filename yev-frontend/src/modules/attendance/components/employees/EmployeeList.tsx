"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import {
    AlertTriangle,
    CalendarClock,
    Clock,
    Factory,
    FileSpreadsheet,
    History,
    Link2,
    Pencil,
    PenLine,
    SlidersHorizontal,
    Trash2,
    Upload,
    UserCheck,
    UserX,
    type LucideIcon,
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
import { StyledSelect } from "@/components/ui/StyledSelect";
import { ErrorBar, FilterActions, IconFlag, ListToolbar, SearchField, TableStatusRows, fieldClassName } from "@/components/ui/ListToolbar";
import EmployeeForm, { type EmployeeFormValues } from "./EmployeeForm";
import type { EmployeeExportFilter } from "@/modules/attendance/types/employee-import.dto";
import EmployeeImportDialog from "./EmployeeImportDialog";
import EmployeeOtHourLimitImportDialog from "./EmployeeOtHourLimitImportDialog";
import EmployeeMonthlyAccumulationImportDialog from "./EmployeeMonthlyAccumulationImportDialog";
import EmployeeIdentityLinkImportDialog from "./EmployeeIdentityLinkImportDialog";
import EmployeeOtLimitDialog from "./EmployeeOtLimitDialog";
import EmployeeSignatureDialog from "./EmployeeSignatureDialog";
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
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { localeName } from "@/modules/attendance/lib/bilingual";
import { useFitViewport } from "@/components/ui/TableScroll";

const PAGE_SIZE = 15;
const filterTrigger = (width: string) => `${fieldClassName} ${width} pr-8`;

const toProductionOptions = (options: ProductionOptionDto[]): SelectOption[] =>
    options.map((o) => ({ value: o.id, label: o.nameVn ? `${o.code} - ${o.nameVn}` : o.code, searchText: o.code.toLowerCase() }));

const EmployeeList = forwardRef<ListHandle, ListToolbarProps>(function EmployeeList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.Employee");
    const locale = useLocale();
    const tCommon = useTranslations("Common");
    const tProduction = useTranslations("Attendance.ProductionEmployeeList");
    const { user } = useAuth();
    const canUpdateEmployee = hasPermission(user, "Attendance.Employee.Update");
    const canDeleteEmployee = hasPermission(user, "Attendance.Employee.Delete");
    const canUpdateOtLimit = hasPermission(user, "Attendance.Employee.UpdateOtLimit");
    const canUpdateAccumulation = hasPermission(user, "Attendance.EmployeeAccumulation.Update");
    const canCreateEmployee = hasPermission(user, "Attendance.Employee.Create");
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
    // 1 = resigned only, 0 = working only.
    const [resignedFilter, setResignedFilter] = useState<number | "">("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [bulkAction, setBulkAction] = useState<"delete" | "restore" | null>(null);
    const [isBulkRunning, setIsBulkRunning] = useState(false);

    // UX only: narrows the filter dropdowns to what the caller can see (BE already scopes the data),
    // avoiding unexplained empty tables.
    const [scope, setScope] = useState<EmployeeScopeDto | null>(null);
    const isScopeRestricted = scope !== null && !scope.companyWide;
    const showDepartmentFilter = scope === null || scope.companyWide || scope.departments.length > 0;

    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = usePersistedState("page-size:attendance/components/employees/EmployeeList", PAGE_SIZE);
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
    const tableMaxHeight = useFitViewport(tableScrollRef);

    useEffect(() => {
        ProductionEmployeeApi.getTeamOptions().then(setTeamOptions).catch((err) => console.error(err));
        ProductionEmployeeApi.getLineOptions().then(setLineOptions).catch((err) => console.error(err));
        ProductionEmployeeApi.getShiftTeamOptions().then(setShiftTeamOptions).catch((err) => console.error(err));
        ProductionEmployeeApi.getCongDoanOptions().then(setCongDoanOptions).catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        // Wait for the scope before filling dropdowns so a restricted user never sees the full company list.
        EmployeeApi.getMyScope()
            .then((nextScope) => {
                setScope(nextScope);
                if (nextScope.companyWide) {
                    DepartmentApi.getAllDepartments().then(setDepartments).catch((err) => console.error(err));
                    GroupApi.getAllGroups().then(setGroups).catch((err) => console.error(err));
                    WorkshopApi.getAllWorkshops().then(setWorkshops).catch((err) => console.error(err));
                } else {
                    setDepartments(nextScope.departments);
                    setGroups(nextScope.groups);
                    setWorkshops(nextScope.workshops);
                }
            })
            .catch((err) => console.error(err));
    }, []);

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

    const handleSelectResigned = (nextValue: number | "") => {
        setResignedFilter(nextValue);
        setSelectedIds([]);
        setPageIndex(1);
    };
    const resignedSelectOptions: { value: number | ""; label: string }[] = [
        { value: "", label: t("filterStatusAll") },
        { value: 0, label: t("statusWorking") },
        { value: 1, label: t("statusResigned") },
    ];
    const resigned = resignedFilter === "" ? undefined : resignedFilter === 1;

    const handleReset = () => {
        setKeyword("");
        setAppliedKeyword("");
        setWorkshopId("");
        handleSelectDepartment("");
        handleSelectTeam("");
        setShiftTeamId("");
        setCongDoan("");
        handleSelectResigned("");
    };

    const selectedCongDoan = congDoan === "" ? undefined : congDoanOptions[congDoan];
    const congDoanSelectOptions: SelectOption[] = congDoanOptions.map((value, index) => ({
        value: index,
        label: value,
        searchText: value.toLowerCase(),
    }));

    const departmentOptions: SelectOption[] = departments.map((d) => ({
        value: d.id,
        label: localeName(locale, d.departmentNameVn, d.departmentNameJp)[0],
        searchText: `${d.departmentNameVn} ${d.departmentNameJp ?? ""}`.toLowerCase(),
    }));
    const workshopOptions: SelectOption[] = workshops.map((w) => ({
        value: w.id,
        label: localeName(locale, w.workshopNameVn, w.workshopNameJp)[0],
        searchText: `${w.workshopNameVn} ${w.workshopNameJp ?? ""}`.toLowerCase(),
    }));
    const groupOptions: SelectOption[] = groups
        .filter((g) => workshopId === "" || g.workshopId === workshopId)
        .map((g) => ({
        value: g.id,
        label: localeName(locale, g.groupNameVn, g.groupNameJp)[0],
        searchText: `${g.groupNameVn} ${g.groupNameJp ?? ""}`.toLowerCase(),
    }));

    const { isLoading, error, refetch: fetchEmployees } = useFetchEffect(
        () =>
            EmployeeApi.getEmployeePageNation({
                pageIndex,
                pageSize,
                keyword: appliedKeyword || undefined,
                departmentId: departmentId || undefined,
                groupId: groupId || undefined,
                workshopId: workshopId || undefined,
                productionLineId: productionLineId || undefined,
                teamId: teamId || undefined,
                shiftTeamId: shiftTeamId || undefined,
                congDoan: selectedCongDoan,
                resigned,
            }),
        [pageIndex, pageSize, appliedKeyword, departmentId, groupId, workshopId, productionLineId, teamId, shiftTeamId, selectedCongDoan, resigned],
        (result) => {
            setEmployees(result.data);
            setSelectedIds([]);
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

    const handleBulkAction = async () => {
        if (!bulkAction) return;
        setIsBulkRunning(true);
        try {
            const count =
                bulkAction === "delete" ? await EmployeeApi.bulkDelete(selectedIds) : await EmployeeApi.restoreResigned(selectedIds);
            toast.success(t(bulkAction === "delete" ? "bulkDeleteSuccess" : "restoreResignedSuccess", { count }));
            setBulkAction(null);
            await fetchEmployees();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("bulkActionError")));
        } finally {
            setIsBulkRunning(false);
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
        resigned,
    };
    // Picking rows only matters for resigned people: delete them for good, or bring them back.
    const canSelect = resignedFilter === 1 && (canDeleteEmployee || canUpdateEmployee);
    const allSelected = employees.length > 0 && employees.every((e) => selectedIds.includes(e.id));
    const toggleSelected = (id: number) =>
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
            <ActionMenu label={t("excelActionsLabel")} icon={<FileSpreadsheet className="h-4 w-4" />} items={employeeExcelItems} iconOnly />
        ) : null;

    const productionFilterCount = [teamId, productionLineId, shiftTeamId, congDoan].filter((v) => v !== "").length;
    // Columns pinned to one value by the filters only repeat it on every row; a one-pair group pins Line × Ca (and Team, which follows the Line).
    const selectedGroup = groupId === "" ? undefined : groups.find((g) => g.id === groupId);
    const singlePairGroup = (selectedGroup?.lines?.length ?? 0) === 1;
    const showLine = productionLineId === "" && !singlePairGroup;
    const showTeam = teamId === "" && showLine;
    const showShift = shiftTeamId === "" && !singlePairGroup;
    const showCongDoan = congDoan === "";
    const columnCount = 10 + (canSelect ? 1 : 0) + [showLine, showTeam, showShift, showCongDoan].filter(Boolean).length;

    const getRowActions = (employee: EmployeeDto): RowAction[] => [
        ...(canUpdateEmployee ? [{ label: tCommon("edit"), icon: Pencil, onClick: () => openEditForm(employee) }] : []),
        ...(canUpdateOtLimit && !canUpdateEmployee
            ? [{ label: t("otLimitEditAction"), icon: SlidersHorizontal, onClick: () => setOtLimitEmployee(employee) }]
            : []),
        { label: t("viewAccumulationHistory"), icon: History, onClick: () => setHistoryEmployee(employee) },
        ...(isAdmin && employee.userName
            ? [{ label: t("signatureEditAction"), icon: PenLine, onClick: () => setSignatureEmployee(employee) }]
            : []),
        ...(canUpdateEmployee && employee.resignedAt
            ? [{ label: t("restoreResignedAction"), icon: UserCheck, onClick: () => { setSelectedIds([employee.id]); setBulkAction("restore"); } }]
            : []),
        ...(canDeleteEmployee
            ? [{ label: tCommon("delete"), icon: Trash2, onClick: () => setDeletingEmployee(employee), variant: "danger" as const }]
            : []),
    ];

    return (
        <div className="space-y-3">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <ListToolbar
                    actions={
                        <>
                            {canSelect && selectedIds.length > 0 && canUpdateEmployee && (
                                <button
                                    type="button"
                                    onClick={() => setBulkAction("restore")}
                                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                                >
                                    <UserCheck className="h-4 w-4" /> {t("restoreResignedBulk", { count: selectedIds.length })}
                                </button>
                            )}
                            {canSelect && selectedIds.length > 0 && canDeleteEmployee && (
                                <button
                                    type="button"
                                    onClick={() => setBulkAction("delete")}
                                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-[#930006] px-3 text-sm font-semibold text-white transition hover:bg-[#7a0005]"
                                >
                                    <Trash2 className="h-4 w-4" /> {t("bulkDeleteButton", { count: selectedIds.length })}
                                </button>
                            )}
                            {employeeExcelActions}
                        </>
                    }
                >
                    <SearchField value={keyword} onChange={setKeyword} onEnter={handleSearch} placeholder={t("searchPlaceholder")} />
                    <SearchableSelect
                        options={workshopOptions}
                        value={workshopId}
                        onChange={handleSelectWorkshop}
                        placeholder={t("filterWorkshopPlaceholder")}
                        ariaLabel={t("filterWorkshopPlaceholder")}
                        triggerClassName={filterTrigger("w-24")}
                    />
                    {showDepartmentFilter && (
                        <SearchableSelect
                            options={departmentOptions}
                            value={departmentId}
                            onChange={handleSelectDepartment}
                            placeholder={t("filterDepartmentPlaceholder")}
                            ariaLabel={t("filterDepartmentPlaceholder")}
                            triggerClassName={filterTrigger("w-36")}
                        />
                    )}
                    <SearchableSelect
                        options={groupOptions}
                        value={groupId}
                        onChange={handleSelectGroup}
                        placeholder={t("filterGroupPlaceholder")}
                        ariaLabel={t("filterGroupPlaceholder")}
                        triggerClassName={filterTrigger("w-36")}
                    />
                    <FilterPopover icon={Factory} label={t("productionFilters")} count={productionFilterCount}>
                        <SearchableSelect
                            options={toProductionOptions(teamOptions)}
                            value={teamId}
                            onChange={handleSelectTeam}
                            placeholder={tProduction("filterTeamPlaceholder")}
                            ariaLabel={tProduction("filterTeamPlaceholder")}
                            triggerClassName={filterTrigger("w-36")}
                        />
                        <SearchableSelect
                            options={toProductionOptions(lineOptions)}
                            value={productionLineId}
                            onChange={handleSelectLine}
                            placeholder={tProduction("filterBlockPlaceholder")}
                            ariaLabel={tProduction("filterBlockPlaceholder")}
                            triggerClassName={filterTrigger("w-36")}
                        />
                        <SearchableSelect
                            options={toProductionOptions(shiftTeamOptions)}
                            value={shiftTeamId}
                            onChange={handleSelectShiftTeam}
                            placeholder={tProduction("filterShiftTeamPlaceholder")}
                            ariaLabel={tProduction("filterShiftTeamPlaceholder")}
                            triggerClassName={filterTrigger("w-36")}
                        />
                        <SearchableSelect
                            options={congDoanSelectOptions}
                            value={congDoan}
                            onChange={handleSelectCongDoan}
                            placeholder={tProduction("filterCongDoanPlaceholder")}
                            ariaLabel={tProduction("filterCongDoanPlaceholder")}
                            triggerClassName={filterTrigger("w-36")}
                        />
                    </FilterPopover>
                    <div className="w-28">
                        <StyledSelect
                            options={resignedSelectOptions}
                            value={resignedFilter}
                            onChange={handleSelectResigned}
                            emptyLabel={t("filterStatusPlaceholder")}
                            ariaLabel={t("filterStatusPlaceholder")}
                            triggerClassName={filterTrigger("w-full")}
                        />
                    </div>
                    <FilterActions onSearch={handleSearch} onReset={handleReset} disabled={isLoading} />
                </ListToolbar>

                <ErrorBar message={error} />

                <div
                    ref={tableScrollRef}
                    onMouseDown={onTableScrollMouseDown}
                    style={{ maxHeight: tableMaxHeight }}
                    className="cursor-grab overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-20"
                >
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="whitespace-nowrap border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                {canSelect && (
                                    <th className="w-8 py-1.5 pl-3">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={() => setSelectedIds(allSelected ? [] : employees.map((e) => e.id))}
                                            aria-label={t("selectAllOnPage")}
                                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                        />
                                    </th>
                                )}
                                <th className="py-1.5 pl-3 pr-2">{t("colCode")}</th>
                                <th className="px-2 py-1.5">{t("colFullName")}</th>
                                <th className="px-2 py-1.5">{t("colUserName")}</th>
                                <th className="px-2 py-1.5">{t("colWorkshop")}</th>
                                <th className="px-2 py-1.5">{t("colGroup")}</th>
                                <th className="px-2 py-1.5">{t("colJobTitle")}</th>
                                {showLine && <th className="px-2 py-1.5">{tProduction("colBlock")}</th>}
                                {showTeam && <th className="px-2 py-1.5">{tProduction("colTeam")}</th>}
                                {showShift && <th className="px-2 py-1.5">{tProduction("colShiftTeam")}</th>}
                                {showCongDoan && <th className="px-2 py-1.5">{tProduction("colCongDoan")}</th>}
                                <th className="px-2 py-1.5">{tProduction("colTaskName")}</th>
                                <th className="px-2 py-1.5 text-right">{t("colMonthToDate")}</th>
                                <th className="px-2 py-1.5 text-right">{t("colYearToDate")}</th>
                                <th className="sticky right-0 z-10 w-10 bg-[#f8fafc] px-2 py-1.5 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                                    <span className="sr-only">{tCommon("actions")}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={employees.length === 0} columns={columnCount} emptyText={t("noData")} />
                            {employees.map((employee) => {
                                const monthLimit = employee.customMonthlyOtHourLimit ?? setting.monthlyOtHourLimit;
                                const yearLimit = employee.customYearlyOtHourLimit ?? setting.yearlyOtHourLimit;
                                return (
                                <tr key={employee.id} className="whitespace-nowrap border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    {canSelect && (
                                        <td className="w-8 py-1.5 pl-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(employee.id)}
                                                onChange={() => toggleSelected(employee.id)}
                                                aria-label={employee.code}
                                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                            />
                                        </td>
                                    )}
                                    <td className="py-1.5 pl-3 pr-2 text-sm font-semibold text-[#191c1e]">{employee.code}</td>
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">
                                        <span className="inline-flex items-center gap-1.5">
                                            {employee.lastName} {employee.firstName}
                                            {employee.resignedAt && <IconFlag icon={UserX} label={t("statusResigned")} tone="warning" />}
                                        </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">{employee.userName ?? "-"}</td>
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">
                                        {(employee.workshopNameVn && localeName(locale, employee.workshopNameVn, employee.workshopNameJp)[0]) ??
                                            (employee.approvalScopes.length > 0
                                                ? [...new Set(employee.approvalScopes.map((s) => s.workshopNameVn))].join(", ")
                                                : "-")}
                                    </td>
                                    <td className="px-2 py-1 text-sm leading-4 text-[#191c1e]">
                                        {(!employee.groupNameVn && employee.approvalScopes.length > 0
                                            ? employee.approvalScopes.map((s) => `${s.departmentNameVn} (${s.workshopNameVn})`).join(", ")
                                            : employee.departmentNameVn && localeName(locale, employee.departmentNameVn, employee.departmentNameJp)[0]) || (
                                            <span className="text-xs italic text-[#8a8f94]">{t("orgUnitCompanyWide")}</span>
                                        )}
                                        {employee.groupNameVn && (
                                            <div className="text-xs text-[#5e3f3a]" title={localeName(locale, employee.groupNameVn, employee.groupNameJp)[1]}>
                                                {localeName(locale, employee.groupNameVn, employee.groupNameJp)[0]}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 text-sm text-[#191c1e]">
                                        {employee.jobTitleName ?? (
                                            <span className="text-[#8a8f94]" title={t("noJobTitle")}>
                                                -
                                            </span>
                                        )}
                                    </td>
                                    {showLine && <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">{employee.lineCode ?? "-"}</td>}
                                    {showTeam && <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">{employee.teamCode ?? "-"}</td>}
                                    {showShift && <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">{employee.shiftTeamCode ?? "-"}</td>}
                                    {showCongDoan && <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">{employee.congDoan ?? "-"}</td>}
                                    <td className="px-2 py-1.5 text-sm text-[#5e3f3a]">
                                        {employee.taskName ?? "-"}
                                        {employee.staffKind && <span className="ml-1 text-xs text-[#8a8f94]">{employee.staffKind}</span>}
                                    </td>
                                    <HoursCell hours={employee.monthToDate} limit={monthLimit} isCustom={employee.customMonthlyOtHourLimit !== null} />
                                    <HoursCell hours={employee.yearToDate} limit={yearLimit} isCustom={employee.customYearlyOtHourLimit !== null} />
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
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
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

            <ConfirmDialog
                isOpen={bulkAction !== null}
                title={t(bulkAction === "delete" ? "bulkDeleteTitle" : "restoreResignedTitle")}
                message={t(bulkAction === "delete" ? "bulkDeleteMessage" : "restoreResignedMessage", { count: selectedIds.length })}
                approveLabel={bulkAction === "delete" ? tCommon("confirmDeleteApprove") : t("restoreResignedApprove")}
                deniedLabel={tCommon("cancel")}
                loading={isBulkRunning}
                onApprove={handleBulkAction}
                onDenied={() => {
                    if (!isBulkRunning) setBulkAction(null);
                }}
            />

            {historyEmployee && (
                <AccumulationHistoryModal
                    employeeId={historyEmployee.id}
                    employeeLabel={`${historyEmployee.lastName} ${historyEmployee.firstName} (${historyEmployee.code})`}
                    monthlyLimit={historyEmployee.customMonthlyOtHourLimit}
                    yearlyLimit={historyEmployee.customYearlyOtHourLimit}
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

// Plain number unless over the person's own limit (custom or default); a custom limit gets a small marker.
function HoursCell({ hours, limit, isCustom }: { hours: number; limit: number; isCustom: boolean }) {
    const t = useTranslations("Attendance.Employee");
    const isOver = hours > limit;
    return (
        <td className={`px-2 py-1.5 text-right text-sm tabular-nums ${isOver ? "font-semibold text-[#930006]" : "text-[#191c1e]"}`}>
            <span className="inline-flex items-center gap-1" title={isOver ? t("overLimitTitle", { limit }) : undefined}>
                {isOver && <AlertTriangle className="h-3.5 w-3.5" role="img" aria-label={t("overLimitTitle", { limit })} />}
                {hours}h
                {isCustom && (
                    <span role="img" aria-label={t("customLimitTitle", { limit })} title={t("customLimitTitle", { limit })}>
                        <SlidersHorizontal className="h-3 w-3 text-[#8a8f94]" aria-hidden />
                    </span>
                )}
            </span>
        </td>
    );
}

// Secondary filters behind one toolbar button; the badge counts the active ones.
function FilterPopover({ icon: Icon, label, count, children }: { icon: LucideIcon; label: string; count: number; children: ReactNode }) {
    const [open, setOpen] = useState(false);
    // React events bubble through portals, so a click inside a child dropdown's portaled panel still counts as inside.
    const insideRef = useRef(false);

    useEffect(() => {
        if (!open) return;
        const handleDown = () => {
            if (!insideRef.current) setOpen(false);
            insideRef.current = false;
        };
        const handleKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", handleDown);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleDown);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open]);

    const active = open || count > 0;
    return (
        <div className="relative" onMouseDown={() => (insideRef.current = true)}>
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-sm font-medium transition ${
                    active ? "border-[#e9bcb6] bg-[#fff4f2] text-[#e3000f]" : "border-[#e0e3e5] bg-white text-[#5e3f3a] hover:bg-[#f2f4f6]"
                }`}
            >
                <Icon className="h-4 w-4" />
                {label}
                {count > 0 && <span className="rounded-full bg-[#e3000f] px-1.5 text-xs font-semibold leading-5 text-white">{count}</span>}
            </button>
            {open && (
                <div className="absolute left-0 top-full z-30 mt-1 grid w-max grid-cols-2 gap-2 rounded-lg border border-[#e0e3e5] bg-white p-2 shadow-lg">
                    {children}
                </div>
            )}
        </div>
    );
}

export default EmployeeList;
