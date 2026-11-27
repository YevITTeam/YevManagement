"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { GripVertical, Loader2, Pencil, Save, Trash2 } from "lucide-react";

import { JobTitleApi } from "@/modules/attendance/api/job-title.api";
import type { JobTitleDto } from "@/modules/attendance/types/job-title.dto";
import { useEnumLabels } from "@/modules/attendance/lib/useEnumLabels";
import JobTitleForm, { type JobTitleFormValues } from "./JobTitleForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Pagination } from "@/components/ui/Pagination";
import { useDragReorder } from "./useDragReorder";
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";
import { ErrorBar, FilterActions, IconButton, ListToolbar, SearchField, TableStatusRows, theadRowClassName } from "@/components/ui/ListToolbar";

const PAGE_SIZE = 20;

const JobTitleList = forwardRef<ListHandle, ListToolbarProps>(function JobTitleList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.JobTitle");
    const tCommon = useTranslations("Common");
    const enumLabels = useEnumLabels();
    const [jobTitles, setJobTitles] = useState<JobTitleDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = usePersistedState("page-size:attendance/components/job-titles/JobTitleList", PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingJobTitle, setEditingJobTitle] = useState<JobTitleDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingJobTitle, setDeletingJobTitle] = useState<JobTitleDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Reorder only when every active title is shown (no keyword, single page): saving sends the full id set,
    // which BE validates against the existing titles.
    const canReorder = !appliedKeyword && !hasPreviousPage && !hasNextPage && jobTitles.length > 1;
    const [isOrderDirty, setIsOrderDirty] = useState(false);
    const [isSavingOrder, setIsSavingOrder] = useState(false);

    const { isLoading, error, refetch: fetchJobTitles } = useFetchEffect(
        () => JobTitleApi.getJobTitlePageNation({ pageIndex, pageSize, keyword: appliedKeyword || undefined }),
        [pageIndex, pageSize, appliedKeyword],
        (result) => {
            setJobTitles(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
            setIsOrderDirty(false);
        },
        t("loadError"),
        (message) => toast.error(message),
        "job-titles"
    );

    const handleReorderRows = (next: JobTitleDto[]) => {
        setJobTitles(next);
        setIsOrderDirty(true);
    };
    const drag = useDragReorder(jobTitles, handleReorderRows, (jt) => jt.id);

    const handleSaveOrder = async () => {
        setIsSavingOrder(true);
        try {
            const data = await JobTitleApi.reorderJobTitles(jobTitles.map((jt) => jt.id));
            setJobTitles(data);
            setIsOrderDirty(false);
            toast.success(t("reorderSuccess"));
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("reorderError")));
            await fetchJobTitles();
        } finally {
            setIsSavingOrder(false);
        }
    };

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingJobTitle(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: fetchJobTitles,
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

    const openEditForm = (jobTitle: JobTitleDto) => {
        setFormMode("edit");
        setEditingJobTitle(jobTitle);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingJobTitle(null);
    };

    const handleSubmitForm = async (values: JobTitleFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await JobTitleApi.createJobTitle(values);
                toast.success(t("createSuccess"));
            } else if (editingJobTitle) {
                await JobTitleApi.updateJobTitle(editingJobTitle.id, values);
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingJobTitle(null);
            await fetchJobTitles();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? t("createError") : t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingJobTitle) return;
        setIsDeleting(true);
        try {
            await JobTitleApi.deleteJobTitle(deletingJobTitle.id);
            toast.success(t("deleteSuccess"));
            setDeletingJobTitle(null);
            await fetchJobTitles();
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
                <ListToolbar
                    actions={
                        isOrderDirty && (
                            <button
                                onClick={handleSaveOrder}
                                disabled={isSavingOrder}
                                className="inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-[#e3000f] px-3 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSavingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                {t("saveOrderButton")}
                            </button>
                        )
                    }
                >
                    <SearchField value={keyword} onChange={setKeyword} onEnter={handleSearch} placeholder={t("searchPlaceholder")} wide />
                    <FilterActions onSearch={handleSearch} onReset={handleReset} disabled={isLoading} />
                </ListToolbar>
                <ErrorBar message={error} />

                <TableScroll>
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className={theadRowClassName}>
                                <th className="px-3 py-2">{t("colRankOrder")}</th>
                                <th className="px-3 py-2">{t("colCode")}</th>
                                <th className="px-3 py-2">{t("colName")}</th>
                                <th className="px-3 py-2">{t("colTerminalLevel")}</th>
                                <th className="w-px px-3 py-2" aria-label={tCommon("actions")} />
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={jobTitles.length === 0} columns={5} emptyText={t("noData")} />
                            {jobTitles.map((jobTitle, index) => (
                                <tr
                                    key={jobTitle.id}
                                    ref={drag.registerNode(jobTitle.id)}
                                    draggable={canReorder}
                                    onDragStart={canReorder ? drag.handleDragStart(index) : undefined}
                                    onDragOver={canReorder ? drag.handleDragOver(index) : undefined}
                                    onDragEnd={canReorder ? drag.handleDragEnd : undefined}
                                    className={`border-b border-[#f1f5f9] transition-colors ${
                                        drag.dragIndex === index ? "z-10 bg-[#fff4f2] shadow-lg" : "hover:bg-[#f8fafc]"
                                    }`}
                                >
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                        <span className="inline-flex items-center gap-1">
                                            <span
                                                title={canReorder ? t("dragHandleLabel") : t("dragDisabledHint")}
                                                aria-label={t("dragHandleLabel")}
                                                className={`inline-flex ${canReorder ? "cursor-grab text-[#8a8f94] active:cursor-grabbing" : "cursor-not-allowed text-[#e0e3e5]"}`}
                                            >
                                                <GripVertical className="h-4 w-4" />
                                            </span>
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{jobTitle.code}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{jobTitle.name}</td>
                                    {/* 0 = intermediate level, the common case: leave the cell empty. */}
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                        {jobTitle.terminalLevel !== 0 && (enumLabels.terminalLevel[jobTitle.terminalLevel] ?? jobTitle.terminalLevel)}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <IconButton icon={Pencil} label={tCommon("edit")} onClick={() => openEditForm(jobTitle)} size="sm" variant="ghost" />
                                            <IconButton icon={Trash2} label={tCommon("delete")} onClick={() => setDeletingJobTitle(jobTitle)} size="sm" variant="danger" />
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
                    summary={isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: jobTitles.length, total: totalCount })}
                    compactSummary={totalCount}
                />
            </section>

            <JobTitleForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingJobTitle}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingJobTitle !== null}
                title={t("deleteTitle")}
                message={t.rich("deleteMessage", {
                    name: deletingJobTitle?.name ?? "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingJobTitle(null);
                }}
            />
        </div>
    );
});

export default JobTitleList;
