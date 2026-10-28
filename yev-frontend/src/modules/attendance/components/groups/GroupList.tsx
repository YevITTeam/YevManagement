"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Inbox, Search, Pencil, Trash2 } from "lucide-react";

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

const PAGE_SIZE = 10;

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
    const [groups, setGroups] = useState<GroupDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [departmentFilter, setDepartmentFilter] = useState<string>("");
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);
    const [workshopFilter, setWorkshopFilter] = useState<string>("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingGroup, setEditingGroup] = useState<GroupDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingGroup, setDeletingGroup] = useState<GroupDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // grid-list toàn cục không lọc theo Phòng ban trong docs — nên khi có bộ lọc, tải toàn bộ theo
    // by-department rồi tự phân trang phía FE; khi không lọc thì dùng grid-list bình thường.
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
                const computedTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
                const safePageIndex = Math.min(pageIndex, computedTotalPages);
                const start = (safePageIndex - 1) * PAGE_SIZE;
                return {
                    data: filtered.slice(start, start + PAGE_SIZE),
                    totalCount: filtered.length,
                    totalPages: computedTotalPages,
                    hasPreviousPage: safePageIndex > 1,
                    hasNextPage: safePageIndex < computedTotalPages,
                    safePageIndex,
                };
            }
            const result = await GroupApi.getGroupPageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
                workshopId: workshopFilter ? Number(workshopFilter) : undefined,
            });
            return { ...result, safePageIndex: pageIndex };
        },
        [pageIndex, appliedKeyword, departmentFilter, workshopFilter],
        (result) => {
            setGroups(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
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

    const handleSubmitForm = async (values: GroupFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await GroupApi.createGroup(values);
                toast.success(t("createSuccess"));
            } else if (editingGroup) {
                await GroupApi.updateGroup(editingGroup.id, values);
                toast.success(t("updateSuccess"));
            }
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

    const departmentOptions: SelectOption[] = departments.map((d) => ({
        value: d.id,
        label: d.departmentNameVn,
        searchText: d.departmentNameVn.toLowerCase(),
    }));

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={t("searchPlaceholder")}
                            className="h-9 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <SearchableSelect
                            options={workshopOptions}
                            value={workshopFilter === "" ? "" : Number(workshopFilter)}
                            onChange={(v) => {
                                setPageIndex(1);
                                setWorkshopFilter(v === "" ? "" : String(v));
                            }}
                            placeholder={t("allWorkshops")}
                            triggerClassName="h-9 w-40 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <SearchableSelect
                            options={departmentOptions}
                            value={departmentFilter === "" ? "" : Number(departmentFilter)}
                            onChange={(v) => {
                                setPageIndex(1);
                                setDepartmentFilter(v === "" ? "" : String(v));
                            }}
                            placeholder={t("allDepartments")}
                            triggerClassName="h-9 w-56 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
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
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: groups.length, total: totalCount })}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-3 py-2">{t("colCode")}</th>
                                <th className="px-3 py-2">{t("colNameVn")}</th>
                                <th className="px-3 py-2">{t("colWorkshop")}</th>
                                <th className="px-3 py-2">{t("colDepartment")}</th>
                                <th className="px-3 py-2 text-right">{tCommon("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && groups.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-12">
                                        <div className="flex flex-col items-center gap-2 text-center text-sm text-[#5e3f3a]">
                                            <Inbox className="h-8 w-8 text-[#c7ccd1]" />
                                            {t("noData")}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {groups.map((group) => (
                                <tr key={group.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{group.groupCode}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{group.groupNameVn}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{group.workshopNameVn}</td>
                                    <td className="px-3 py-2 text-sm">
                                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-medium text-[#5e3f3a]">
                                            {group.departmentNameVn}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-sm">
                                        <div className="inline-flex items-center gap-1.5">
                                            <button
                                                onClick={() => openEditForm(group)}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-40"
                                                title={tCommon("edit")}
                                                aria-label={tCommon("edit")}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingGroup(group)}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#e9bcb6] text-[#930006] transition hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-40"
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

                <div className="flex items-center justify-between border-t border-[#e0e3e5] p-3">
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

            <GroupForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingGroup}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
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
