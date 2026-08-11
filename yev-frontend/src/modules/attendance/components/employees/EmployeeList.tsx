"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { AlertTriangle, Inbox } from "lucide-react";

import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import { GroupApi } from "@/modules/attendance/api/group.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import EmployeeForm, { type EmployeeFormValues } from "./EmployeeForm";
import EmployeeImportDialog from "./EmployeeImportDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";

const PAGE_SIZE = 10;

const EmployeeList = forwardRef<ListHandle, ListToolbarProps>(function EmployeeList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.Employee");
    const tCommon = useTranslations("Common");
    const [employees, setEmployees] = useState<EmployeeDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    // Lọc theo Phòng ban/Bộ phận — giúp Admin dễ tìm đúng nhóm nhân viên cần gán Chức vụ (docs
    // §Cây chức vụ). Bộ phận cascading theo Phòng ban đã chọn, giống pattern OtCaseForm/GroupForm.
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [groupId, setGroupId] = useState<number | "">("");

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

    const [importOpen, setImportOpen] = useState(false);
    // Ngưỡng cảnh báo lũy kế lấy từ cấu hình (Admin sửa được), không còn hardcode 25/300.
    const { setting } = useAttendanceSetting();

    useEffect(() => {
        DepartmentApi.getAllDepartments()
            .then(setDepartments)
            .catch((err) => console.error(err));
        GroupApi.getAllGroups()
            .then(setGroups)
            .catch((err) => console.error(err));
    }, []);

    const handleSelectDepartment = (nextId: number | "") => {
        setDepartmentId(nextId);
        setGroupId("");
        setPageIndex(1);
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

    const handleSelectGroup = (nextId: number | "") => {
        setGroupId(nextId);
        setPageIndex(1);
    };

    const departmentOptions: SelectOption[] = departments.map((d) => ({
        value: d.id,
        label: d.departmentNameVn,
        searchText: d.departmentNameVn.toLowerCase(),
    }));
    const groupOptions: SelectOption[] = groups.map((g) => ({
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
            }),
        [pageIndex, appliedKeyword, departmentId, groupId],
        (result) => {
            setEmployees(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
        (message) => toast.error(message)
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
        refresh: fetchEmployees,
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

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={t("searchPlaceholder")}
                            className="h-10 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="cursor-pointer h-10 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            {tCommon("search")}
                        </button>
                        <SearchableSelect
                            options={departmentOptions}
                            value={departmentId}
                            onChange={handleSelectDepartment}
                            placeholder={t("filterDepartmentPlaceholder")}
                            triggerClassName="h-10 w-56 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <SearchableSelect
                            options={groupOptions}
                            value={groupId}
                            onChange={handleSelectGroup}
                            placeholder={t("filterGroupPlaceholder")}
                            triggerClassName="h-10 w-56 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={() => setImportOpen(true)}
                            className="cursor-pointer h-10 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            {t("importExcel")}
                        </button>
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
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-4 py-2.5">{t("colCode")}</th>
                                <th className="px-4 py-2.5">{t("colFullName")}</th>
                                <th className="px-4 py-2.5">{t("colUserName")}</th>
                                <th className="px-4 py-2.5">{t("colGroup")}</th>
                                <th className="px-4 py-2.5">{t("colJobTitle")}</th>
                                <th className="px-4 py-2.5">{t("colMonthToDate")}</th>
                                <th className="px-4 py-2.5">{t("colYearToDate")}</th>
                                <th className="px-4 py-2.5 text-right">{tCommon("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && employees.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12">
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
                                <tr key={employee.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-4 py-3 text-sm font-semibold text-[#191c1e]">{employee.code}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">
                                        {employee.lastName} {employee.firstName}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">{employee.userName ?? "-"}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">
                                        {employee.groupNameVn ?? employee.departmentNameVn ?? (
                                            <span className="text-xs italic text-[#8a8f94]">{t("orgUnitCompanyWide")}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {employee.jobTitleName ? (
                                            <span className="text-[#5e3f3a]">{employee.jobTitleName}</span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full border border-[#e9bcb6] bg-[#fff4f2] px-2.5 py-0.5 text-xs font-medium text-[#930006]">
                                                {t("noJobTitle")}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className={accumulationBadgeClass(isMonthOverLimit)}>
                                            {isMonthOverLimit && <AlertTriangle className="h-3 w-3" />}
                                            {employee.monthToDate}h
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className={accumulationBadgeClass(isYearOverLimit)}>
                                            {isYearOverLimit && <AlertTriangle className="h-3 w-3" />}
                                            {employee.yearToDate}h
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(employee)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title={tCommon("edit")}
                                            >
                                                {tCommon("edit")}
                                            </button>
                                            <button
                                                onClick={() => setDeletingEmployee(employee)}
                                                className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#e3000f]"
                                                title={tCommon("delete")}
                                            >
                                                {tCommon("delete")}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-[#e0e3e5] p-4">
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

            <EmployeeImportDialog
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                onImported={fetchEmployees}
            />

            <EmployeeForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingEmployee}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
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
        </div>
    );
});

export default EmployeeList;
