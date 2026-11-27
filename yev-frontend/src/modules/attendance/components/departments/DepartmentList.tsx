"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";

import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import DepartmentForm, { type DepartmentFormValues } from "./DepartmentForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Pagination } from "@/components/ui/Pagination";
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";
import { ErrorBar, FilterActions, IconButton, ListToolbar, SearchField, TableStatusRows, theadRowClassName } from "@/components/ui/ListToolbar";

const PAGE_SIZE = 10;

const DepartmentList = forwardRef<ListHandle, ListToolbarProps>(function DepartmentList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.Department");
    const tCommon = useTranslations("Common");
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = usePersistedState("page-size:attendance/components/departments/DepartmentList", PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingDepartment, setEditingDepartment] = useState<DepartmentDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingDepartment, setDeletingDepartment] = useState<DepartmentDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchDepartments } = useFetchEffect(
        () => DepartmentApi.getDepartmentPageNation({ pageIndex, pageSize, keyword: appliedKeyword || undefined }),
        [pageIndex, pageSize, appliedKeyword],
        (result) => {
            setDepartments(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("loadError"),
        (message) => toast.error(message),
        "departments"
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingDepartment(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: fetchDepartments,
        openCreate: openCreateForm,
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const handleReset = () => {
        setPageIndex(1);
        setKeyword("");
        setAppliedKeyword("");
    };

    const openEditForm = (department: DepartmentDto) => {
        setFormMode("edit");
        setEditingDepartment(department);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingDepartment(null);
    };

    const handleSubmitForm = async (values: DepartmentFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await DepartmentApi.createDepartment(values);
                toast.success(t("createSuccess"));
            } else if (editingDepartment) {
                await DepartmentApi.updateDepartment(editingDepartment.id, values);
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingDepartment(null);
            await fetchDepartments();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? t("createError") : t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingDepartment) return;
        setIsDeleting(true);
        try {
            await DepartmentApi.deleteDepartment(deletingDepartment.id);
            toast.success(t("deleteSuccess"));
            setDeletingDepartment(null);
            await fetchDepartments();
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
                <ListToolbar>
                    <SearchField value={keyword} onChange={setKeyword} onEnter={handleSearch} placeholder={t("searchPlaceholder")} wide />
                    <FilterActions onSearch={handleSearch} onReset={handleReset} disabled={isLoading} />
                </ListToolbar>
                <ErrorBar message={error} />

                <TableScroll>
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className={theadRowClassName}>
                                <th className="px-3 py-2">{t("colCode")}</th>
                                <th className="px-3 py-2">{t("colNameVn")}</th>
                                <th className="w-px px-3 py-2" aria-label={tCommon("actions")} />
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={departments.length === 0} columns={3} emptyText={t("noData")} />
                            {departments.map((department) => (
                                <tr key={department.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{department.departmentCode}</td>
                                    <td className="px-3 py-2 text-sm">
                                        <div className="text-[#191c1e]">{department.departmentNameVn}</div>
                                        {department.departmentNameJp && <div className="text-xs text-[#8a8f94]">{department.departmentNameJp}</div>}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <IconButton icon={Pencil} label={tCommon("edit")} onClick={() => openEditForm(department)} size="sm" variant="ghost" />
                                            <IconButton icon={Trash2} label={tCommon("delete")} onClick={() => setDeletingDepartment(department)} size="sm" variant="danger" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableScroll>

                <Pagination
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                    pageIndex={pageIndex}
                    totalPages={totalPages}
                    onPageChange={setPageIndex}
                    disabled={isLoading}
                    summary={isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: departments.length, total: totalCount })}
                    compactSummary={totalCount}
                />
            </section>

            <DepartmentForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingDepartment}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingDepartment !== null}
                title={t("deleteTitle")}
                message={t.rich("deleteMessage", {
                    name: deletingDepartment?.departmentNameVn ?? "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingDepartment(null);
                }}
            />
        </div>
    );
});

export default DepartmentList;
