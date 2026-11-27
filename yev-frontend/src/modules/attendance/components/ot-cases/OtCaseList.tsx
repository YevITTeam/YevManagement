"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { PenLine, Pencil, Trash2 } from "lucide-react";

import { OtCaseApi } from "@/modules/attendance/api/ot-case.api";
import type { OtCaseDto } from "@/modules/attendance/types/ot-case.dto";
import { useEnumLabels } from "@/modules/attendance/lib/useEnumLabels";
import OtCaseForm, { type OtCaseFormValues } from "./OtCaseForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Pagination } from "@/components/ui/Pagination";
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";
import { ErrorBar, FilterActions, IconButton, IconFlag, ListToolbar, SearchField, TableStatusRows, theadRowClassName } from "@/components/ui/ListToolbar";

const PAGE_SIZE = 10;

const OtCaseList = forwardRef<ListHandle, ListToolbarProps>(function OtCaseList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.OtCase");
    const tCommon = useTranslations("Common");
    const enumLabels = useEnumLabels();
    const [otCases, setOtCases] = useState<OtCaseDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = usePersistedState("page-size:attendance/components/ot-cases/OtCaseList", PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingOtCase, setEditingOtCase] = useState<OtCaseDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingOtCase, setDeletingOtCase] = useState<OtCaseDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchOtCases } = useFetchEffect(
        () => OtCaseApi.getOtCasePageNation({ pageIndex, pageSize, keyword: appliedKeyword || undefined }),
        [pageIndex, pageSize, appliedKeyword],
        (result) => {
            setOtCases(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("loadError"),
        (message) => toast.error(message),
        "ot-cases"
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingOtCase(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: fetchOtCases,
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

    const openEditForm = (otCase: OtCaseDto) => {
        setFormMode("edit");
        setEditingOtCase(otCase);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingOtCase(null);
    };

    const handleSubmitForm = async (values: OtCaseFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await OtCaseApi.createOtCase(values);
                toast.success(t("createSuccess"));
            } else if (editingOtCase) {
                await OtCaseApi.updateOtCase(editingOtCase.id, values);
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingOtCase(null);
            await fetchOtCases();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? t("createError") : t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingOtCase) return;
        setIsDeleting(true);
        try {
            await OtCaseApi.deleteOtCase(deletingOtCase.id);
            toast.success(t("deleteSuccess"));
            setDeletingOtCase(null);
            await fetchOtCases();
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
                    <SearchField value={keyword} onChange={setKeyword} onEnter={handleSearch} placeholder={t("searchPlaceholder")} />
                    <FilterActions onSearch={handleSearch} onReset={handleReset} disabled={isLoading} />
                </ListToolbar>
                <ErrorBar message={error} />

                <TableScroll>
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className={theadRowClassName}>
                                <th className="px-3 py-2">{t("colCode")}</th>
                                <th className="px-3 py-2">{t("colDescription")}</th>
                                <th className="px-3 py-2">{t("colRequiredLevel")}</th>
                                <th className="px-3 py-2" title={t("fieldRequireSignature")}>{t("colRequireSignature")}</th>
                                <th className="w-px px-3 py-2" aria-label={tCommon("actions")} />
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={otCases.length === 0} columns={5} emptyText={t("noData")} />
                            {otCases.map((otCase) => (
                                <tr key={otCase.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{otCase.code}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                        {otCase.description}
                                        {otCase.descriptionJp && <div className="text-xs text-[#8a8f94]">{otCase.descriptionJp}</div>}
                                    </td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                        {enumLabels.approvalLevel[otCase.requiredApprovalLevel] ?? otCase.requiredApprovalLevel}
                                    </td>
                                    <td className="px-3 py-2">
                                        {otCase.requireSignature && <IconFlag icon={PenLine} label={t("fieldRequireSignature")} tone="success" />}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <IconButton icon={Pencil} label={tCommon("edit")} onClick={() => openEditForm(otCase)} size="sm" variant="ghost" />
                                            <IconButton icon={Trash2} label={tCommon("delete")} onClick={() => setDeletingOtCase(otCase)} size="sm" variant="danger" />
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
                    summary={isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: otCases.length, total: totalCount })}
                    compactSummary={totalCount}
                />
            </section>

            <OtCaseForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingOtCase}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingOtCase !== null}
                title={t("deleteTitle")}
                message={t.rich("deleteMessage", {
                    name: deletingOtCase?.code ?? "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingOtCase(null);
                }}
            />
        </div>
    );
});

export default OtCaseList;
