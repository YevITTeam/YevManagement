"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { GripVertical, Inbox, Search } from "lucide-react";

import { JobTitleApi } from "@/modules/attendance/api/job-title.api";
import type { JobTitleDto } from "@/modules/attendance/types/job-title.dto";
import { jobTitleTerminalLevelLabels } from "@/modules/attendance/types/enums";
import JobTitleForm, { type JobTitleFormValues } from "./JobTitleForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useDragReorder } from "./useDragReorder";

const PAGE_SIZE = 20;

const JobTitleList = forwardRef<ListHandle, ListToolbarProps>(function JobTitleList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.JobTitle");
    const tCommon = useTranslations("Common");
    const [jobTitles, setJobTitles] = useState<JobTitleDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
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

    // Kéo-thả đổi Cấp độ (RankOrder) — chỉ có ý nghĩa khi đang xem ĐỦ toàn bộ chức vụ active trên 1
    // trang (không lọc từ khoá, không phân trang), vì lưu thứ tự gửi lên BE nguyên bộ Id đang hiển thị
    // (xem JobTitleApi.reorderJobTitles/JobTitleService.ReorderAsync — BE validate khớp đúng tập hợp
    // đang có). Kéo xong CHƯA lưu ngay — đánh dấu dirty, người dùng bấm "Lưu thứ tự" mới gọi API, cùng
    // pattern với ApprovalStepManager.tsx (isDeptDirty/isGroupDirty).
    const canReorder = !appliedKeyword && !hasPreviousPage && !hasNextPage && jobTitles.length > 1;
    const [isOrderDirty, setIsOrderDirty] = useState(false);
    const [isSavingOrder, setIsSavingOrder] = useState(false);

    const { isLoading, error, refetch: fetchJobTitles } = useFetchEffect(
        () => JobTitleApi.getJobTitlePageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
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
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2">
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
                            title={tCommon("search")}
                            aria-label={tCommon("search")}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50 inline-flex h-9 w-9 shrink-0 items-center justify-center"
                        >
                            <Search className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-[#5e3f3a]">
                            {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: jobTitles.length, total: totalCount })}
                        </div>
                        {isOrderDirty && (
                            <button
                                onClick={handleSaveOrder}
                                disabled={isSavingOrder}
                                className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSavingOrder ? t("savingOrder") : t("saveOrderButton")}
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                {!canReorder && jobTitles.length > 1 && (
                    <div className="border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-2 text-xs text-[#8a8f94]">{t("dragDisabledHint")}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="w-10 px-2 py-2.5" />
                                <th className="px-4 py-2.5">{t("colCode")}</th>
                                <th className="px-4 py-2.5">{t("colName")}</th>
                                <th className="px-4 py-2.5">{t("colRankOrder")}</th>
                                <th className="px-4 py-2.5">{t("colTerminalLevel")}</th>
                                <th className="px-4 py-2.5 text-right">{tCommon("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && jobTitles.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12">
                                        <div className="flex flex-col items-center gap-2 text-center text-sm text-[#5e3f3a]">
                                            <Inbox className="h-8 w-8 text-[#c7ccd1]" />
                                            {t("noData")}
                                        </div>
                                    </td>
                                </tr>
                            )}
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
                                    <td className="px-2 py-3 text-center">
                                        <span
                                            title={canReorder ? t("dragHandleLabel") : t("dragDisabledHint")}
                                            aria-label={t("dragHandleLabel")}
                                            className={`inline-flex ${canReorder ? "cursor-grab text-[#8a8f94] active:cursor-grabbing" : "cursor-not-allowed text-[#d7dbe0]"}`}
                                        >
                                            <GripVertical className="h-4 w-4" />
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold text-[#191c1e]">{jobTitle.code}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">{jobTitle.name}</td>
                                    <td className="px-4 py-3 text-sm text-[#5e3f3a]">{index + 1}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-medium text-[#5e3f3a]">
                                            {jobTitleTerminalLevelLabels[jobTitle.terminalLevel] ?? jobTitle.terminalLevel}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(jobTitle)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title={tCommon("edit")}
                                            >
                                                {tCommon("edit")}
                                            </button>
                                            <button
                                                onClick={() => setDeletingJobTitle(jobTitle)}
                                                className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#e3000f]"
                                                title={tCommon("delete")}
                                            >
                                                {tCommon("delete")}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
