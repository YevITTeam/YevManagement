"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import {
    AlertTriangle,
    CalendarClock,
    Clock,
    Download,
    FileSpreadsheet,
    History,
    Inbox,
    Link2,
    Pencil,
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
import { Badge } from "@/components/ui/Badge";
import EmployeeForm, { type EmployeeFormValues } from "./EmployeeForm";
import type { EmployeeExportFilter } from "@/modules/attendance/types/employee-import.dto";
import EmployeeImportDialog from "./EmployeeImportDialog";
import EmployeeOtHourLimitImportDialog from "./EmployeeOtHourLimitImportDialog";
import EmployeeMonthlyAccumulationImportDialog from "./EmployeeMonthlyAccumulationImportDialog";
import EmployeeIdentityLinkImportDialog from "./EmployeeIdentityLinkImportDialog";
import EmployeeOtLimitDialog from "./EmployeeOtLimitDialog";
import ProductionEmployeeImportDialog from "./ProductionEmployeeImportDialog";
import ProductionEmployeeList, { type ProductionEmployeeListHandle } from "./ProductionEmployeeList";
import AccumulationHistoryModal from "./AccumulationHistoryModal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import { ProductionEmployeeExportApi } from "@/modules/attendance/api/production-employee-import.api";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";

const PAGE_SIZE = 10;
type ViewMode = "employee" | "production";

const EmployeeList = forwardRef<ListHandle, ListToolbarProps>(function EmployeeList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.Employee");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    const canUpdateEmployee = hasPermission(user, "Attendance.Employee.Update");
    const canDeleteEmployee = hasPermission(user, "Attendance.Employee.Delete");
    const canUpdateOtLimit = hasPermission(user, "Attendance.Employee.UpdateOtLimit");
    const canUpdateAccumulation = hasPermission(user, "Attendance.EmployeeAccumulation.Update");
    const canCreateEmployee = hasPermission(user, "Attendance.Employee.Create");
    // Chế độ "Nhân viên dưới chuyền" chỉ hiện với người được Admin cấp quyền xem riêng (2026-09-26).
    const canViewProduction = hasPermission(user, "Attendance.ProductionEmployee.View");
    // Import liên kết Identity ↔ Attendance + tự tạo tài khoản + chữ ký (2026-09-03) — permission riêng
    // CHỈ Admin có sẵn (không auto-grant qua JobTitle/Coordinator), xem docs/docs-be/attendance-module.md.
    const canImportIdentityLink = hasPermission(user, "Identity.User.BulkImport");
    const [employees, setEmployees] = useState<EmployeeDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    // Lọc theo Phòng ban/Bộ phận — giúp Admin dễ tìm đúng nhóm nhân viên cần gán Chức vụ (docs
    // §Cây chức vụ). Bộ phận cascading theo Phòng ban đã chọn, giống pattern OtCaseForm/GroupForm.
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);
    const [workshopId, setWorkshopId] = useState<number | "">("");
    const [groupId, setGroupId] = useState<number | "">("");

    // Phạm vi xem của người gọi (2026-09-03, xem EmployeeService.GetMyScopeAsync) — non-Admin không
    // phải Trưởng Xưởng/Giám đốc chỉ được thu hẹp dropdown lọc đúng phần họ thật sự xem được, tránh
    // hiện toàn bộ Phòng ban/Nhóm công ty rồi chọn ra bảng rỗng không rõ lý do (BE đã tự scope
    // GetPagedAsync/GetAllActiveAsync từ trước — đây chỉ là UX, không phải lớp chặn bảo mật).
    const [scope, setScope] = useState<EmployeeScopeDto | null>(null);
    const isScopeRestricted = scope !== null && !scope.companyWide;
    const showDepartmentFilter = scope === null || scope.companyWide || scope.departments.length > 0;

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingEmployee, setEditingEmployee] = useState<EmployeeDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingEmployee, setDeletingEmployee] = useState<EmployeeDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Xem lịch sử lũy kế theo tháng/năm (2026-08-11d) — modal dùng chung, xem AccumulationHistoryModal.tsx.
    const [historyEmployee, setHistoryEmployee] = useState<EmployeeDto | null>(null);

    // Sửa RIÊNG giới hạn OT (2026-08-29) — permission hẹp Attendance.Employee.UpdateOtLimit, dành cho
    // Người phụ trách Bộ phận không có Attendance.Employee.Update, xem EmployeeOtLimitDialog.tsx.
    const [otLimitEmployee, setOtLimitEmployee] = useState<EmployeeDto | null>(null);

    const [importOpen, setImportOpen] = useState(false);
    const [identityLinkImportOpen, setIdentityLinkImportOpen] = useState(false);
    const [productionImportOpen, setProductionImportOpen] = useState(false);
    const [otHourLimitImportOpen, setOtHourLimitImportOpen] = useState(false);
    const [monthlyAccumulationImportOpen, setMonthlyAccumulationImportOpen] = useState(false);
    const [isExportingProduction, setIsExportingProduction] = useState(false);
    // Ngưỡng cảnh báo lũy kế lấy từ cấu hình (Admin sửa được), không còn hardcode 25/300.
    const { setting } = useAttendanceSetting();

    // "Nhân viên" (bảng Employees) <-> "Nhân viên dưới chuyền" (bảng ProductionEmployees, đọc-only) —
    // 2 view tách riêng trong cùng 1 tab, mỗi view có bộ lọc + thao tác Excel riêng (2026-08-27, theo
    // yêu cầu người dùng — trước đó dồn hết nút vào 1 hàng gây rối UI).
    const [viewMode, setViewMode] = useState<ViewMode>("employee");
    const productionListRef = useRef<ProductionEmployeeListHandle>(null);

    useEffect(() => {
        EmployeeApi.getMyScope()
            .then(setScope)
            .catch((err) => console.error(err));
    }, []);

    // Chờ biết phạm vi trước khi tải dropdown — tránh chớp hiện đủ Phòng ban/Nhóm công ty rồi mới rút
    // gọn lại. Bị giới hạn thì dùng THẲNG danh sách BE đã trả sẵn trong `scope` (2026-09-28 — trước đó
    // chỉ tải Nhóm CON của 1 Phòng ban duy nhất, không đúng khi phạm vi gồm NHIỀU Phòng ban/Nhóm).
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
            // Phạm vi đã cố định sẵn trong `scope.groups` (gồm đủ Nhóm của MỌI Phòng ban trong phạm
            // vi) — chỉ cần lọc lại theo Phòng ban vừa chọn/bỏ chọn, không cần gọi thêm API.
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
            }),
        [pageIndex, appliedKeyword, departmentId, groupId, workshopId],
        (result) => {
            setEmployees(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
        (message) => toast.error(message),
        "employees"
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setViewMode("employee");
        setFormMode("create");
        setEditingEmployee(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: () => {
            fetchEmployees();
            productionListRef.current?.refresh();
        },
        openCreate: openCreateForm,
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const handleExportProduction = async () => {
        setIsExportingProduction(true);
        try {
            const { blob, fileName } = await ProductionEmployeeExportApi.exportExcel();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? "NhanSuDuoiChuyen.xlsx";
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("exportProductionError")));
        } finally {
            setIsExportingProduction(false);
        }
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

    // Người phụ trách Bộ phận (không phải Admin) có thể chỉ giữ 1-2 trong 3 quyền này — lọc đúng theo
    // permission thật sự có, tránh hiện nút bấm vào sẽ 403 (2026-08-29).
    const canImportProduction = hasPermission(user, "Attendance.ProductionEmployee.Import");
    const canExportProduction = hasPermission(user, "Attendance.ProductionEmployee.Export");
    // Import lũy kế OT theo THÁNG, tổng quát cho MỌI Phòng ban (2026-09-03) — dùng lại đúng permission
    // đã tự động cấp cho Người phụ trách Bộ phận từ trước, không phải permission mới.
    const canImportMonthlyAccumulation = hasPermission(user, "Attendance.EmployeeAccumulation.Import");
    const productionExcelItems = [
        ...(canImportProduction
            ? [{ label: t("importProductionExcel"), onClick: () => setProductionImportOpen(true), icon: <Upload className="h-3.5 w-3.5" /> }]
            : []),
        ...(canExportProduction
            ? [
                  {
                      label: isExportingProduction ? t("exportingProduction") : t("exportProductionExcel"),
                      onClick: handleExportProduction,
                      disabled: isExportingProduction,
                      icon: <Download className="h-3.5 w-3.5" />,
                  },
              ]
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
    // Không còn mục nào được phép → ẩn hẳn nút Excel thay vì hiện menu rỗng.
    const productionExcelActions =
        productionExcelItems.length > 0 ? (
            <ActionMenu label={t("excelActionsLabel")} icon={<FileSpreadsheet className="h-3.5 w-3.5" />} items={productionExcelItems} />
        ) : null;

    // Gom "Import Excel" + "Liên kết tài khoản đăng nhập" + "Áp dụng lũy kế OT theo tháng" vào 1 menu
    // (mirror productionExcelActions ở trên) thay vì nhiều nút rời — giảm số nút tràn hàng trên toolbar
    // view "Nhân viên" (2026-09-04, theo yêu cầu người dùng "làm lại giao diện cho đẹp lại"). Mục lũy kế
    // trước đó CHỈ có ở menu Excel của tab "Nhân viên dưới chuyền" dù BE đã tổng quát cho mọi Phòng ban
    // (kể cả văn phòng) — thiếu sót phát hiện khi người dùng hỏi lại, bổ sung nốt ở đây.
    const exportFilter: EmployeeExportFilter = {
        keyword: appliedKeyword || undefined,
        departmentId: departmentId || undefined,
        groupId: groupId || undefined,
        workshopId: workshopId || undefined,
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

    // Công tắc Nhân viên / Nhân viên dưới chuyền — đặt ngay đầu thanh công cụ của từng bảng (trước là 1 hàng
    // riêng phía trên) để bớt 1 hàng, nhường chỗ cho bảng.
    const effectiveViewMode: ViewMode = canViewProduction ? viewMode : "employee";
    const viewModeSwitch = !canViewProduction ? null : (
        <div className="inline-flex h-9 shrink-0 items-center rounded-lg border border-[#e0e3e5] bg-white p-0.5">
            {(["employee", "production"] as const).map((mode) => (
                <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`h-full cursor-pointer whitespace-nowrap rounded-md px-2.5 text-[13px] font-semibold transition ${
                        effectiveViewMode === mode ? "bg-[#fff4f2] text-[#e3000f]" : "text-[#5e3f3a] hover:text-[#191c1e]"
                    }`}
                >
                    {mode === "employee" ? t("viewModeEmployee") : t("viewModeProduction")}
                </button>
            ))}
        </div>
    );

    return (
        <div className="space-y-4">
            {effectiveViewMode === "production" ? (
                <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                    <ProductionEmployeeList ref={productionListRef} actions={productionExcelActions} leading={viewModeSwitch} />
                </section>
            ) : (
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        {viewModeSwitch}
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={t("searchPlaceholder")}
                            className="h-9 w-52 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
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
                            triggerClassName="h-9 w-36 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        {showDepartmentFilter && (
                            <SearchableSelect
                                options={departmentOptions}
                                value={departmentId}
                                onChange={handleSelectDepartment}
                                placeholder={t("filterDepartmentPlaceholder")}
                                triggerClassName="h-9 w-40 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                            />
                        )}
                        <SearchableSelect
                            options={groupOptions}
                            value={groupId}
                            onChange={handleSelectGroup}
                            placeholder={t("filterGroupPlaceholder")}
                            triggerClassName="h-9 w-40 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        {employeeExcelActions}
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-sm text-[#5e3f3a]">
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: employees.length, total: totalCount })}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="whitespace-nowrap border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-3 py-2">{t("colCode")}</th>
                                <th className="px-3 py-2">{t("colFullName")}</th>
                                <th className="px-3 py-2">{t("colUserName")}</th>
                                <th className="px-3 py-2">{t("colWorkshop")}</th>
                                <th className="px-3 py-2">{t("colGroup")}</th>
                                <th className="px-3 py-2">{t("colJobTitle")}</th>
                                <th className="px-3 py-2">{t("colMonthToDate")}</th>
                                <th className="px-3 py-2">{t("colYearToDate")}</th>
                                <th className="px-3 py-2 text-right">{tCommon("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && employees.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12">
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
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{employee.code}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                        {employee.lastName} {employee.firstName}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{employee.userName ?? "-"}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                        {employee.workshopNameVn ??
                                            (employee.approvalScopes.length > 0
                                                ? [...new Set(employee.approvalScopes.map((s) => s.workshopNameVn))].join(", ")
                                                : "-")}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                        {employee.groupNameVn ??
                                            (employee.approvalScopes.length > 0
                                                ? employee.approvalScopes.map((s) => `${s.departmentNameVn} (${s.workshopNameVn})`).join(", ")
                                                : employee.departmentNameVn) ?? (
                                            <span className="text-xs italic text-[#8a8f94]">{t("orgUnitCompanyWide")}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-sm">
                                        {employee.jobTitleName ? (
                                            <Badge variant="info">{employee.jobTitleName}</Badge>
                                        ) : (
                                            <span className="text-xs italic text-[#8a8f94]">{t("noJobTitle")}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-sm">
                                        <span className={accumulationBadgeClass(isMonthOverLimit)}>
                                            {isMonthOverLimit && <AlertTriangle className="h-3 w-3" />}
                                            {employee.monthToDate}h
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-sm">
                                        <span className={accumulationBadgeClass(isYearOverLimit)}>
                                            {isYearOverLimit && <AlertTriangle className="h-3 w-3" />}
                                            {employee.yearToDate}h
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-sm">
                                        <div className="inline-flex items-center gap-1.5">
                                            <button
                                                onClick={() => setHistoryEmployee(employee)}
                                                className="cursor-pointer rounded-md border border-[#e0e3e5] p-2 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                title={t("viewAccumulationHistory")}
                                                aria-label={t("viewAccumulationHistory")}
                                            >
                                                <History className="h-3.5 w-3.5" />
                                            </button>
                                            {canUpdateOtLimit && !canUpdateEmployee && (
                                                <button
                                                    onClick={() => setOtLimitEmployee(employee)}
                                                    className="cursor-pointer rounded-md border border-[#e0e3e5] p-2 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                    title={t("otLimitEditAction")}
                                                    aria-label={t("otLimitEditAction")}
                                                >
                                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            {canUpdateEmployee && (
                                                <button
                                                    onClick={() => openEditForm(employee)}
                                                    className="cursor-pointer rounded-md border border-[#e0e3e5] p-2 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                    title={tCommon("edit")}
                                                    aria-label={tCommon("edit")}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                            {canDeleteEmployee && (
                                                <button
                                                    onClick={() => setDeletingEmployee(employee)}
                                                    className="cursor-pointer rounded-md border border-[#e9bcb6] p-2 text-[#930006] transition hover:bg-[#fff4f2]"
                                                    title={tCommon("delete")}
                                                    aria-label={tCommon("delete")}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-[#e0e3e5] p-3">
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasPreviousPage || isLoading}
                        onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                    >
                        {tCommon("prevPage")}
                    </button>
                    <div className="flex h-8 items-center px-3 text-sm font-semibold text-[#191c1e]">
                        {tCommon("pageOf", { current: pageIndex, total: totalPages })}
                    </div>
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasNextPage || isLoading}
                        onClick={() => setPageIndex((current) => current + 1)}
                    >
                        {tCommon("nextPage")}
                    </button>
                </div>
            </section>
            )}

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

            <ProductionEmployeeImportDialog
                isOpen={productionImportOpen}
                onClose={() => setProductionImportOpen(false)}
                onImported={() => {
                    fetchEmployees();
                    productionListRef.current?.refresh();
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
