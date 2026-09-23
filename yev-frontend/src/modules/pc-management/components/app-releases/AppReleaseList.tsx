"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { AppReleaseApi } from "@/modules/pc-management/api/app-release.api";
import type { AppReleaseDto } from "@/modules/pc-management/types/app-release.dto";
import AppReleaseForm, { type AppReleaseFormValues } from "./AppReleaseForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";

const PAGE_SIZE = 10;

// Quản lý bản cập nhật app Flutter "YEV Scan" (asset-module.md §1.23) — khuôn CRUD giống
// components/branches/ nhưng nút Thêm/Sửa/Xoá gate theo quyền Asset.AppRelease.Manage (BE vẫn luôn
// enforce lại, FE chỉ ẩn/hiện UI).
export default function AppReleaseList() {
    const t = useTranslations("Asset.AppRelease");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    const canManage = hasPermission(user, "Asset.AppRelease.Manage");

    const [releases, setReleases] = useState<AppReleaseDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingRelease, setEditingRelease] = useState<AppReleaseDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingRelease, setDeletingRelease] = useState<AppReleaseDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchReleases } = useFetchEffect(
        () => AppReleaseApi.getAppReleasePageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setReleases(result.data);
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
        setEditingRelease(null);
        setFormOpen(true);
    };

    const openEditForm = (release: AppReleaseDto) => {
        setFormMode("edit");
        setEditingRelease(release);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingRelease(null);
    };

    const handleSubmitForm = async (values: AppReleaseFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await AppReleaseApi.createAppRelease(values);
                toast.success(t("createSuccess"));
            } else if (editingRelease) {
                await AppReleaseApi.updateAppRelease(editingRelease.id, values);
                toast.success(t("updateSuccess"));
            }
            setFormOpen(false);
            setEditingRelease(null);
            await fetchReleases();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? t("createError") : t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingRelease) return;
        setIsDeleting(true);
        try {
            await AppReleaseApi.deleteAppRelease(deletingRelease.id);
            toast.success(t("deleteSuccess"));
            setDeletingRelease(null);
            await fetchReleases();
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
                        onClick={() => fetchReleases()}
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
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: releases.length, total: totalCount })}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">{t("colVersionCode")}</th>
                                <th className="px-6 py-3">{t("colVersionName")}</th>
                                <th className="px-6 py-3">{t("colMinVersionCode")}</th>
                                <th className="px-6 py-3">{t("colApkUrl")}</th>
                                <th className="px-6 py-3">{t("colChangelog")}</th>
                                {canManage && <th className="px-6 py-3 text-right">{tCommon("actions")}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && releases.length === 0 && (
                                <tr>
                                    <td colSpan={canManage ? 6 : 5} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        {t("noData")}
                                    </td>
                                </tr>
                            )}
                            {releases.map((release) => (
                                <tr key={release.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{release.versionCode}</td>
                                    <td className="px-6 py-4 text-sm text-[#191c1e]">{release.versionName}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{release.minVersionCode}</td>
                                    <td className="max-w-[16rem] truncate px-6 py-4 text-sm text-[#5e3f3a]" title={release.apkUrl}>
                                        <a href={release.apkUrl} target="_blank" rel="noreferrer" className="text-[#e3000f] hover:underline">
                                            {release.apkUrl}
                                        </a>
                                    </td>
                                    <td className="max-w-[20rem] truncate px-6 py-4 text-sm text-[#5e3f3a]" title={release.changelog ?? undefined}>
                                        {release.changelog ?? "—"}
                                    </td>
                                    {canManage && (
                                        <td className="px-6 py-4 text-right text-sm">
                                            <div className="inline-flex items-center gap-3">
                                                <button
                                                    onClick={() => openEditForm(release)}
                                                    className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                    title={tCommon("edit")}
                                                >
                                                    {tCommon("edit")}
                                                </button>
                                                <button
                                                    onClick={() => setDeletingRelease(release)}
                                                    className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#e3000f]"
                                                    title={tCommon("delete")}
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

            {canManage && (
                <AppReleaseForm
                    isOpen={formOpen}
                    mode={formMode}
                    initial={editingRelease}
                    loading={isSaving}
                    onClose={closeForm}
                    onSubmit={handleSubmitForm}
                />
            )}

            <ConfirmDialog
                isOpen={deletingRelease !== null}
                title={t("deleteTitle")}
                message={t.rich("deleteMessage", {
                    name: deletingRelease?.versionName ?? "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingRelease(null);
                }}
            />
        </div>
    );
}
