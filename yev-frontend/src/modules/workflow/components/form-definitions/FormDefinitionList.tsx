"use client";

import { useState } from "react";
import { RefreshCw, LayoutGrid, Inbox, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useRouter } from "@/navigation";

import { FormDefinitionApi } from "@/modules/workflow/api/form-definition.api";
import { FormCategoryApi } from "@/modules/workflow/api/form-category.api";
import type { FormDefinitionDto } from "@/modules/workflow/types/form-definition.dto";
import type { FormCategoryDto } from "@/modules/workflow/types/form-category.dto";
import FormDefinitionForm, { type FormDefinitionFormValues } from "./FormDefinitionForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeletonRows } from "@/components/common/TableSkeletonRows";
import { Badge } from "@/components/ui/Badge";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

const PAGE_SIZE = 10;

export default function FormDefinitionList() {
    const t = useTranslations("Workflow.FormDefinition");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    const canManage = hasPermission(user, "Workflow.FormDesign.Manage");
    const router = useRouter();

    const [formDefinitions, setFormDefinitions] = useState<FormDefinitionDto[]>([]);
    const [formCategories, setFormCategories] = useState<FormCategoryDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingItem, setEditingItem] = useState<FormDefinitionDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingItem, setDeletingItem] = useState<FormDefinitionDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchFormDefinitions } = useFetchEffect(
        () => FormDefinitionApi.getFormDefinitionPageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setFormDefinitions(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    useFetchEffect(
        () => FormCategoryApi.getAllFormCategories(),
        [],
        (result) => setFormCategories(result),
        t("loadFormCategoriesError"),
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

    const openEditForm = (item: FormDefinitionDto) => {
        setFormMode("edit");
        setEditingItem(item);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingItem(null);
    };

    const handleSubmitForm = async (values: FormDefinitionFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await FormDefinitionApi.createFormDefinition(values);
                toast.success(t("createSuccess"));
            } else if (editingItem) {
                // routeConditionType is immutable after creation and not part of the update DTO.
                await FormDefinitionApi.updateFormDefinition(editingItem.id, {
                    code: values.code,
                    nameVn: values.nameVn,
                    nameJp: values.nameJp,
                    formCategoryId: values.formCategoryId,
                    description: values.description,
                    allowAttachment: values.allowAttachment,
                    requireAttachment: values.requireAttachment,
                    codePrefix: values.codePrefix,
                    routeNumericFieldKey: values.routeNumericFieldKey,
                    routeClassFieldKey: values.routeClassFieldKey,
                });
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingItem(null);
            await fetchFormDefinitions();
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
            await FormDefinitionApi.deleteFormDefinition(deletingItem.id);
            toast.success(t("deleteSuccess"));
            setDeletingItem(null);
            await fetchFormDefinitions();
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
                        onClick={() => fetchFormDefinitions()}
                        disabled={isLoading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> {tCommon("refresh")}
                    </button>
                    {canManage && (
                        <button
                            onClick={openCreateForm}
                            disabled={formCategories.length === 0}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            + {tCommon("add")}
                        </button>
                    )}
                </div>
            </div>

            {canManage && formCategories.length === 0 && !isLoading && (
                <div className="rounded-lg border border-[#f5d0a9] bg-[#fff8ee] px-4 py-3 text-sm text-[#8a5a00]">
                    {t("noFormCategoryWarning")}
                </div>
            )}

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
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: formDefinitions.length, total: totalCount })}
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
                                <th className="px-6 py-3">{t("colFormCategory")}</th>
                                <th className="px-6 py-3">{t("colVersion")}</th>
                                <th className="px-6 py-3">{t("colStatus")}</th>
                                {canManage && <th className="px-6 py-3 text-right">{tCommon("actions")}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && <TableSkeletonRows rows={5} columns={canManage ? 6 : 5} />}
                            {!isLoading && formDefinitions.length === 0 && (
                                <tr>
                                    <td colSpan={canManage ? 6 : 5}>
                                        <EmptyState icon={Inbox} title={t("noData")} />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && formDefinitions.map((item) => (
                                <tr key={item.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{item.code}</td>
                                    <td className="px-6 py-4 text-sm text-[#191c1e]">{item.nameVn}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{item.formCategoryNameVn}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">v{item.version}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <Badge variant={item.isPublished ? "success" : "neutral"} withDot>
                                            {item.isPublished ? t("statusPublished") : t("statusDraft")}
                                        </Badge>
                                    </td>
                                    {canManage && (
                                        <td className="px-6 py-4 text-right text-sm">
                                            <div className="inline-flex items-center gap-1.5">
                                                <button
                                                    onClick={() =>
                                                        router.push({ pathname: "/workflow/form-definitions/detail", query: { id: String(item.id) } })
                                                    }
                                                    className="flex cursor-pointer items-center gap-1 font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                >
                                                    <LayoutGrid className="h-3.5 w-3.5" /> {t("designButton")}
                                                </button>
                                                <button
                                                    onClick={() => openEditForm(item)}
                                                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-40"
                                                    title={tCommon("edit")}
                                                    aria-label={tCommon("edit")}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setDeletingItem(item)}
                                                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#e9bcb6] text-[#930006] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-40"
                                                    title={tCommon("delete")}
                                                    aria-label={tCommon("delete")}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    )}
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

            <FormDefinitionForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingItem}
                formCategories={formCategories}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

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
