"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Inbox, Search, Pencil, Trash2 } from "lucide-react";

import { ProductionCatalogApi } from "@/modules/attendance/api/production-catalog.api";
import { ProductionEmployeeApi } from "@/modules/attendance/api/production-employee.api";
import type {
    ProductionCatalogItemDto,
    ProductionCatalogKind,
    SaveProductionCatalogItemDto,
} from "@/modules/attendance/types/production-catalog.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import ProductionCatalogForm from "./ProductionCatalogForm";

const PAGE_SIZE = 10;

interface ProductionCatalogListProps extends ListToolbarProps {
    kind: ProductionCatalogKind;
}

const ProductionCatalogList = forwardRef<ListHandle, ProductionCatalogListProps>(function ProductionCatalogList({ kind, onLoadingChange }, ref) {
    const t = useTranslations("Attendance.ProductionCatalog");
    const tCommon = useTranslations("Common");
    const kindLabel = { Line: t("kindLine"), Team: t("kindTeam"), ShiftTeam: t("kindShiftTeam") }[kind];
    const isLine = kind === "Line";

    const [items, setItems] = useState<ProductionCatalogItemDto[]>([]);
    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");
    const [teamFilter, setTeamFilter] = useState<number | "">("");
    const [teamOptions, setTeamOptions] = useState<SelectOption[]>([]);

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<ProductionCatalogItemDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deleting, setDeleting] = useState<ProductionCatalogItemDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            ProductionCatalogApi.getPage(kind, {
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
                teamId: teamFilter === "" ? undefined : teamFilter,
            }),
        [kind, pageIndex, appliedKeyword, teamFilter],
        (result) => {
            setItems(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("loadError", { kind: kindLabel }),
        (message) => toast.error(message),
        "production-catalog"
    );

    useEffect(() => {
        if (!isLine) return;
        ProductionEmployeeApi.getTeamOptions()
            .then((data) => setTeamOptions(data.map((team) => ({ value: team.id, label: team.code, searchText: team.code.toLowerCase() }))))
            .catch((err) => console.error(err));
    }, [isLine]);

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openForm = (item: ProductionCatalogItemDto | null) => {
        setEditing(item);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: refetch,
        openCreate: () => openForm(null),
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const closeForm = () => {
        if (!isSaving) setFormOpen(false);
    };

    const handleSubmit = async (values: SaveProductionCatalogItemDto) => {
        setIsSaving(true);
        try {
            if (editing) {
                await ProductionCatalogApi.update(kind, editing.id, values);
                toast.success(t("updateSuccess", { kind: kindLabel }));
            } else {
                await ProductionCatalogApi.create(kind, values);
                toast.success(t("createSuccess", { kind: kindLabel }));
            }
            setFormOpen(false);
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, editing ? t("updateError", { kind: kindLabel }) : t("createError", { kind: kindLabel })));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleting) return;
        setIsDeleting(true);
        try {
            await ProductionCatalogApi.remove(kind, deleting.id);
            toast.success(t("deleteSuccess", { kind: kindLabel }));
            setDeleting(null);
            await refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteError", { kind: kindLabel })));
        } finally {
            setIsDeleting(false);
        }
    };

    const columnCount = isLine ? 5 : 4;

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-wrap gap-2 border-b border-[#e0e3e5] bg-[#f8fafc] p-3">
                    <input
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                        placeholder={t("searchPlaceholder")}
                        className="h-9 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    {isLine && (
                        <SearchableSelect
                            options={teamOptions}
                            value={teamFilter}
                            onChange={(value) => {
                                setPageIndex(1);
                                setTeamFilter(value);
                            }}
                            placeholder={t("allTeams")}
                            triggerClassName="h-9 w-40 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    )}
                    <button
                        onClick={handleSearch}
                        disabled={isLoading}
                        title={tCommon("search")}
                        aria-label={tCommon("search")}
                        className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <Search className="h-4 w-4" />
                    </button>
                </div>

                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-3 py-2">{t("colCode")}</th>
                                {isLine ? (
                                    <>
                                        <th className="px-3 py-2">{t("colTeam")}</th>
                                        <th className="px-3 py-2">{t("colCongDoan")}</th>
                                    </>
                                ) : (
                                    <th className="px-3 py-2">{t("colName")}</th>
                                )}
                                <th className="px-3 py-2 text-right">{t("colEmployees")}</th>
                                <th className="px-3 py-2 text-right">{tCommon("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && items.length === 0 && (
                                <tr>
                                    <td colSpan={columnCount} className="px-4 py-12">
                                        <div className="flex flex-col items-center gap-2 text-center text-sm text-[#5e3f3a]">
                                            <Inbox className="h-8 w-8 text-[#c7ccd1]" />
                                            {t("noData")}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {items.map((item) => (
                                <tr key={item.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{item.code}</td>
                                    {isLine ? (
                                        <>
                                            <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.teamCode}</td>
                                            <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.congDoan || "-"}</td>
                                        </>
                                    ) : (
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.nameVn || "-"}</td>
                                    )}
                                    <td className="px-3 py-2 text-right text-sm text-[#5e3f3a]">{item.employeeCount}</td>
                                    <td className="px-3 py-2 text-right text-sm">
                                        <div className="inline-flex items-center gap-1.5">
                                            <button
                                                onClick={() => openForm(item)}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                title={tCommon("edit")}
                                                aria-label={tCommon("edit")}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeleting(item)}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#e9bcb6] text-[#930006] transition hover:bg-[#fff4f2]"
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

                <Pagination
                    pageIndex={pageIndex}
                    totalPages={totalPages}
                    onPageChange={setPageIndex}
                    disabled={isLoading}
                    summary={isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: items.length, total: totalCount })}
                    compactSummary={totalCount}
                />
            </section>

            <ProductionCatalogForm
                kind={kind}
                kindLabel={kindLabel}
                isOpen={formOpen}
                mode={editing ? "edit" : "create"}
                initial={editing}
                teamOptions={teamOptions}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmit}
            />

            <ConfirmDialog
                isOpen={deleting !== null}
                title={t("deleteTitle", { kind: kindLabel })}
                message={t.rich("deleteMessage", { name: deleting?.code ?? "", b: (chunks) => <strong>{chunks}</strong> })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeleting(null);
                }}
            />
        </div>
    );
});

export default ProductionCatalogList;
