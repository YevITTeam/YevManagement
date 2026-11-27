"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";

import { ProductionCatalogApi } from "@/modules/attendance/api/production-catalog.api";
import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
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
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";
import { ErrorBar, FilterActions, IconButton, ListToolbar, SearchField, TableStatusRows, fieldClassName, theadRowClassName } from "@/components/ui/ListToolbar";

const PAGE_SIZE = 10;

interface ProductionCatalogListProps extends ListToolbarProps {
    kind: ProductionCatalogKind;
}

const ProductionCatalogList = forwardRef<ListHandle, ProductionCatalogListProps>(function ProductionCatalogList({ kind, onLoadingChange }, ref) {
    const t = useTranslations("Attendance.ProductionCatalog");
    const tCommon = useTranslations("Common");
    const kindLabel = { Line: t("kindLine"), Team: t("kindTeam"), ShiftTeam: t("kindShiftTeam"), Task: t("kindTask") }[kind];
    const isLine = kind === "Line";
    const isTask = kind === "Task";
    const hasWorkshop = kind !== "ShiftTeam";

    const [items, setItems] = useState<ProductionCatalogItemDto[]>([]);
    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");
    const [teamFilter, setTeamFilter] = useState<number | "">("");
    const [workshopFilter, setWorkshopFilter] = useState<number | "">("");
    const [teams, setTeams] = useState<ProductionCatalogItemDto[]>([]);
    const [workshopOptions, setWorkshopOptions] = useState<SelectOption[]>([]);

    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = usePersistedState("page-size:attendance/components/production-catalogs/ProductionCatalogList", PAGE_SIZE);
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
                pageSize,
                keyword: appliedKeyword || undefined,
                teamId: teamFilter === "" ? undefined : teamFilter,
                workshopId: workshopFilter === "" ? undefined : workshopFilter,
            }),
        [kind, pageIndex, pageSize, appliedKeyword, teamFilter, workshopFilter],
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
        if (!hasWorkshop) return;
        WorkshopApi.getAllWorkshops()
            .then((list) => setWorkshopOptions(list.map((w) => ({ value: w.id, label: w.workshopCode, searchText: w.workshopCode.toLowerCase() }))))
            .catch((err) => console.error(err));
        if (!isLine) return;
        ProductionCatalogApi.getPage("Team", { pageIndex: 1, pageSize: 500 })
            .then((res) => setTeams(res.data))
            .catch((err) => console.error(err));
    }, [hasWorkshop, isLine]);

    const teamFilterOptions: SelectOption[] = teams
        .filter((team) => workshopFilter === "" || team.workshopId === workshopFilter)
        .map((team) => ({ value: team.id, label: `${team.workshopCode} · ${team.code}`, searchText: team.code.toLowerCase() }));

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

    const handleReset = () => {
        setPageIndex(1);
        setKeyword("");
        setAppliedKeyword("");
        setWorkshopFilter("");
        setTeamFilter("");
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

    // A filtered column only repeats the chosen value.
    const showWorkshop = hasWorkshop && workshopFilter === "";
    const showTeam = isLine && teamFilter === "";
    const columnCount = (showWorkshop ? 1 : 0) + (isLine ? 4 + (showTeam ? 1 : 0) : 2) + 2;

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <ListToolbar>
                    <SearchField value={keyword} onChange={setKeyword} onEnter={handleSearch} placeholder={t("searchPlaceholder")} />
                    {hasWorkshop && (
                        <SearchableSelect
                            options={workshopOptions}
                            value={workshopFilter}
                            onChange={(value) => {
                                setPageIndex(1);
                                setWorkshopFilter(value);
                                setTeamFilter("");
                            }}
                            placeholder={t("allWorkshops")}
                            ariaLabel={t("colWorkshop")}
                            triggerClassName={`${fieldClassName} w-36 pr-8`}
                        />
                    )}
                    {isLine && (
                        <SearchableSelect
                            options={teamFilterOptions}
                            value={teamFilter}
                            onChange={(value) => {
                                setPageIndex(1);
                                setTeamFilter(value);
                            }}
                            placeholder={t("allTeams")}
                            ariaLabel={t("colTeam")}
                            triggerClassName={`${fieldClassName} w-40 pr-8`}
                        />
                    )}
                    <FilterActions onSearch={handleSearch} onReset={handleReset} disabled={isLoading} />
                </ListToolbar>
                <ErrorBar message={error} />

                <TableScroll>
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className={theadRowClassName}>
                                {showWorkshop && <th className="px-3 py-2">{t("colWorkshop")}</th>}
                                <th className="px-3 py-2">{t("colCode")}</th>
                                {isLine ? (
                                    <>
                                        {showTeam && <th className="px-3 py-2">{t("colTeam")}</th>}
                                        <th className="px-3 py-2">{t("colCongDoan")}</th>
                                        <th className="px-3 py-2">{t("colCdMae")}</th>
                                        <th className="px-3 py-2">{t("colSortCode")}</th>
                                    </>
                                ) : isTask ? (
                                    <th className="px-3 py-2">TT/GT</th>
                                ) : (
                                    <th className="px-3 py-2">{t("colName")}</th>
                                )}
                                <th className="px-3 py-2 text-right">{t("colEmployees")}</th>
                                <th className="w-px px-3 py-2" aria-label={tCommon("actions")} />
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={items.length === 0} columns={columnCount} emptyText={t("noData")} />
                            {items.map((item) => (
                                <tr key={item.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    {showWorkshop && <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.workshopCode}</td>}
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{item.code}</td>
                                    {isLine ? (
                                        <>
                                            {showTeam && <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.teamCode || "-"}</td>}
                                            <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.congDoan || "-"}</td>
                                            <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.cdMae || "-"}</td>
                                            <td className="px-3 py-2 text-sm text-[#5e3f3a]">{item.sortCode || "-"}</td>
                                        </>
                                    ) : (
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{(isTask ? item.staffKind : item.nameVn) || "-"}</td>
                                    )}
                                    <td className="px-3 py-2 text-right text-sm text-[#5e3f3a]">{item.employeeCount}</td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <IconButton icon={Pencil} label={tCommon("edit")} onClick={() => openForm(item)} size="sm" variant="ghost" />
                                            <IconButton icon={Trash2} label={tCommon("delete")} onClick={() => setDeleting(item)} size="sm" variant="danger" />
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
                workshopOptions={workshopOptions}
                teams={teams}
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
