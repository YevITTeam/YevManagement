"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";

import { ReasonApi } from "@/modules/attendance/api/reason.api";
import type { ReasonDto } from "@/modules/attendance/types/reason.dto";
import ReasonForm, { type ReasonFormValues } from "./ReasonForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Pagination } from "@/components/ui/Pagination";
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";
import { ErrorBar, FilterActions, IconButton, ListToolbar, SearchField, TableStatusRows, theadRowClassName } from "@/components/ui/ListToolbar";

const PAGE_SIZE = 10;

const ReasonList = forwardRef<ListHandle, ListToolbarProps>(function ReasonList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.Reason");
    const tCommon = useTranslations("Common");
    const [reasons, setReasons] = useState<ReasonDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = usePersistedState("page-size:attendance/components/reasons/ReasonList", PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingReason, setEditingReason] = useState<ReasonDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingReason, setDeletingReason] = useState<ReasonDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchReasons } = useFetchEffect(
        () => ReasonApi.getReasonPageNation({ pageIndex, pageSize, keyword: appliedKeyword || undefined }),
        [pageIndex, pageSize, appliedKeyword],
        (result) => {
            setReasons(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
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

    const handleReset = () => {
        setPageIndex(1);
        setKeyword("");
        setAppliedKeyword("");
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
                <ListToolbar>
                    <SearchField value={keyword} onChange={setKeyword} onEnter={handleSearch} placeholder={t("searchPlaceholder")} wide />
                    <FilterActions onSearch={handleSearch} onReset={handleReset} disabled={isLoading} />
                </ListToolbar>
                <ErrorBar message={error} />

                <TableScroll>
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className={theadRowClassName}>
                                <th className="px-3 py-2">{t("colNameVn")}</th>
                                <th className="w-px px-3 py-2" aria-label={tCommon("actions")} />
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={reasons.length === 0} columns={2} emptyText={t("noData")} />
                            {reasons.map((reason) => (
                                <tr key={reason.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-3 py-2 text-sm">
                                        <div className="font-semibold text-[#191c1e]">{reason.reasonNameVn}</div>
                                        {reason.reasonNameJp && <div className="text-xs text-[#8a8f94]">{reason.reasonNameJp}</div>}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <IconButton icon={Pencil} label={tCommon("edit")} onClick={() => openEditForm(reason)} size="sm" variant="ghost" />
                                            <IconButton icon={Trash2} label={tCommon("delete")} onClick={() => setDeletingReason(reason)} size="sm" variant="danger" />
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
                    summary={isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: reasons.length, total: totalCount })}
                    compactSummary={totalCount}
                />
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
