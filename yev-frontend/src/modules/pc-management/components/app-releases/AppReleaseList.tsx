"use client";

import { useState } from "react";
import {
    Copy,
    Download,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    ShieldAlert,
    Smartphone,
    Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { AppReleaseApi } from "@/modules/pc-management/api/app-release.api";
import type { AppReleaseDto } from "@/modules/pc-management/types/app-release.dto";
import AppReleaseForm, { type AppReleaseFormValues } from "./AppReleaseForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";

const PAGE_SIZE = 10;

const labelClassName = "text-xs font-semibold uppercase tracking-[0.1em] text-[#6b7075]";
const outlineButtonClassName =
    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-xs font-semibold text-[#191c1e] transition hover:bg-[#e6e9ec] disabled:cursor-not-allowed disabled:opacity-50";
const iconButtonClassName =
    "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#5e3f3a] transition hover:bg-[#e6e9ec] hover:text-[#191c1e]";
const dangerIconButtonClassName =
    "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#930006] transition hover:bg-[#fff4f2]";

function LatestBadge({ label }: { label: string }) {
    return (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#e6f4ea] px-2.5 py-1 text-xs font-semibold text-[#1e7a34]">
            <span className="size-1.5 shrink-0 rounded-full bg-current" />
            {label}
        </span>
    );
}

// Manages releases of the Flutter "YEV Scan" app (asset-module.md §1.23). The newest release is the one
// the app receives from GET /latest, so it gets its own card; older ones are listed below. Add/edit/delete
// are gated by Asset.AppRelease.Manage (BE enforces it again, FE only hides the UI).
export default function AppReleaseList() {
    const t = useTranslations("Asset.AppRelease");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    const canManage = hasPermission(user, "Asset.AppRelease.Manage");

    // undefined = not loaded yet, null = no release exists.
    const [latest, setLatest] = useState<AppReleaseDto | null | undefined>(undefined);
    const [releases, setReleases] = useState<AppReleaseDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingRelease, setEditingRelease] = useState<AppReleaseDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingRelease, setDeletingRelease] = useState<AppReleaseDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading: isLoadingLatest, error: latestError, refetch: fetchLatest } = useFetchEffect(
        () => AppReleaseApi.getLatest(),
        [],
        (result) => setLatest(result),
        t("loadError")
    );

    const { isLoading: isLoadingList, error, refetch: fetchReleases } = useFetchEffect(
        () => AppReleaseApi.getAppReleasePageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setReleases(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    const isLoading = isLoadingLatest || isLoadingList;
    const isInitialLoading = latest === undefined && isLoading;
    const refetchAll = () => Promise.all([fetchLatest(), fetchReleases()]);

    // The newest release lives in its own card, so it is left out of the history list (BE orders by
    // versionCode desc, which puts it first on page 1 when no keyword is applied).
    const history = releases.filter((release) => release.id !== latest?.id);
    const hiddenLatest = !appliedKeyword && latest && history.length < releases.length ? 1 : 0;
    const historyTotal = totalCount - hiddenLatest;
    const rangeFrom = history.length === 0 ? 0 : (pageIndex - 1) * PAGE_SIZE + 1 - (pageIndex > 1 ? hiddenLatest : 0);
    const rangeTo = history.length === 0 ? 0 : rangeFrom + history.length - 1;

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
            await refetchAll();
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
            await refetchAll();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteError")));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCopyLink = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            toast.success(t("copySuccess"));
        } catch {
            toast.error(t("copyError"));
        }
    };

    const forceUpdateRule = (release: AppReleaseDto) =>
        t.rich("forceUpdateRule", { min: release.minVersionCode, b: (chunks) => <b className="font-semibold">{chunks}</b> });

    const renderRowActions = (release: AppReleaseDto) => (
        <div className="flex shrink-0 items-center gap-0.5">
            <a
                href={release.apkUrl}
                target="_blank"
                rel="noreferrer"
                title={t("downloadApk")}
                aria-label={`${t("downloadApk")} ${release.versionName}`}
                className={iconButtonClassName}
            >
                <Download className="size-4" />
            </a>
            {canManage && (
                <>
                    <button
                        type="button"
                        onClick={() => openEditForm(release)}
                        title={tCommon("edit")}
                        aria-label={`${tCommon("edit")} ${release.versionName}`}
                        className={iconButtonClassName}
                    >
                        <Pencil className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setDeletingRelease(release)}
                        title={tCommon("delete")}
                        aria-label={`${tCommon("delete")} ${release.versionName}`}
                        className={dangerIconButtonClassName}
                    >
                        <Trash2 className="size-4" />
                    </button>
                </>
            )}
        </div>
    );

    const renderLatestCard = (release: AppReleaseDto) => {
        const changelogLines = release.changelog?.split("\n").filter((line) => line.trim() !== "") ?? [];
        return (
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#fff4f2] text-[#e3000f]">
                            <Smartphone className="size-6" />
                        </span>
                        <div className="min-w-0">
                            <p className={labelClassName}>{t("labelServing")}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                <h2 className="min-w-0 break-words text-2xl font-semibold text-[#191c1e]">{release.versionName}</h2>
                                <LatestBadge label={t("badgeLatest")} />
                            </div>
                            <p className="mt-0.5 text-sm text-[#5e3f3a]">{t("versionCodeLabel", { code: release.versionCode })}</p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <a href={release.apkUrl} target="_blank" rel="noreferrer" className={outlineButtonClassName}>
                            <Download className="size-3.5" /> {t("downloadApk")}
                        </a>
                        {canManage && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => openEditForm(release)}
                                    title={tCommon("edit")}
                                    aria-label={`${tCommon("edit")} ${release.versionName}`}
                                    className={`${iconButtonClassName} border border-[#e0e3e5]`}
                                >
                                    <Pencil className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDeletingRelease(release)}
                                    title={tCommon("delete")}
                                    aria-label={`${tCommon("delete")} ${release.versionName}`}
                                    className={`${dangerIconButtonClassName} border border-[#e9bcb6]`}
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 divide-y divide-[#f1f5f9] border-t border-[#f1f5f9] md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:divide-x md:divide-y-0">
                    <div className="min-w-0 p-5">
                        <p className={labelClassName}>{t("labelChangelog")}</p>
                        <div className="mt-2">
                            {changelogLines.length > 0 ? (
                                <ul className="list-disc space-y-1 pl-4 text-sm leading-5 text-[#191c1e] marker:text-[#6b7075]">
                                    {changelogLines.map((line, index) => (
                                        <li key={index}>{line}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-[#6b7075]">{t("noChangelog")}</p>
                            )}
                        </div>
                    </div>
                    <div className="min-w-0 space-y-4 p-5">
                        <div>
                            <p className={labelClassName}>{t("labelForceUpdate")}</p>
                            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-[#191c1e]">
                                <ShieldAlert className="size-4 shrink-0 text-[#8a5a00]" />
                                <span>{forceUpdateRule(release)}</span>
                            </p>
                        </div>
                        <div>
                            <p className={labelClassName}>{t("labelApkUrl")}</p>
                            <div className="mt-1.5 flex h-9 items-center gap-1 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] pl-3 pr-1">
                                <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#5e3f3a]" title={release.apkUrl}>
                                    {release.apkUrl}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleCopyLink(release.apkUrl)}
                                    title={t("copyLink")}
                                    aria-label={t("copyLink")}
                                    className={`${iconButtonClassName} size-7`}
                                >
                                    <Copy className="size-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    };

    const renderHistoryRow = (release: AppReleaseDto) => (
        <li key={release.id} className="flex items-start gap-3 px-4 py-3 transition hover:bg-[#f2f4f6]">
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="min-w-0 truncate text-sm font-semibold text-[#191c1e]" title={release.versionName}>
                        {release.versionName}
                    </span>
                    <span className="text-xs text-[#6b7075]">
                        {t("historyMeta", { code: release.versionCode, min: release.minVersionCode })}
                    </span>
                </div>
                {release.changelog ? (
                    <p className="mt-1 line-clamp-2 text-sm text-[#5e3f3a]">{release.changelog.split("\n").join(" · ")}</p>
                ) : (
                    <p className="mt-1 text-sm text-[#6b7075]">{t("noChangelog")}</p>
                )}
            </div>
            {renderRowActions(release)}
        </li>
    );

    const renderPager = () => (
        <Pagination
            pageIndex={pageIndex}
            totalPages={totalPages}
            onPageChange={setPageIndex}
            disabled={isLoading}
            summary={t("rangeLabel", { from: rangeFrom, to: rangeTo, total: historyTotal })}
            compactSummary={historyTotal}
        />
    );

    const renderSkeleton = () => (
        <>
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                <div className="flex gap-4">
                    <Skeleton className="size-12 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-7 w-24" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                </div>
                <div className="mt-5 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </section>
            <section className="divide-y divide-[#f1f5f9] overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                {[0, 1, 2, 3, 4].map((index) => (
                    <div key={index} className="space-y-2 px-4 py-3">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-3/4" />
                    </div>
                ))}
            </section>
        </>
    );

    const showHistory = history.length > 0 || appliedKeyword !== "" || latest !== null;
    const isEmpty = latest === null && history.length === 0 && appliedKeyword === "" && !isLoading;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h1 className="text-lg font-semibold text-[#191c1e]">{t("title")}</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => refetchAll()} disabled={isLoading} className={outlineButtonClassName}>
                        <RefreshCw className="size-3.5" /> {tCommon("refresh")}
                    </button>
                    {canManage && (
                        <button
                            type="button"
                            onClick={openCreateForm}
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-3 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            <Plus className="size-3.5" /> {t("publishNew")}
                        </button>
                    )}
                </div>
            </div>

            {(error ?? latestError) && (
                <div role="alert" className="rounded-xl border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                    {error ?? latestError}
                </div>
            )}

            {isInitialLoading ? (
                renderSkeleton()
            ) : isEmpty ? (
                <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                    <p className="py-6 text-center text-sm text-[#5e3f3a]">{t("noData")}</p>
                </section>
            ) : (
                <>
                    {latest && renderLatestCard(latest)}

                    {showHistory && (
                        <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                            <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                                <h3 className="text-sm font-semibold text-[#191c1e]">{t("historyTitle")}</h3>
                                <div className="flex gap-2">
                                    <input
                                        value={keyword}
                                        onChange={(event) => setKeyword(event.target.value)}
                                        onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                                        placeholder={t("searchPlaceholder")}
                                        className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition placeholder:text-[#6b7075] focus:border-[#e3000f] focus:ring-2 focus:ring-[#e3000f]/15 md:w-64"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSearch}
                                        disabled={isLoading}
                                        title={tCommon("search")}
                                        aria-label={tCommon("search")}
                                        className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#e6e9ec] disabled:opacity-50"
                                    >
                                        <Search className="size-4" />
                                    </button>
                                </div>
                            </div>

                            {history.length === 0 ? (
                                <p className="py-6 text-center text-sm text-[#5e3f3a]">{t("noMatch")}</p>
                            ) : (
                                <>
                                    <ul className={`divide-y divide-[#f1f5f9] transition-opacity ${isLoadingList ? "opacity-60" : ""}`}>
                                        {history.map(renderHistoryRow)}
                                    </ul>
                                    {renderPager()}
                                </>
                            )}
                        </section>
                    )}
                </>
            )}

            {canManage && (
                <AppReleaseForm
                    isOpen={formOpen}
                    mode={formMode}
                    initial={editingRelease}
                    latestVersionCode={latest?.versionCode ?? null}
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
