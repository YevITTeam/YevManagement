"use client";

import { useState } from "react";
import { RefreshCw, Layers } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { OrgLevelApi } from "@/modules/workflow/api/org-level.api";
import type { OrgLevelDto } from "@/modules/workflow/types/org-level.dto";
import OrgLevelForm, { type OrgLevelFormValues } from "./OrgLevelForm";
import OrgLevelJobTitleSuggestionsDialog from "./OrgLevelJobTitleSuggestionsDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeletonRows } from "@/components/common/TableSkeletonRows";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

export default function OrgLevelList() {
    const t = useTranslations("Workflow.OrgLevel");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    const canManage = hasPermission(user, "Workflow.Organization.Manage");

    const [orgLevels, setOrgLevels] = useState<OrgLevelDto[]>([]);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingItem, setEditingItem] = useState<OrgLevelDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingItem, setDeletingItem] = useState<OrgLevelDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [suggestionsFor, setSuggestionsFor] = useState<OrgLevelDto | null>(null);

    const { isLoading, error, refetch: fetchOrgLevels } = useFetchEffect(
        () => OrgLevelApi.getAllOrgLevels(),
        [],
        (result) => setOrgLevels(result),
        t("loadError"),
        (message) => toast.error(message)
    );

    const openCreateForm = () => {
        setFormMode("create");
        setEditingItem(null);
        setFormOpen(true);
    };

    const openEditForm = (item: OrgLevelDto) => {
        setFormMode("edit");
        setEditingItem(item);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingItem(null);
    };

    const handleSubmitForm = async (values: OrgLevelFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await OrgLevelApi.createOrgLevel(values);
                toast.success(t("createSuccess"));
            } else if (editingItem) {
                await OrgLevelApi.updateOrgLevel(editingItem.id, values);
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingItem(null);
            await fetchOrgLevels();
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
            await OrgLevelApi.deleteOrgLevel(deletingItem.id);
            toast.success(t("deleteSuccess"));
            setDeletingItem(null);
            await fetchOrgLevels();
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
                        onClick={() => fetchOrgLevels()}
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
                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">{t("colLevelNumber")}</th>
                                <th className="px-6 py-3">{t("colNameVn")}</th>
                                <th className="px-6 py-3">{t("colNameJp")}</th>
                                {canManage && <th className="px-6 py-3 text-right">{tCommon("actions")}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && <TableSkeletonRows rows={5} columns={canManage ? 4 : 3} />}
                            {!isLoading && orgLevels.length === 0 && (
                                <tr>
                                    <td colSpan={canManage ? 4 : 3}>
                                        <EmptyState icon={Layers} title={t("noData")} />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && orgLevels.map((item) => (
                                <tr key={item.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{item.levelNumber}</td>
                                    <td className="px-6 py-4 text-sm text-[#191c1e]">{item.nameVn}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{item.nameJp || "—"}</td>
                                    {canManage && (
                                        <td className="px-6 py-4 text-right text-sm">
                                            <div className="inline-flex items-center gap-3">
                                                <button
                                                    onClick={() => setSuggestionsFor(item)}
                                                    className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                >
                                                    {t("jobTitleSuggestionsButton")}
                                                </button>
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
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <OrgLevelForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingItem}
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

            {suggestionsFor && (
                <OrgLevelJobTitleSuggestionsDialog orgLevel={suggestionsFor} onClose={() => setSuggestionsFor(null)} />
            )}
        </div>
    );
}
