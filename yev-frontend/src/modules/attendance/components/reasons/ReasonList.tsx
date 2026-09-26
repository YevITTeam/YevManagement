"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Inbox, Search, Pencil, Trash2 } from "lucide-react";

import { ReasonApi } from "@/modules/attendance/api/reason.api";
import type { ReasonDto } from "@/modules/attendance/types/reason.dto";
import ReasonForm, { type ReasonFormValues } from "./ReasonForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const PAGE_SIZE = 10;

const ReasonList = forwardRef<ListHandle, ListToolbarProps>(function ReasonList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.Reason");
    const tCommon = useTranslations("Common");
    const [reasons, setReasons] = useState<ReasonDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingReason, setEditingReason] = useState<ReasonDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingReason, setDeletingReason] = useState<ReasonDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchReasons } = useFetchEffect(
        () => ReasonApi.getReasonPageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setReasons(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
        (message) => toast.error(message),
        "reasons"
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingReason(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: fetchReasons,
        openCreate: openCreateForm,
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openEditForm = (reason: ReasonDto) => {
        setFormMode("edit");
        setEditingReason(reason);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingReason(null);
    };

    const handleSubmitForm = async (values: ReasonFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await ReasonApi.createReason(values);
                toast.success(t("createSuccess"));
            } else if (editingReason) {
                await ReasonApi.updateReason(editingReason.id, values);
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingReason(null);
            await fetchReasons();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? t("createError") : t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingReason) return;
        setIsDeleting(true);
        try {
            await ReasonApi.deleteReason(deletingReason.id);
            toast.success(t("deleteSuccess"));
            setDeletingReason(null);
            await fetchReasons();
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
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={t("searchPlaceholder")}
                            className="h-9 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
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
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: reasons.length, total: totalCount })}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-3 py-2">{t("colNameVn")}</th>
                                <th className="px-3 py-2">{t("colNameJp")}</th>
                                <th className="px-3 py-2 text-right">{tCommon("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && reasons.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-12">
                                        <div className="flex flex-col items-center gap-2 text-center text-sm text-[#5e3f3a]">
                                            <Inbox className="h-8 w-8 text-[#c7ccd1]" />
                                            {t("noData")}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {reasons.map((reason) => (
                                <tr key={reason.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{reason.reasonNameVn}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{reason.reasonNameJp || "-"}</td>
                                    <td className="px-3 py-2 text-right text-sm">
                                        <div className="inline-flex items-center gap-1.5">
                                            <button
                                                onClick={() => openEditForm(reason)}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-40"
                                                title={tCommon("edit")}
                                                aria-label={tCommon("edit")}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingReason(reason)}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#e9bcb6] text-[#930006] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-40"
                                                title={tCommon("delete")}
                                                aria-label={tCommon("delete")}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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

            <ReasonForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingReason}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingReason !== null}
                title={t("deleteTitle")}
                message={t.rich("deleteMessage", {
                    name: deletingReason?.reasonNameVn ?? "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingReason(null);
                }}
            />
        </div>
    );
});

export default ReasonList;
