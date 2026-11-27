"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";

import { GroupApi } from "@/modules/attendance/api/group.api";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import GroupForm, { type GroupFormValues } from "./GroupForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Pagination } from "@/components/ui/Pagination";
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";
import { ErrorBar, FilterActions, IconButton, ListToolbar, SearchField, TableStatusRows, fieldClassName, theadRowClassName } from "@/components/ui/ListToolbar";

const PAGE_SIZE = 10;
const MAX_LINE_CHIPS = 3;

interface GroupPageResult {
    data: GroupDto[];
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    safePageIndex: number;
}

const GroupList = forwardRef<ListHandle, ListToolbarProps>(function GroupList({ onLoadingChange }, ref) {
    const t = useTranslations("Attendance.Group");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const [groups, setGroups] = useState<GroupDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [departmentFilter, setDepartmentFilter] = useState<string>("");
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);
    const [workshopFilter, setWorkshopFilter] = useState<string>("");

    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = usePersistedState("page-size:attendance/components/groups/GroupList", PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingGroup, setEditingGroup] = useState<GroupDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [pendingMerge, setPendingMerge] = useState<{ values: GroupFormValues; pairs: string[] } | null>(null);

    const [deletingGroup, setDeletingGroup] = useState<GroupDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // grid-list can't filter by department, so with a filter load by-department and paginate on the client.
    const { isLoading, error, refetch: fetchGroups } = useFetchEffect<GroupPageResult>(
        async () => {
            if (departmentFilter) {
                const all = await GroupApi.getGroupsByDepartment(Number(departmentFilter), workshopFilter ? Number(workshopFilter) : undefined);
                const filtered = appliedKeyword
                    ? all.filter(
                          (group) =>
                              group.groupCode.toLowerCase().includes(appliedKeyword.toLowerCase()) ||
                              group.groupNameVn.toLowerCase().includes(appliedKeyword.toLowerCase())
                      )
                    : all;
                const computedTotalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
                const safePageIndex = Math.min(pageIndex, computedTotalPages);
                const start = (safePageIndex - 1) * pageSize;
                return {
                    data: filtered.slice(start, start + pageSize),
                    totalCount: filtered.length,
                    totalPages: computedTotalPages,
                    hasPreviousPage: safePageIndex > 1,
                    hasNextPage: safePageIndex < computedTotalPages,
                    safePageIndex,
                };
            }
            const result = await GroupApi.getGroupPageNation({
                pageIndex,
                pageSize,
                keyword: appliedKeyword || undefined,
                workshopId: workshopFilter ? Number(workshopFilter) : undefined,
            });
            return { ...result, safePageIndex: pageIndex };
        },
        [pageIndex, pageSize, appliedKeyword, departmentFilter, workshopFilter],
        (result) => {
            setGroups(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            if (result.safePageIndex !== pageIndex) setPageIndex(result.safePageIndex);
        },
        t("loadError"),
        (message) => toast.error(message),
        "groups"
    );

    useEffect(() => {
        DepartmentApi.getAllDepartments()
            .then((data) => setDepartments(data))
            .catch((err) => console.error(err));
        WorkshopApi.getAllWorkshops()
            .then((data) => setWorkshops(data))
            .catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingGroup(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: fetchGroups,
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
        setWorkshopFilter("");
        setDepartmentFilter("");
    };

    const openEditForm = (group: GroupDto) => {
        setFormMode("edit");
        setEditingGroup(group);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingGroup(null);
    };

    // Pairs already owned by another group of the same workshop and department: saving them is a merge, so ask first.
    const findOwnedPairs = async (values: GroupFormValues) => {
        if (values.lines.length === 0) return [];
        const others = (await GroupApi.getAllGroups()).filter(
            (g) =>
                g.id !== editingGroup?.id &&
                g.workshopId === values.workshopId &&
                g.departmentId === values.departmentId
        );
        return others.flatMap((g) =>
            g.lines
                .filter((l) => values.lines.some((v) => v.productionLineId === l.productionLineId && v.shiftTeamId === l.shiftTeamId))
                .map((l) => `${l.lineCode} · ${l.shiftTeamCode} (${g.groupNameVn})`)
        );
    };

    const handleSubmitForm = async (values: GroupFormValues, takeOverLines = false) => {
        setIsSaving(true);
        try {
            if (!takeOverLines) {
                const pairs = await findOwnedPairs(values);
                if (pairs.length > 0) {
                    setPendingMerge({ values, pairs });
                    return;
                }
            }
            if (formMode === "create") {
                await GroupApi.createGroup({ ...values, takeOverLines });
                toast.success(t("createSuccess"));
            } else if (editingGroup) {
                await GroupApi.updateGroup(editingGroup.id, { ...values, takeOverLines });
                toast.success(t("updateSuccess"));
            }
            setPendingMerge(null);
            setFormOpen(false);
            setEditingGroup(null);
            await fetchGroups();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? t("createError") : t("updateError")));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingGroup) return;
        setIsDeleting(true);
        try {
            await GroupApi.deleteGroup(deletingGroup.id);
            toast.success(t("deleteSuccess"));
            setDeletingGroup(null);
            await fetchGroups();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("deleteError")));
        } finally {
            setIsDeleting(false);
        }
    };

    const workshopOptions: SelectOption[] = workshops.map((w) => ({
        value: w.id,
        label: w.workshopNameVn,
        searchText: w.workshopNameVn.toLowerCase(),
    }));

    const departmentName = (d: DepartmentDto) => (locale === "ja" && d.departmentNameJp) || d.departmentNameVn;
    const departmentOptions: SelectOption[] = departments.map((d) => ({
        value: d.id,
        label: departmentName(d),
        searchText: `${d.departmentNameVn} ${d.departmentNameJp ?? ""}`.toLowerCase(),
    }));
    const departmentById = new Map(departments.map((d) => [d.id, d]));
    // A filtered (or single-valued) column only repeats one value.
    const showWorkshop = !workshopFilter && workshops.length > 1;
    const showDepartment = !departmentFilter;
    const columnCount = 4 + (showWorkshop ? 1 : 0) + (showDepartment ? 1 : 0);

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <ListToolbar>
                    <SearchField value={keyword} onChange={setKeyword} onEnter={handleSearch} placeholder={t("searchPlaceholder")} wide />
                    <SearchableSelect
                        options={workshopOptions}
                        value={workshopFilter === "" ? "" : Number(workshopFilter)}
                        onChange={(v) => {
                            setPageIndex(1);
                            setWorkshopFilter(v === "" ? "" : String(v));
                        }}
                        placeholder={t("allWorkshops")}
                        ariaLabel={t("colWorkshop")}
                        triggerClassName={`${fieldClassName} w-40 pr-8`}
                    />
                    <SearchableSelect
                        options={departmentOptions}
                        value={departmentFilter === "" ? "" : Number(departmentFilter)}
                        onChange={(v) => {
                            setPageIndex(1);
                            setDepartmentFilter(v === "" ? "" : String(v));
                        }}
                        placeholder={t("allDepartments")}
                        ariaLabel={t("colDepartment")}
                        triggerClassName={`${fieldClassName} w-56 pr-8`}
                    />
                    <FilterActions onSearch={handleSearch} onReset={handleReset} disabled={isLoading} />
                </ListToolbar>
                <ErrorBar message={error} />

                <TableScroll>
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className={theadRowClassName}>
                                <th className="px-3 py-2">{t("colCode")}</th>
                                <th className="px-3 py-2">{t("colNameVn")}</th>
                                {showWorkshop && <th className="px-3 py-2">{t("colWorkshop")}</th>}
                                {showDepartment && <th className="px-3 py-2">{t("colDepartment")}</th>}
                                <th className="px-3 py-2">{t("colLines")}</th>
                                <th className="w-px px-3 py-2" aria-label={tCommon("actions")} />
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={groups.length === 0} columns={columnCount} emptyText={t("noData")} />
                            {groups.map((group) => (
                                <tr key={group.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{group.groupCode}</td>
                                    <td className="px-3 py-2 text-sm">
                                        <div className="text-[#191c1e]">{group.groupNameVn}</div>
                                        {group.groupNameJp && <div className="text-xs text-[#8a8f94]">{group.groupNameJp}</div>}
                                    </td>
                                    {showWorkshop && <td className="px-3 py-2 text-sm text-[#5e3f3a]">{group.workshopNameVn}</td>}
                                    {showDepartment && (
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                            {departmentById.has(group.departmentId) ? departmentName(departmentById.get(group.departmentId)!) : group.departmentNameVn}
                                        </td>
                                    )}
                                    <td className="px-3 py-2 text-sm" title={group.lines.map((l) => `${l.lineCode} · ${l.shiftTeamCode}`).join(", ")}>
                                        <div className="flex flex-wrap gap-1">
                                            {group.lines.slice(0, MAX_LINE_CHIPS).map((l) => (
                                                <span key={`${l.productionLineId}-${l.shiftTeamId}`} className="whitespace-nowrap rounded bg-[#f2f4f6] px-1.5 py-0.5 text-xs text-[#5e3f3a]">
                                                    {l.lineCode} · {l.shiftTeamCode}
                                                </span>
                                            ))}
                                            {group.lines.length > MAX_LINE_CHIPS && <span className="px-1 py-0.5 text-xs text-[#8a8f94]">+{group.lines.length - MAX_LINE_CHIPS}</span>}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="inline-flex items-center gap-1">
                                            <IconButton icon={Pencil} label={tCommon("edit")} onClick={() => openEditForm(group)} size="sm" variant="ghost" />
                                            <IconButton icon={Trash2} label={tCommon("delete")} onClick={() => setDeletingGroup(group)} size="sm" variant="danger" />
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
                    summary={isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: groups.length, total: totalCount })}
                    compactSummary={totalCount}
                />
            </section>

            <GroupForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingGroup}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={pendingMerge !== null}
                title={t("mergeTitle")}
                message={t("mergeMessage", { pairs: pendingMerge?.pairs.join(", ") ?? "" })}
                approveLabel={t("mergeApprove")}
                deniedLabel={tCommon("cancel")}
                loading={isSaving}
                onApprove={async () => {
                    if (pendingMerge) await handleSubmitForm(pendingMerge.values, true);
                }}
                onDenied={() => {
                    if (!isSaving) setPendingMerge(null);
                }}
            />

            <ConfirmDialog
                isOpen={deletingGroup !== null}
                title={t("deleteTitle")}
                message={t.rich("deleteMessage", {
                    name: deletingGroup?.groupNameVn ?? "",
                    b: (chunks) => <strong>{chunks}</strong>,
                })}
                approveLabel={tCommon("confirmDeleteApprove")}
                deniedLabel={tCommon("confirmDeleteDenied")}
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingGroup(null);
                }}
            />
        </div>
    );
});

export default GroupList;
