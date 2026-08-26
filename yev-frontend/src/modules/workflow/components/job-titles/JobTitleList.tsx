"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { JobTitleApi } from "@/modules/workflow/api/job-title.api";
import type { JobTitleDto } from "@/modules/workflow/types/job-title.dto";
import JobTitleForm, { type JobTitleFormValues } from "./JobTitleForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

const PAGE_SIZE = 10;

export default function JobTitleList() {
    const t = useTranslations("Workflow.JobTitle");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    const canManage = hasPermission(user, "Workflow.Organization.Manage");

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
    const [editingItem, setEditingItem] = useState<JobTitleDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingItem, setDeletingItem] = useState<JobTitleDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchJobTitles } = useFetchEffect(
        () => JobTitleApi.getJobTitlePageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setJobTitles(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
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

    const openEditForm = (item: JobTitleDto) => {
        setFormMode("edit");
        setEditingItem(item);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingItem(null);
    };

    const handleSubmitForm = async (values: JobTitleFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await JobTitleApi.createJobTitle(values);
                toast.success(t("createSuccess"));
            } else if (editingItem) {
                await JobTitleApi.updateJobTitle(editingItem.id, values);
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingItem(null);
            await fetchJobTitles();
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
            await JobTitleApi.deleteJobTitle(deletingItem.id);
            toast.success(t("deleteSuccess"));
            setDeletingItem(null);
            await fetchJobTitles();
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
                        onClick={() => fetchJobTitles()}
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
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: jobTitles.length, total: totalCount })}
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
                                <th className="px-6 py-3">{t("colNameJp")}</th>
                                <th className="px-6 py-3">{t("colRankOrder")}</th>
                                <th className="px-6 py-3">{t("colIsUniquePerOrgUnit")}</th>
                                {canManage && <th className="px-6 py-3 text-right">{tCommon("actions")}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && jobTitles.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        {t("noData")}
                                    </td>
                                </tr>
                            )}
                            {jobTitles.map((item) => (
                                <tr key={item.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{item.code}</td>
                                    <td className="px-6 py-4 text-sm text-[#191c1e]">{item.nameVn}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{item.nameJp || "—"}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{item.rankOrder}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                item.isUniquePerOrgUnit ? "bg-[#e8f0fe] text-[#1a56db]" : "bg-[#f2f4f6] text-[#5e3f3a]"
                                            }`}
                                        >
                                            {item.isUniquePerOrgUnit ? t("uniqueYes") : t("uniqueNo")}
                                        </span>
                                    </td>
                                    {canManage && (
                                        <td className="px-6 py-4 text-right text-sm">
                                            <div className="inline-flex items-center gap-3">
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
        </div>
    );
}
