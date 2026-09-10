"use client";

import { useState } from "react";
import { RefreshCw, Users, FolderKanban } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { FormCategoryApi } from "@/modules/workflow/api/form-category.api";
import { OrgUnitApi } from "@/modules/workflow/api/org-unit.api";
import type { FormCategoryDto } from "@/modules/workflow/types/form-category.dto";
import type { OrgUnitTreeDto } from "@/modules/workflow/types/org-unit.dto";
import FormCategoryForm, { type FormCategoryFormValues } from "./FormCategoryForm";
import FormCategoryCoordinatorsDialog from "./FormCategoryCoordinatorsDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeletonRows } from "@/components/common/TableSkeletonRows";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

const PAGE_SIZE = 10;

export default function FormCategoryList() {
    const t = useTranslations("Workflow.FormCategory");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    const canManage = hasPermission(user, "Workflow.FormDesign.Manage");

    const [formCategories, setFormCategories] = useState<FormCategoryDto[]>([]);
    const [orgUnitTree, setOrgUnitTree] = useState<OrgUnitTreeDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingItem, setEditingItem] = useState<FormCategoryDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingItem, setDeletingItem] = useState<FormCategoryDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [coordinatorsItem, setCoordinatorsItem] = useState<FormCategoryDto | null>(null);

    const { isLoading, error, refetch: fetchFormCategories } = useFetchEffect(
        () => FormCategoryApi.getFormCategoryPageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setFormCategories(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    useFetchEffect(
        () => OrgUnitApi.getOrgUnitTree(),
        [],
        (result) => setOrgUnitTree(result),
        t("loadOrgUnitTreeError"),
        (message) => toast.error(message)
    );

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openCreateForm = () => {
        setFormMode("create");
        setEditingItem(null);
        setFormOpen(true);
    };

    const openEditForm = (item: FormCategoryDto) => {
        setFormMode("edit");
        setEditingItem(item);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingItem(null);
    };

    const handleSubmitForm = async (values: FormCategoryFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await FormCategoryApi.createFormCategory(values);
                toast.success(t("createSuccess"));
            } else if (editingItem) {
                await FormCategoryApi.updateFormCategory(editingItem.id, values);
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingItem(null);
            await fetchFormCategories();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? t("createError") : t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingItem) return;
        setIsDeleting(true);
        try {
            await FormCategoryApi.deleteFormCategory(deletingItem.id);
            toast.success(t("deleteSuccess"));
            setDeletingItem(null);
            await fetchFormCategories();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteError")));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">{t("description")}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => fetchFormCategories()}
                        disabled={isLoading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> {tCommon("refresh")}
                    </button>
                    {canManage && (
                        <button
                            onClick={openCreateForm}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            + {tCommon("add")}
                        </button>
                    )}
                </div>
            </div>

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
                            className="cursor-pointer h-10 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            {tCommon("search")}
                        </button>
                    </div>
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: formCategories.length, total: totalCount })}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">{t("colCode")}</th>
                                <th className="px-6 py-3">{t("colNameVn")}</th>
                                <th className="px-6 py-3">{t("colOrgUnit")}</th>
                                <th className="px-6 py-3 text-right">{tCommon("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && <TableSkeletonRows rows={5} columns={4} />}
                            {!isLoading && formCategories.length === 0 && (
                                <tr>
                                    <td colSpan={4}>
                                        <EmptyState icon={FolderKanban} title={t("noData")} />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && formCategories.map((item) => (
                                <tr key={item.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{item.code}</td>
                                    <td className="px-6 py-4 text-sm text-[#191c1e]">{item.nameVn}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{item.orgUnitNameVn || "—"}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => setCoordinatorsItem(item)}
                                                className="flex cursor-pointer items-center gap-1 font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                            >
                                                <Users className="h-3.5 w-3.5" /> {t("coordinatorsButton")}
                                            </button>
                                            {canManage && (
                                                <>
                                                    <button
                                                        onClick={() => openEditForm(item)}
                                                        className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                    >
                                                        {tCommon("edit")}
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingItem(item)}
                                                        className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#e3000f]"
                                                    >
                                                        {tCommon("delete")}
                                                    </button>
                                                </>
                                            )}
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

            <FormCategoryForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingItem}
                orgUnitTree={orgUnitTree}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            {coordinatorsItem && (
                <FormCategoryCoordinatorsDialog formCategory={coordinatorsItem} onClose={() => setCoordinatorsItem(null)} />
            )}

            <ConfirmDialog
                isOpen={deletingItem !== null}
                title={t("deleteTitle")}
                message={t.rich("deleteMessage", {
                    name: deletingItem?.nameVn ?? "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingItem(null);
                }}
            />
        </div>
    );
}
