"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";

import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import WorkshopForm, { type WorkshopFormValues } from "./WorkshopForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Pagination } from "@/components/ui/Pagination";
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";
import { ErrorBar, FilterActions, IconButton, ListToolbar, SearchField, TableStatusRows, theadRowClassName } from "@/components/ui/ListToolbar";

const PAGE_SIZE = 10;

const WorkshopList = forwardRef<ListHandle, ListToolbarProps>(function WorkshopList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.Workshop");
    const tCommon = useTranslations("Common");
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = usePersistedState("page-size:attendance/components/workshops/WorkshopList", PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingWorkshop, setEditingWorkshop] = useState<WorkshopDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingWorkshop, setDeletingWorkshop] = useState<WorkshopDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchWorkshops } = useFetchEffect(
        () => WorkshopApi.getWorkshopPageNation({ pageIndex, pageSize, keyword: appliedKeyword || undefined }),
        [pageIndex, pageSize, appliedKeyword],
        (result) => {
            setWorkshops(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("loadError"),
        (message) => toast.error(message),
        "workshops"
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingWorkshop(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: fetchWorkshops,
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

    const openEditForm = (workshop: WorkshopDto) => {
        setFormMode("edit");
        setEditingWorkshop(workshop);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingWorkshop(null);
    };

    const handleSubmitForm = async (values: WorkshopFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await WorkshopApi.createWorkshop(values);
                toast.success(t("createSuccess"));
            } else if (editingWorkshop) {
                await WorkshopApi.updateWorkshop(editingWorkshop.id, values);
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingWorkshop(null);
            await fetchWorkshops();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? t("createError") : t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingWorkshop) return;
        setIsDeleting(true);
        try {
            await WorkshopApi.deleteWorkshop(deletingWorkshop.id);
            toast.success(t("deleteSuccess"));
            setDeletingWorkshop(null);
            await fetchWorkshops();
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
                            <TableStatusRows loading={isLoading} empty={workshops.length === 0} columns={3} emptyText={t("noData")} />
                            {workshops.map((workshop) => (
                                <tr key={workshop.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{workshop.workshopCode}</td>
                                    <td className="px-3 py-2 text-sm">
                                        <div className="text-[#191c1e]">{workshop.workshopNameVn}</div>
                                        {workshop.workshopNameJp && <div className="text-xs text-[#8a8f94]">{workshop.workshopNameJp}</div>}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <IconButton icon={Pencil} label={tCommon("edit")} onClick={() => openEditForm(workshop)} size="sm" variant="ghost" />
                                            <IconButton icon={Trash2} label={tCommon("delete")} onClick={() => setDeletingWorkshop(workshop)} size="sm" variant="danger" />
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
                    summary={isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: workshops.length, total: totalCount })}
                    compactSummary={totalCount}
                />
            </section>

            <WorkshopForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingWorkshop}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingWorkshop !== null}
                title={t("deleteTitle")}
                message={t.rich("deleteMessage", {
                    name: deletingWorkshop?.workshopNameVn ?? "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingWorkshop(null);
                }}
            />
        </div>
    );
});

export default WorkshopList;
